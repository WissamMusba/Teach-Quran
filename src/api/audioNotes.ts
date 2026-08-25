import storage from '@react-native-firebase/storage';
import { getUserId } from './firebase';
import { getAudioNotesRange, saveAudioNotesRange, rangeKeyForPage, rangeKeyForVerse, migrateLegacyAudioNotes } from '../database/localDB';

// Voice-note blobs live under the OWNER's uid segment — storage.rules grants
// /audio_notes/{uid}/* to that user only. Legacy flat-path files
// (/audio_notes/{fileId}.m4a from pre-rules builds) fall back in playAudioNote.
const noteRef = (fileId: string) => {
  const uid = getUserId();
  return uid
    ? `audio_notes/${uid}/${fileId}.m4a`
    : `audio_notes/${fileId}.m4a`;
};

export const uploadAudioNote = async (localPath: string): Promise<string> => {
  const fileId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const ref = storage().ref(noteRef(fileId));
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
  const entries = { ...(cur.entries || {}), [fileId]: { storagePath: noteRef(fileId), surah: s, ayah: v, page: page || 0, durationMs: ms, sizeBytes: 0 } };
  await saveAudioNotesRange(studentId, rangeKey, entries, cur.v + 1, true);
};

export const playAudioNote = async (fileId: string): Promise<string | null> => {
  const RNFS = require('react-native-fs').default || require('react-native-fs');
  const cachePath = `${RNFS.DocumentDirectoryPath}/audio_cache/${fileId}.m4a`;
  if (await RNFS.exists(cachePath)) return cachePath;
  // Owner-scoped path first; legacy flat path as fallback for recordings made
  // before the uid-segment layout (storage.rules no longer serve that path, so
  // this only helps if the rules are ever widened again).
  try {
    const url = await storage().ref(noteRef(fileId)).getDownloadURL();
    return await downloadToCache(RNFS, url, cachePath);
  } catch {
    try {
      const url = await storage().ref(`audio_notes/${fileId}.m4a`).getDownloadURL();
      return await downloadToCache(RNFS, url, cachePath);
    } catch { return null; }
  }
};
const downloadToCache = async (RNFS: any, url: string, cachePath: string): Promise<string> => {
  const dir = `${RNFS.DocumentDirectoryPath}/audio_cache`;
  if (!(await RNFS.exists(dir))) {
    await RNFS.mkdir(dir);
  }
  await RNFS.downloadFile({ fromUrl: url, toFile: cachePath }).promise;
  return cachePath;
};
