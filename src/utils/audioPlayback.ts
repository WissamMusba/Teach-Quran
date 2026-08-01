export const SURAH_VERSE_COUNTS: number[] = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];

interface PlaybackCallbacks {
  onVerseChange?: (verse: number) => void;
  onEnd?: () => void;
}

let currentSurahId = 0;
let currentVerse = 1;
let playing = false;

export const isSurahPlaying = (surahId: number): boolean => playing && currentSurahId === surahId;

export const pauseSurah = async (player: any): Promise<void> => {
  playing = false;
  try {
    player.removePlayBackListener();
    await player.pausePlayer();
  } catch {}
};

const playVerse = (player: any, qariId: string, surahId: number, verse: number, lastVerse: number, callbacks: PlaybackCallbacks) => {
  currentVerse = verse;
  playing = true;
  callbacks.onVerseChange?.(verse);
  player.addPlayBackListener((e: any) => {
    if (e.status === 3) {
      player.removePlayBackListener();
      if (verse < lastVerse) playVerse(player, qariId, surahId, verse + 1, lastVerse, callbacks);
      else {
        playing = false;
        callbacks.onEnd?.();
      }
    }
  });
  player.startPlayer(`https://cdn.islamic.network/quran/audio/128/${qariId}/${surahId}:${verse}.mp3`);
};

export const playSurahFromVerse = async (player: any, qariId: string, surahId: number, startVerse: number, callbacks: PlaybackCallbacks = {}): Promise<void> => {
  const lastVerse = SURAH_VERSE_COUNTS[surahId - 1] || 1;
  const verse = playing && currentSurahId === surahId ? currentVerse : Math.max(1, Math.min(startVerse || 1, lastVerse));
  if (verse > lastVerse) return;
  if (!(playing && currentSurahId === surahId)) {
    try {
      player.removePlayBackListener();
      await player.stopPlayer();
    } catch {}
    currentSurahId = surahId;
  }
  playVerse(player, qariId, surahId, verse, lastVerse, callbacks);
};
