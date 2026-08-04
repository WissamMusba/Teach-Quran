/**
 * FILE: src/utils/audioPlayback.ts
 * ROLE: Per-ayah playback engine — each verse streams from its own MP3 (verified CDN mirrors, everyayah.com first),
 *       prefetches the next 2 verses to disk (RNFS, OPTIONAL — playback works without it), and fires onVerseChange
 *       exactly at each verse start (no timeline/seek math at all).
 *       Optionally plays the basmala (the reciter's own 1:1 file) before verse 1 of a surah (surah 1 & 9 excluded).
 *       RESUME continues mid-verse: pauseSurahWithResume keeps the native player paused at the exact position and
 *       resumeSurah calls the native resumePlayer (fallback: clean restart of the same verse).
 * DEPENDS ON: react-native-fs (RNFS) -> optional on-disk ayah cache under DocumentDirectoryPath/ayahCache;
 *             an AudioRecorderPlayer instance passed by the caller; qariId one of 'ar.alafasy' | 'ar.abdulbasit'
 *             (else defaults to abdulbasit); network access to everyayah.com (primary) + cdn.islamic.network (last resort).
 * USED BY: QuranViewScreen.tsx:53 (playSurahFromVerse, pauseSurah, pauseSurahWithResume, resumeSurah, isResumable,
 *          SURAH_VERSE_COUNTS, isSurahPlaying, getCurrentPlaybackVerse).
 * WHY PER-AYAH (history): the old whole-surah streamer (mp3quran 001.mp3 + quran.com by_surah segment timeline)
 *          drifted badly — api.quran.com/v4/recitations/{id}/by_surah/{n} now returns 404, so the timeline fell back
 *          to text-length-proportional estimates, landing the seek ~15-30s (1-2 verses) before the tapped verse.
 *          Per-ayah files always start exactly at the verse's first word, and no longer play audhu/basmala at surah start.
 * WHY isFinished (v49 fix): react-native-audio-recorder-player's PlayBackType is ONLY {currentPosition, duration,
 *          isFinished} — there is NO `status` field (verified in the installed module: android/.../Module.kt emits
 *          duration/currentPosition/isFinished; index.ts PlayBackType). The v48 listener switched on e.status, which
 *          never matched -> no verse ever advanced -> "as soon as one ayah is done it stops". ALSO the library's
 *          startPlayer() JS guard (`if (!this._isPlaying || this._hasPaused)`) silently no-ops while the previous
 *          player is still flagged playing, and its internal stopPlayer() runs right after every isFinished event —
 *          so every verse advance first awaits OUR stopPlayback() (clears the flag, lets the internal stop land)
 *          before startPlayer() of the next verse.
 */
import RNFS from 'react-native-fs';

export const SURAH_VERSE_COUNTS: number[] = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];

interface PlaybackCallbacks {
  onVerseChange?: (verse: number, surahId?: number) => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
}

interface PlaybackOptions {
  playBasmala?: boolean;
}

let currentSurahId = 0;
let currentVerse = 1;
let playing = false;
let playToken = 0;
let stallTimer: ReturnType<typeof setTimeout> | null = null;
let lastPositionMs = 0;
let resumeSession: { surahId: number; verse: number; positionMs: number } | null = null;

const ATTEMPT_TIMEOUT_MS = 8000;
const PREFETCH_AHEAD = 2;
const CACHE_SUBDIR = 'ayahCache';

export const isSurahPlaying = (surahId: number): boolean => playing && currentSurahId === surahId;

export const getPlaybackPosition = (): number => lastPositionMs;

export const getCurrentPlaybackVerse = (): number => currentVerse;

export const isResumable = (): boolean => resumeSession !== null;

export const pauseSurah = async (player: any): Promise<void> => {
  playToken++;
  clearWatchdog();
  playing = false;
  try {
    player.removePlayBackListener();
  } catch {}
  try {
    Promise.resolve(player.pausePlayer()).catch(() => {});
  } catch {}
};

export const pauseSurahWithResume = async (player: any): Promise<void> => {
  const session = { surahId: currentSurahId, verse: currentVerse, positionMs: lastPositionMs };
  playToken++;
  clearWatchdog();
  playing = false;
  try {
    player.removePlayBackListener();
  } catch {}
  try {
    Promise.resolve(player.pausePlayer()).catch(() => {});
  } catch {}
  resumeSession = session;
};

