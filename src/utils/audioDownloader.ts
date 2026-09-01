import RNFS from 'react-native-fs';
import { SURAH_VERSE_COUNTS } from './audioPlayback';

const CACHE_SUBDIR = 'ayahCache';

const fsOk = (() => {
  try {
    return !!RNFS && !!RNFS.DocumentDirectoryPath && typeof RNFS.exists === 'function' && typeof RNFS.downloadFile === 'function';
  } catch {
    return false;
  }
})();

const cacheDir = (): string => `${RNFS.DocumentDirectoryPath}/${CACHE_SUBDIR}`;

const cacheKey = (qariId: string, surahId: number, verse: number): string =>
  `${qariId.replace(/[^a-zA-Z0-9]/g, '_')}_${surahId}_${verse}.mp3`;

export const getCachedFilePath = (qariId: string, surahId: number, verse: number): string =>
  `${cacheDir()}/${cacheKey(qariId, surahId, verse)}`;

export const ensureCacheDir = async (): Promise<void> => {
  if (!fsOk) return;
  const dir = cacheDir();
  const exists = await RNFS.exists(dir).catch(() => false);
  if (!exists) {
    await RNFS.mkdir(dir).catch(() => {});
  }
};

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

const cancelledSurahs = new Set<number>();

export const cancelSurahDownload = (surahId: number): void => {
  cancelledSurahs.add(surahId);
};

export const isSurahDownloaded = async (qariId: string, surahId: number): Promise<boolean> => {
  if (!fsOk || surahId < 1 || surahId > 114) return false;
  const totalVerses = SURAH_VERSE_COUNTS[surahId - 1] || 1;
  await ensureCacheDir();
  for (let v = 1; v <= totalVerses; v++) {
    const p = getCachedFilePath(qariId, surahId, v);
    const exists = await RNFS.exists(p).catch(() => false);
    if (!exists) return false;
  }
  return true;
};

export const downloadSurahAudio = async (
  qariId: string,
  surahId: number,
  onProgress?: (downloaded: number, total: number) => void
): Promise<{ success: boolean; error?: string }> => {
  if (!fsOk) return { success: false, error: 'File system not available' };
  if (surahId < 1 || surahId > 114) return { success: false, error: 'Invalid surah number' };

  const totalVerses = SURAH_VERSE_COUNTS[surahId - 1] || 1;
  cancelledSurahs.delete(surahId);
  await ensureCacheDir();

  let downloadedCount = 0;

  for (let v = 1; v <= totalVerses; v++) {
    if (cancelledSurahs.has(surahId)) {
      cancelledSurahs.delete(surahId);
      return { success: false, error: 'Download cancelled' };
    }

    const dest = getCachedFilePath(qariId, surahId, v);
    const exists = await RNFS.exists(dest).catch(() => false);

    if (exists) {
      downloadedCount++;
      onProgress?.(downloadedCount, totalVerses);
      continue;
    }

    let verseDownloaded = false;
    const sources = getAudioSources(qariId, surahId, v);

    for (const url of sources) {
      try {
        const res = await RNFS.downloadFile({
          fromUrl: url,
          toFile: dest,
          background: true,
          connectionTimeout: 10000,
          readTimeout: 15000,
        }).promise;

        if (res.statusCode >= 200 && res.statusCode < 300) {
          verseDownloaded = true;
          break;
        }
      } catch {}
      try { await RNFS.unlink(dest); } catch {}
    }

    if (!verseDownloaded) {
      return { success: false, error: `Failed to download verse ${v} of Surah ${surahId}` };
    }

    downloadedCount++;
    onProgress?.(downloadedCount, totalVerses);
  }

  return { success: true };
};

export const deleteSurahAudio = async (qariId: string, surahId: number): Promise<void> => {
  if (!fsOk || surahId < 1 || surahId > 114) return;
  const totalVerses = SURAH_VERSE_COUNTS[surahId - 1] || 1;
  for (let v = 1; v <= totalVerses; v++) {
    const p = getCachedFilePath(qariId, surahId, v);
    try {
      if (await RNFS.exists(p)) {
        await RNFS.unlink(p);
      }
    } catch {}
  }
};

export const clearAllAudioDownloads = async (): Promise<void> => {
  if (!fsOk) return;
  try {
    const dir = cacheDir();
    if (await RNFS.exists(dir)) {
      await RNFS.unlink(dir);
      await ensureCacheDir();
    }
  } catch {}
};
