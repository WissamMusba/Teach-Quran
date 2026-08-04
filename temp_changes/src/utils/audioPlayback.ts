import RNFS from 'react-native-fs';

export const SURAH_VERSE_COUNTS: number[] = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];

interface PlaybackCallbacks {
  onVerseChange?: (verse: number, surahId?: number) => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
}

let currentSurahId = 0;
let currentVerse = 1;
let playing = false;
let playToken = 0;
let stallTimer: ReturnType<typeof setTimeout> | null = null;
let lastPositionMs = 0;
let resumeSession: { surahId: number; verse: number; positionMs: number } | null = null;

const ATTEMPT_TIMEOUT_MS = 10000;
const PREFETCH_AHEAD = 2;
const CACHE_SUBDIR = 'ayahCache';

export const isSurahPlaying = (surahId: number): boolean => playing && currentSurahId === surahId;

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

export const getPlaybackPosition = (): number => lastPositionMs;

export const isResumable = (): boolean => resumeSession !== null;

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
  await stopPlayback(player);
  currentSurahId = session.surahId;
  playVerse(player, qariId, session.surahId, session.verse, lastVerse, callbacks);
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
    await player.stopPlayer();
  } catch {}
};

// ---------- per-ayah cache (prefetch 2 verses ahead) ----------
const cacheDir = (): string => `${RNFS.DocumentDirectoryPath}/${CACHE_SUBDIR}`;
const cacheKey = (qariId: string, surahId: number, verse: number): string =>
  `${qariId.replace(/[^a-zA-Z0-9]/g, '_')}_${surahId}_${verse}.mp3`;
const cachedPath = (qariId: string, surahId: number, verse: number): string =>
  `${cacheDir()}/${cacheKey(qariId, surahId, verse)}`;

let cacheDirReady: Promise<void> | null = null;
const ensureCacheDir = (): Promise<void> => {
  if (!cacheDirReady) cacheDirReady = RNFS.mkdir(cacheDir()).catch(() => {});
  return cacheDirReady;
};

const wipeAyahCache = async (): Promise<void> => {
  cacheDirReady = null;
  await RNFS.unlink(cacheDir()).catch(() => {});
  cacheDirReady = ensureCacheDir();
  await cacheDirReady;
};

const prefetchJobs: Record<string, Promise<void>> = {};

const prefetchAyah = (qariId: string, surahId: number, verse: number): void => {
  if (verse < 1) return;
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
  if (verse < 1) return;
  try { await RNFS.unlink(cachedPath(qariId, surahId, verse)); } catch {}
};

const getAudioSources = (qariId: string, surahId: number, verse: number): string[] => {
  const s3 = String(surahId).padStart(3, '0');
  const v3 = String(verse).padStart(3, '0');
  if (qariId === 'ar.alafasy') {
    return [
      `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${surahId}:${verse}.mp3`,
      `https://everyayah.com/data/Alafasy_128kbps/${s3}${v3}.mp3`,
      `https://download.quranicaudio.com/quran/alafasy_128kbps/${s3}${v3}.mp3`,
      `https://verses.quran.com/Alafasy/128/mp3/${s3}${v3}.mp3`,
    ];
  }
  return [
    `https://cdn.islamic.network/quran/audio/128/ar.abdulbasit/${surahId}:${verse}.mp3`,
    `https://everyayah.com/data/AbdulBaset_128kbps/${s3}${v3}.mp3`,
    `https://download.quranicaudio.com/quran/abdul_baset_mujawwad_128kbps/${s3}${v3}.mp3`,
    `https://verses.quran.com/AbdulBaset/Mujawwad/mp3/${s3}${v3}.mp3`,
  ];
};

const markStarted = (player: any): void => {
  clearWatchdog();
  playing = true;
  try {
    player.setVolume(1.0);
  } catch {}
};

const playVerse = (player: any, qariId: string, surahId: number, verse: number, lastVerse: number, callbacks: PlaybackCallbacks): void => {
  currentVerse = verse;
  callbacks.onVerseChange?.(verse, currentSurahId);
  prefetchAyah(qariId, surahId, verse + 1);
  prefetchAyah(qariId, surahId, verse + 2);
  const sources = getAudioSources(qariId, surahId, verse);
  const localPath = cachedPath(qariId, surahId, verse);
  playToken++;
  const nextAttempt = (index: number): void => {
    clearWatchdog();
    if (index >= sources.length) {
      playing = false;
      callbacks.onError?.('Audio could not be played from any server. Please check your connection.');
      return;
    }
    const attemptToken = playToken;
    player.removePlayBackListener();
    let started = false;
    // Status codes: 2 playing, 3 completed, 4 paused, 5 stopped, 6 interrupted, 7 unknown.
    player.addPlayBackListener((e: any) => {
      if (attemptToken !== playToken) return;
      clearWatchdog();
      const pos = e.currentPosition;
      if (typeof pos === 'number' && pos >= 0) lastPositionMs = pos;
      switch (e.status) {
        case 2:
          started = true;
          markStarted(player);
          break;
        case 3:
          player.removePlayBackListener();
          cleanupAyahCache(qariId, surahId, verse - PREFETCH_AHEAD - 1);
          if (verse < lastVerse) playVerse(player, qariId, surahId, verse + 1, lastVerse, callbacks);
          else {
            playing = false;
            callbacks.onEnd?.();
          }
          break;
        case 5:
        case 6:
          playToken++;
          player.removePlayBackListener();
          playing = false;
          break;
      }
    });
    stallTimer = setTimeout(() => {
      stallTimer = null;
      if (attemptToken !== playToken) return;
      playToken++;
      nextAttempt(index + 1);
    }, ATTEMPT_TIMEOUT_MS);
    (async () => {
      let src = sources[index];
      if (index === 0) {
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
          if (src === localPath) {
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

export const playSurahFromVerse = async (player: any, qariId: string, surahId: number, startVerse: number, callbacks: PlaybackCallbacks = {}): Promise<void> => {
  resumeSession = null;
  const lastVerse = SURAH_VERSE_COUNTS[surahId - 1] || 1;
  const verse = Math.max(1, Math.min(startVerse || 1, lastVerse));
  if (verse > lastVerse) return;
  await stopPlayback(player);
  if (currentSurahId !== surahId) {
    currentSurahId = surahId;
    await wipeAyahCache();
  }
  playVerse(player, qariId, surahId, verse, lastVerse, callbacks);
};