export const resumeSurah = async (player: any, qariId: string, callbacks: PlaybackCallbacks = {}): Promise<boolean> => {
  const session = resumeSession;
  if (!session) return false;
  const lastVerse = SURAH_VERSE_COUNTS[session.surahId - 1] || 1;
  resumeSession = null;
  currentSurahId = session.surahId;
  currentVerse = session.verse;
  playToken++;
  clearWatchdog();
  try {
    player.removePlayBackListener();
  } catch {}
  // 1) Native resume: pauseSurahWithResume left the media player paused at the EXACT mid-verse
  //    position; resumePlayer() (seekTo(currentPosition) + start) continues from there.
  let resumed = false;
  try {
    const r: any = await Promise.race([
      Promise.resolve(player.resumePlayer()),
      new Promise((res) => setTimeout(() => res('__resume_timeout'), 2500)),
    ]);
    // Success resolves 'resume player'; failure modes resolve 'No audio playing'/'Already playing'.
    resumed = typeof r === 'string' && r !== 'No audio playing' && r !== 'Already playing' && r !== '__resume_timeout';
  } catch {
    resumed = false;
  }
  if (!resumed) {
    // Paused native player was lost (stopped/released meanwhile) — restart the verse cleanly, no basmala.
    await stopPlayback(player);
    playVerse(player, qariId, session.surahId, session.verse, lastVerse, callbacks, false);
    return true;
  }
  attachResumeListener(player, qariId, session.surahId, session.verse, lastVerse, callbacks);
  markStarted(player);
  return true;
};

const clearWatchdog = (): void => {
  if (stallTimer !== null) {
    clearTimeout(stallTimer);
    stallTimer = null;
  }
};

const stopPlayback = async (player: any): Promise<void> => {
  clearWatchdog();
  try {
    player.removePlayBackListener();
  } catch {}
  try {
    await Promise.race([
      Promise.resolve(player.stopPlayer()),
      new Promise((res) => setTimeout(res, 3000)),
    ]);
  } catch {}
};

// ---------- per-ayah cache (RNFS, OPTIONAL — every call degrades to streaming) ----------
const fsOk = (() => {
  try {
    return !!RNFS && !!RNFS.DocumentDirectoryPath && typeof RNFS.exists === 'function' && typeof RNFS.downloadFile === 'function';
  } catch {
    return false;
  }
})();

const cacheDir = (): string | null => (fsOk ? `${RNFS.DocumentDirectoryPath}/${CACHE_SUBDIR}` : null);
const cacheKey = (qariId: string, surahId: number, verse: number): string =>
  `${qariId.replace(/[^a-zA-Z0-9]/g, '_')}_${surahId}_${verse}.mp3`;
const cachedPath = (qariId: string, surahId: number, verse: number): string | null =>
  fsOk ? `${cacheDir()}/${cacheKey(qariId, surahId, verse)}` : null;

let cacheDirReady: Promise<void> | null = null;
const ensureCacheDir = (): Promise<void> => {
  if (!fsOk) return Promise.resolve();
  if (!cacheDirReady) {
    try {
      cacheDirReady = Promise.resolve(RNFS.mkdir(cacheDir())).catch(() => {});
    } catch {
      cacheDirReady = Promise.resolve();
    }
  }
  return cacheDirReady;
};

const wipeAyahCache = async (): Promise<void> => {
  if (!fsOk) return;
  cacheDirReady = null;
  try {
    await Promise.resolve(RNFS.unlink(cacheDir())).catch(() => {});
  } catch {}
  cacheDirReady = ensureCacheDir();
  await cacheDirReady;
};

const prefetchJobs: Record<string, Promise<void>> = {};

const prefetchAyah = (qariId: string, surahId: number, verse: number): void => {
  if (!fsOk || verse < 1) return;
  const key = cacheKey(qariId, surahId, verse);
  if (prefetchJobs[key]) return;
  prefetchJobs[key] = (async () => {
    try {
      await ensureCacheDir();
      const cp = cachedPath(qariId, surahId, verse);
      if (await RNFS.exists(cp)) return;
      for (const url of getAudioSources(qariId, surahId, verse)) {
        try {
          const res = await RNFS.downloadFile({ fromUrl: url, toFile: cp }).promise;
          if (res.statusCode >= 200 && res.statusCode < 300) return;
        } catch {}
        try { await RNFS.unlink(cp); } catch {}
      }
    } catch {}
  })();
  prefetchJobs[key].catch(() => {}).finally(() => { delete prefetchJobs[key]; });
};

