import storage from '@react-native-firebase/storage';
import RNFS from 'react-native-fs';
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
 * The row write is serialized per (studentId, rangeKey): two concurrent saves of
 * the SAME range would otherwise both read the old row and the second write
 * would silently drop the first entry.
 */
// Promise chain per (student, range) — serializes the read-modify-write on
// audio_notes_cache rows; errors do not poison the chain (each caller gets its
// own rejection), and the queue entry drops itself after settling.
const rangeWriteQueues: Record<string, Promise<void> | undefined> = {};
const enqueueRangeWrite = <T>(key: string, fn: () => Promise<T>): Promise<T> => {
  const prev = rangeWriteQueues[key];
  const next = (prev || Promise.resolve()).then(fn, fn);
  const guard = next.then(
    () => undefined,
    () => undefined,
  );
  rangeWriteQueues[key] = guard;
  guard.then(() => { if (rangeWriteQueues[key] === guard) delete rangeWriteQueues[key]; });
  return next;
};

export const registerAudioNote = async (studentId: string, verseKey: string, fileId: string, ms: number, page?: number) => {
  await migrateLegacyAudioNotes(studentId);
  const [s, v] = verseKey.split('_').map(Number);
  const rangeKey = page && page > 0 ? rangeKeyForPage(page) : await rangeKeyForVerse(verseKey);
  await enqueueRangeWrite(`${studentId}|${rangeKey}`, async () => {
    const cur = await getAudioNotesRange(studentId, rangeKey);
    const entries = { ...(cur.entries || {}), [fileId]: { storagePath: `audio_notes/${fileId}.m4a`, surah: s, ayah: v, page: page || 0, durationMs: ms, sizeBytes: 0 } };
    await saveAudioNotesRange(studentId, rangeKey, entries, cur.v + 1, true);
  });
};

// NOTE CACHE lives under DocumentDirectoryPath/audio_cache — the same root as the
// playback engine's ayah cache (audioPlayback.ts CACHE_ROOT); ayah MP3s keep their
// own subdir so a playback cache wipe never touches downloaded notes. The download
// happens ONLY when playAudioNote is called (never at register/import time).
// In-flight dedup: two taps on the same note share ONE download, so a second
// downloadFile can't clobber the first toFile mid-write. Failed or partial
// downloads are unlinked, so a corrupt file is never served from cache later.
const noteDownloadsInFlight: Record<string, Promise<string | null>> = {};

export const playAudioNote = async (fileId: string): Promise<string | null> => {
  if (noteDownloadsInFlight[fileId]) return noteDownloadsInFlight[fileId];
  const cachePath = `${RNFS.DocumentDirectoryPath}/audio_cache/${fileId}.m4a`;
  const dir = `${RNFS.DocumentDirectoryPath}/audio_cache`;
  const task = (async (): Promise<string | null> => {
    try {
      if (await RNFS.exists(cachePath)) return cachePath;
      const url = await storage().ref(`audio_notes/${fileId}.m4a`).getDownloadURL();
      if (!(await RNFS.exists(dir))) {
        try { await RNFS.mkdir(dir); } catch {}
      }
      const res = await RNFS.downloadFile({ fromUrl: url, toFile: cachePath }).promise;
      if (res.statusCode < 200 || res.statusCode >= 300) {
        try { await RNFS.unlink(cachePath); } catch {}
        return null;
      }
      return cachePath;
    } catch {
      try { await RNFS.unlink(cachePath); } catch {}
      return null;
    }
  })();
  noteDownloadsInFlight[fileId] = task;
  task.finally(() => { if (noteDownloadsInFlight[fileId] === task) delete noteDownloadsInFlight[fileId]; });
  return task;
};
