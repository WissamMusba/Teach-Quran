import { getDB } from '../database/localDB';

export const SURAH_VERSE_COUNTS: number[] = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];

interface PlaybackCallbacks {
  onVerseChange?: (verse: number) => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
}

interface TimelineEntry { verse: number; start: number; end: number }

let currentSurahId = 0;
let currentVerse = 1;
let playing = false;
let playToken = 0;
let stallTimer: ReturnType<typeof setTimeout> | null = null;

const ATTEMPT_TIMEOUT_MS = 10000;
const STREAM_TIMEOUT_MS = 20000;
const TIMELINE_TIMEOUT_MS = 6000;

const STREAM_SOURCES: Record<string, { mp3quran: (s3: string) => string; quranComRecId: number }> = {
  'ar.alafasy': { mp3quran: (s3: string) => `https://server8.mp3quran.net/afs/${s3}.mp3`, quranComRecId: 7 },
  'ar.abdulbasit': { mp3quran: (s3: string) => `https://server7.mp3quran.net/basit/${s3}.mp3`, quranComRecId: 1 },
};

const getStreamSource = (qariId: string, surahId: number): { url: string; quranComRecId: number } => {
  const s3 = String(surahId).padStart(3, '0');
  const cfg = STREAM_SOURCES[qariId] || STREAM_SOURCES['ar.abdulbasit'];
  return { url: cfg.mp3quran(s3), quranComRecId: cfg.quranComRecId };
};

export const isSurahPlaying = (surahId: number): boolean => playing && currentSurahId === surahId;

export const pauseSurah = async (player: any): Promise<void> => {
  playToken++;
  clearWatchdog();
  playing = false;
  try {
    player.removePlayBackListener();
    await player.pausePlayer();
  } catch {}
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

const fetchQuranComTimeline = (recId: number, surahId: number): Promise<{ duration: number; entries: TimelineEntry[] } | null> =>
  new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve(null); } }, TIMELINE_TIMEOUT_MS);
    fetch(`https://api.quran.com/api/v4/recitations/${recId}/by_surah/${surahId}`)
      .then(r => r.json())
      .then((j: any) => {
        if (done) return;
        done = true;
        clearTimeout(t);
        const af = j && j.audio_files && j.audio_files[0];
        const segs = af && Array.isArray(af.segments) && af.segments.length > 0 ? af.segments : null;
        if (!segs) { resolve(null); return; }
        resolve({ duration: af.duration || 0, entries: segs.map((s: any[]) => ({ verse: s[0], start: s[1], end: s[2] })) });
      })
      .catch(() => { if (!done) { done = true; clearTimeout(t); resolve(null); } });
  });

const buildEstimatedTimeline = async (surahId: number, lastVerse: number, totalDurMs: number): Promise<TimelineEntry[]> => {
  const out: TimelineEntry[] = [];
  try {
    const res = await getDB().executeSql(`SELECT verseNumber, length(textArabic) AS l FROM verses WHERE surahId=? ORDER BY verseNumber`, [surahId]);
    const rows = res && res.length > 0 ? res[0].rows : null;
    const lens: number[] = [];
    if (rows && rows.length > 0) for (let i = 0; i < rows.length; i++) lens.push(rows.item(i).l);
    if (lens.length === lastVerse) {
      const total = lens.reduce<number>((a, b) => a + (b || 0), 0) || 1;
      let acc = 0;
      for (let i = 0; i < lens.length; i++) {
        const start = Math.round(totalDurMs * acc / total);
        acc += lens[i];
        out.push({ verse: i + 1, start, end: Math.round(totalDurMs * acc / total) });
      }
      return out;
    }
  } catch {}
  for (let i = 0; i < lastVerse; i++) {
    out.push({ verse: i + 1, start: Math.round(totalDurMs * i / lastVerse), end: Math.round(totalDurMs * (i + 1) / lastVerse) });
  }
  return out;
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
  callbacks.onVerseChange?.(verse);
  const sources = getAudioSources(qariId, surahId, verse);
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
      switch (e.status) {
        case 2:
          started = true;
          markStarted(player);
          break;
        case 3:
          player.removePlayBackListener();
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
    try {
      const start = player.startPlayer(sources[index]);
      start.then(() => {
        if (attemptToken !== playToken) return;
        started = true;
        markStarted(player);
      }).catch(() => {
        if (attemptToken !== playToken || started) return;
        playToken++;
        nextAttempt(index + 1);
      });
    } catch {
      if (attemptToken !== playToken) return;
      playToken++;
      nextAttempt(index + 1);
    }
  };
  nextAttempt(0);
};

