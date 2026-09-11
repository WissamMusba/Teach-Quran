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

/**
 * Resolves an audio note path strictly locally on device.
 * NEVER makes network calls to Firebase Storage.
 * Checks local directories: voicenotes, audio_cache, and raw paths.
 * If file exists locally, returns resolved path; otherwise returns null immediately.
 */
export const resolveLocalAudioNotePath = async (fileId: string): Promise<string | null> => {
  if (!fileId) return null;
  const RNFS = require('react-native-fs').default || require('react-native-fs');

  // 1. Raw path if fileId is an absolute path or URI
  if (fileId.startsWith('/') || fileId.startsWith('file://')) {
    const clean = fileId.replace(/^file:\/\//, '');
    try {
      if (await RNFS.exists(clean)) return clean;
      if (await RNFS.exists(fileId)) return fileId;
    } catch {}
  }

  const fname = fileId.split('/').pop() || fileId;
  const baseName = fname.replace(/\.(m4a|mp4)$/i, '');
  const baseWithoutNote = baseName.replace(/^note_/, '');

  const candidatePaths: string[] = [
    // Raw paths
    fileId,
    fileId.replace(/^file:\/\//, ''),

    // ${RNFS.DocumentDirectoryPath}/voicenotes/${fileId} (with or without .mp4 / .m4a extension)
    `${RNFS.DocumentDirectoryPath}/voicenotes/${fname}`,
    `${RNFS.DocumentDirectoryPath}/voicenotes/${baseName}.m4a`,
    `${RNFS.DocumentDirectoryPath}/voicenotes/${baseName}.mp4`,
    `${RNFS.DocumentDirectoryPath}/voicenotes/${baseName}`,

    // ${RNFS.DocumentDirectoryPath}/voicenotes/note_${fileId}
    `${RNFS.DocumentDirectoryPath}/voicenotes/note_${fname}`,
    `${RNFS.DocumentDirectoryPath}/voicenotes/note_${baseName}.m4a`,
    `${RNFS.DocumentDirectoryPath}/voicenotes/note_${baseName}.mp4`,
    `${RNFS.DocumentDirectoryPath}/voicenotes/note_${baseName}`,
    `${RNFS.DocumentDirectoryPath}/voicenotes/note_${baseWithoutNote}.m4a`,
    `${RNFS.DocumentDirectoryPath}/voicenotes/note_${baseWithoutNote}.mp4`,
    `${RNFS.DocumentDirectoryPath}/voicenotes/${baseWithoutNote}.m4a`,
    `${RNFS.DocumentDirectoryPath}/voicenotes/${baseWithoutNote}.mp4`,

    // ${RNFS.DocumentDirectoryPath}/audio_cache/${fileId} (with or without extension)
    `${RNFS.DocumentDirectoryPath}/audio_cache/${fname}`,
    `${RNFS.DocumentDirectoryPath}/audio_cache/${baseName}.m4a`,
    `${RNFS.DocumentDirectoryPath}/audio_cache/${baseName}.mp4`,
    `${RNFS.DocumentDirectoryPath}/audio_cache/${baseName}`,
    `${RNFS.DocumentDirectoryPath}/audio_cache/note_${fname}`,
    `${RNFS.DocumentDirectoryPath}/audio_cache/note_${baseName}.m4a`,
    `${RNFS.DocumentDirectoryPath}/audio_cache/note_${baseName}.mp4`,
  ];

  const checked = new Set<string>();
  for (const p of candidatePaths) {
    if (!p || checked.has(p)) continue;
    checked.add(p);
    try {
      if (await RNFS.exists(p)) {
        return p;
      }
    } catch {}
  }

  // File does not exist locally — return null immediately without attempting cloud access
  return null;
};

export const playAudioNote = async (fileId: string): Promise<string | null> => {
  return resolveLocalAudioNotePath(fileId);
};

