import storage from '@react-native-firebase/storage';
import { getManifest, saveManifestLocal } from '../database/localDB';

export const uploadAudioNote = async (localPath: string): Promise<string> => {
  const fileId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const ref = storage().ref(`audio_notes/${fileId}.m4a`);
  await ref.putFile(localPath, { contentType: 'audio/mp4' });
  return fileId;
};

export const registerAudioNote = async (studentId: string, verseKey: string, fileId: string, ms: number) => {
  const m = await getManifest(studentId);
  m.data.audioNotes = { ...(m.data.audioNotes || {}), [fileId]: { storagePath: `audio_notes/${fileId}.m4a`, surah: Number(verseKey.split('_')[0]), ayah: Number(verseKey.split('_')[1]), durationMs: ms, sizeBytes: 0 } };
  m.data.v = (m.data.v || 1) + 1;
  await saveManifestLocal(studentId, m.data);
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
