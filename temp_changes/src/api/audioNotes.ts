import storage from '@react-native-firebase/storage';
import { getAudioNotesRange, saveAudioNotesRange, rangeKeyForPage, rangeKeyForVerse, migrateLegacyAudioNotes } from '../database/localDB';

export const uploadAudioNote = async (localPath: string): Promise<string> => {
  const fileId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const ref = storage().ref(`audio_notes/${fileId}.m4a`);
  await ref.putFile(localPath, { contentType: 'audio/mp4' });
  return fileId;
};

/**
 * Audio-note metadata is now stored per 10-page range (`r_<lo>_<hi>` keys) in the
 * audio_notes_cache table, pushed to Firestore as ONE doc per range and pulled
 * lazily (the whole range comes down in one read, so it stays < 1MB). The m4a
 * files themselves are unchanged (storage + RNFS cache via playAudioNote).
 */
export const registerAudioNote = async (studentId: string, verseKey: string, fileId: string, ms: number, page?: number) => {
  await migrateLegacyAudioNotes(studentId);
  const [s, v] = verseKey.split('_').map(Number);
  const rangeKey = page && page > 0 ? rangeKeyForPage(page) : await rangeKeyForVerse(verseKey);
  const cur = await getAudioNotesRange(studentId, rangeKey);
  const entries = { ...(cur.entries || {}), [fileId]: { storagePath: `audio_notes/${fileId}.m4a`, surah: s, ayah: v, page: page || 0, durationMs: ms, sizeBytes: 0 } };
  await saveAudioNotesRange(studentId, rangeKey, entries, cur.v + 1, true);
};

export const playAudioNote = async (fileId: string): Promise<string | null> => {
  const RNFS = require('react-native-fs').default || require('react-native-fs');
  const cachePath = `${RNFS.DocumentDirectoryPath}/audio_cache/${fileId}.m4a`;
  if (await RNFS.exists(cachePath)) return cachePath;
  try {
    const url = await storage().ref(`audio_notes/${fileId}.m4a`).getDownloadURL();
    const dir = `${RNFS.DocumentDirectoryPath}/audio_cache`;
    if (!(await RNFS.exists(dir))) {
      await RNFS.mkdir(dir);
    }
    await RNFS.downloadFile({ fromUrl: url, toFile: cachePath }).promise;
    return cachePath;
  } catch { return null; }
};