const cleanupAyahCache = async (qariId: string, surahId: number, verse: number): Promise<void> => {
  if (!fsOk || verse < 1) return;
  try { await RNFS.unlink(cachedPath(qariId, surahId, verse)); } catch {}
};

// ---------- sources (ORDER = priority; everyayah verified 200, cdn.islamic.network 403s fast — last resort) ----------
const getAudioSources = (qariId: string, surahId: number, verse: number): string[] => {
  const s3 = String(surahId).padStart(3, '0');
  const v3 = String(verse).padStart(3, '0');
  if (qariId === 'ar.alafasy') {
    return [
      `https://everyayah.com/data/Alafasy_128kbps/${s3}${v3}.mp3`,
      `https://everyayah.com/data/Alafasy_64kbps/${s3}${v3}.mp3`,
      `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${surahId}:${verse}.mp3`,
    ];
  }
  return [
    `https://everyayah.com/data/Abdul_Basit_Mujawwad_128kbps/${s3}${v3}.mp3`,
    `https://everyayah.com/data/Abdul_Basit_Murattal_192kbps/${s3}${v3}.mp3`,
    `https://everyayah.com/data/Abdul_Basit_Murattal_64kbps/${s3}${v3}.mp3`,
    `https://cdn.islamic.network/quran/audio/128/ar.abdulbasit/${surahId}:${verse}.mp3`,
  ];
};

const markStarted = (player: any): void => {
  clearWatchdog();
  playing = true;
  try {
    player.setVolume(1.0);
  } catch {}
};

/**
 * Verse completion: cleanup + advance to verse+1 (or onEnd at the last verse).
 * The advance MUST first await our stopPlayback(): the library's internal stopPlayer() fires
 * right after every isFinished event and its startPlayer() guard silently no-ops while the
 * previous player is still flagged playing. Token check aborts if a pause/restart landed meanwhile.
 */
const advanceToNext = (
  player: any,
  qariId: string,
  surahId: number,
  verse: number,
  lastVerse: number,
  callbacks: PlaybackCallbacks,
): void => {
  cleanupAyahCache(qariId, surahId, verse - PREFETCH_AHEAD - 1);
  if (verse < lastVerse) {
    const t = playToken;
    stopPlayback(player).then(() => {
      if (t !== playToken) return;
      playVerse(player, qariId, surahId, verse + 1, lastVerse, callbacks, false);
    });
  } else {
    playing = false;
    callbacks.onEnd?.();
  }
};

/**
 * Shared attempt chain: plays ONE audio file through `sources` (cached local file first),
 * with a stall watchdog per attempt and token-based cancellation.
 * onComplete(isFinished) / onExhausted(all mirrors failed, no error fired by this helper).
 */
const startAttemptChain = (
  player: any,
  sources: string[],
  localPath: string | null,
  onComplete: () => void,
  onExhausted: () => void,
): void => {
  playToken++;
  const nextAttempt = (index: number): void => {
    clearWatchdog();
    if (index >= sources.length) {
      onExhausted();
      return;
    }
    const attemptToken = playToken;
    try {
      player.removePlayBackListener();
    } catch {}
    let started = false;
    // Native events carry ONLY {currentPosition, duration, isFinished} — no status field.
    player.addPlayBackListener((e: any) => {
      if (attemptToken !== playToken) return;
      clearWatchdog();
      const pos = e.currentPosition;
      if (typeof pos === 'number' && pos >= 0) lastPositionMs = pos;
      if (e.isFinished === true) {
        try {
          player.removePlayBackListener();
        } catch {}
        playToken++;
        onComplete();
      }
    });
    stallTimer = setTimeout(() => {
      stallTimer = null;
      if (attemptToken !== playToken) return;
      playToken++;
      try { Promise.resolve(player.stopPlayer()).catch(() => {}); } catch {}
      nextAttempt(index + 1);
    }, ATTEMPT_TIMEOUT_MS);
    (async () => {
      let src = sources[index];
      if (index === 0 && localPath) {
        try {
          if (await RNFS.exists(localPath)) src = localPath;
        } catch {}
      }
      if (attemptToken !== playToken) return;
      try {
        const p = player.startPlayer(src);
        (p || Promise.resolve()).then(() => {
          if (attemptToken !== playToken) return;
          started = true;
          markStarted(player);
        }).catch(() => {
          if (attemptToken !== playToken || started) return;
          if (src === localPath && localPath) {
            RNFS.unlink(localPath).catch(() => {});
            playToken++;
            nextAttempt(index + 1);
            return;
          }
          playToken++;
          nextAttempt(index + 1);
        });
      } catch {
        if (attemptToken !== playToken) return;
        playToken++;
        nextAttempt(index + 1);
      }
    })();
  };
  nextAttempt(0);
};