const playSurahStream = (player: any, qariId: string, surahId: number, startVerse: number, lastVerse: number, callbacks: PlaybackCallbacks): void => {
  const { url, quranComRecId } = getStreamSource(qariId, surahId);
  playToken++;
  const token = playToken;
  currentVerse = startVerse;
  callbacks.onVerseChange?.(startVerse);
  let timeline: TimelineEntry[] | null = null;
  let verseIndex = Math.max(0, startVerse - 1);
  let seekGuardUntil = 0;
  let ended = false;

  const timelinePromise = fetchQuranComTimeline(quranComRecId, surahId)
    .then((t) => { if (token === playToken && t && t.entries && t.entries.length > 0) timeline = t.entries; })
    .catch(() => {});

  const fallbackPerAyah = (): void => {
    if (token !== playToken) return;
    playVerse(player, qariId, surahId, currentVerse, lastVerse, callbacks);
  };

  const begin = (): void => {
    if (token !== playToken) return;
    clearWatchdog();
    stallTimer = setTimeout(() => {
      stallTimer = null;
      if (token !== playToken) return;
      playToken++;
      fallbackPerAyah();
    }, STREAM_TIMEOUT_MS);
    player.removePlayBackListener();
    player.addPlayBackListener((e: any) => {
      if (token !== playToken) return;
      clearWatchdog();
      if (e.status === 3) {
        if (ended) return;
        ended = true;
        playToken++;
        playing = false;
        try { player.removePlayBackListener(); } catch {}
        callbacks.onEnd?.();
        return;
      }
      if (e.status === 5 || e.status === 6) {
        playToken++;
        playing = false;
        return;
      }
      const pos = e.currentPosition;
      if (typeof pos !== 'number' || Date.now() < seekGuardUntil) return;
      if (timeline) {
        while (verseIndex < timeline.length - 1 && pos >= timeline[verseIndex].end) {
          verseIndex++;
          currentVerse = timeline[verseIndex].verse;
          callbacks.onVerseChange?.(currentVerse);
        }
      }
    });
    try {
      const p = player.startPlayer(url);
      (p || Promise.resolve()).then(async () => {
        if (token !== playToken) return;
        clearWatchdog();
        if (!timeline) await timelinePromise;
        if (token !== playToken) return;
        try { await player.setVolume(1.0); } catch {}
        if (!timeline) {
          let dur = 0;
          try { dur = await player.getDuration() || 0; } catch {}
          timeline = await buildEstimatedTimeline(surahId, lastVerse, dur);
        }
        if (token !== playToken || !timeline) return;
        playing = true;
        const start = timeline[verseIndex] ? timeline[verseIndex].start : 0;
        if (start > 0) {
          seekGuardUntil = Date.now() + 800;
          try { await player.seekToPlayer(start); } catch {}
        }
      }).catch(() => {
        if (token !== playToken) return;
        playToken++;
        fallbackPerAyah();
      });
    } catch {
      if (token !== playToken) return;
      playToken++;
      fallbackPerAyah();
    }
  };

  begin();
};

export const playSurahFromVerse = async (player: any, qariId: string, surahId: number, startVerse: number, callbacks: PlaybackCallbacks = {}): Promise<void> => {
  const lastVerse = SURAH_VERSE_COUNTS[surahId - 1] || 1;
  const verse = Math.max(1, Math.min(startVerse || 1, lastVerse));
  if (verse > lastVerse) return;
  await stopPlayback(player);
  currentSurahId = surahId;
  playSurahStream(player, qariId, surahId, verse, lastVerse, callbacks);
};