/**
 * Listener re-attachment for the native-resume path (resumeSurah success): the paused native
 * player continues mid-verse; we only re-arm the listener (completion -> advance) + watchdog
 * (stalled resume -> clean restart of the verse). No basmala on resume.
 */
const attachResumeListener = (
  player: any,
  qariId: string,
  surahId: number,
  verse: number,
  lastVerse: number,
  callbacks: PlaybackCallbacks,
): void => {
  playToken++;
  const token = playToken;
  try {
    player.removePlayBackListener();
  } catch {}
  player.addPlayBackListener((e: any) => {
    if (token !== playToken) return;
    clearWatchdog();
    const pos = e.currentPosition;
    if (typeof pos === 'number' && pos >= 0) lastPositionMs = pos;
    if (e.isFinished === true) {
      try {
        player.removePlayBackListener();
      } catch {}
      playToken++;
      advanceToNext(player, qariId, surahId, verse, lastVerse, callbacks);
    }
  });
  stallTimer = setTimeout(() => {
    stallTimer = null;
    if (token !== playToken) return;
    playToken++;
    playing = false;
    stopPlayback(player).then(() => {
      if (currentSurahId !== surahId) return;
      playVerse(player, qariId, surahId, verse, lastVerse, callbacks, false);
    });
  }, ATTEMPT_TIMEOUT_MS);
};

const playVerse = (
  player: any,
  qariId: string,
  surahId: number,
  verse: number,
  lastVerse: number,
  callbacks: PlaybackCallbacks,
  playBasmala: boolean,
): void => {
  if (verse === 1 && playBasmala && surahId !== 1 && surahId !== 9) {
    // Basmala prelude: the reciter's own 1:1 file, NO onVerseChange yet (highlight appears with verse 1).
    currentVerse = 1;
    prefetchAyah(qariId, 1, 1);
    prefetchAyah(qariId, surahId, 1);
    prefetchAyah(qariId, surahId, 2);
    const goVerse1 = () => stopPlayback(player).then(() => playVerse(player, qariId, surahId, 1, lastVerse, callbacks, false));
    startAttemptChain(
      player,
      getAudioSources(qariId, 1, 1),
      cachedPath(qariId, 1, 1),
      goVerse1,
      goVerse1,
    );
    return;
  }
  currentVerse = verse;
  callbacks.onVerseChange?.(verse, currentSurahId);
  prefetchAyah(qariId, surahId, verse + 1);
  prefetchAyah(qariId, surahId, verse + 2);
  startAttemptChain(
    player,
    getAudioSources(qariId, surahId, verse),
    cachedPath(qariId, surahId, verse),
    () => advanceToNext(player, qariId, surahId, verse, lastVerse, callbacks),
    () => {
      playing = false;
      callbacks.onError?.('Audio could not be played from any server. Please check your connection.');
    },
  );
};

export const playSurahFromVerse = async (
  player: any,
  qariId: string,
  surahId: number,
  startVerse: number,
  callbacks: PlaybackCallbacks = {},
  opts?: PlaybackOptions,
): Promise<void> => {
  resumeSession = null;
  const lastVerse = SURAH_VERSE_COUNTS[surahId - 1] || 1;
  const verse = Math.max(1, Math.min(startVerse || 1, lastVerse));
  if (verse > lastVerse) return;
  await stopPlayback(player);
  if (currentSurahId !== surahId) {
    currentSurahId = surahId;
    wipeAyahCache();
  }
  playVerse(player, qariId, surahId, verse, lastVerse, callbacks, !!opts?.playBasmala);
};
