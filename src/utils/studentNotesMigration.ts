/**
 * FILE: src/utils/studentNotesMigration.ts
 * ROLE: One-time migration/cleanup for existing student accounts to prune unresolvable
 *       legacy cloud audio notes that do not exist locally on device.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveLocalAudioNotePath } from '../api/audioNotes';
import { getDB, saveChunk } from '../database/localDB';

export const cleanupLegacyAudioNotesForStudent = async (
  studentId: string,
  notes: Record<string, string>,
): Promise<Record<string, string> | null> => {
  if (!studentId || !notes || Object.keys(notes).length === 0) {
    return null;
  }

  const migrationKey = `@audio_notes_cleaned_v1_${studentId}`;
  try {
    const alreadyMigrated = await AsyncStorage.getItem(migrationKey);
    if (alreadyMigrated === 'true') {
      return null;
    }
  } catch {}

  let hasChanges = false;
  const cleanedNotes: Record<string, string> = {};

  for (const [verseKey, rawValue] of Object.entries(notes)) {
    if (!rawValue) continue;
    const lines = rawValue.split('\n').filter((l) => l.trim().length > 0);
    const validLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('audio:')) {
        const fileId = line.replace('audio:', '').trim();
        const localPath = await resolveLocalAudioNotePath(fileId);
        if (localPath) {
          validLines.push(line);
        } else {
          // Unplayable cloud ghost audio note! Drop it.
          hasChanges = true;
        }
      } else {
        validLines.push(line);
      }
    }

    if (validLines.length > 0) {
      cleanedNotes[verseKey] = validLines.join('\n');
    } else {
      // Verse note had ONLY an unplayable audio note; now empty!
      hasChanges = true;
    }
  }

  // If notes were modified, clean them in SQLite student_data_cache too
  if (hasChanges) {
    try {
      const db = getDB();
      const r = await db.executeSql(
        `SELECT canvasKey, data, v FROM student_data_cache WHERE studentId=?`,
        [studentId],
      );
      if (r && r[0] && r[0].rows) {
        for (let i = 0; i < r[0].rows.length; i++) {
          const row = r[0].rows.item(i);
          let chunkData: any;
          try {
            chunkData = JSON.parse(row.data);
          } catch {
            continue;
          }
          if (chunkData && chunkData.notes) {
            let chunkChanged = false;
            for (const vKey of Object.keys(chunkData.notes)) {
              if (cleanedNotes[vKey] === undefined) {
                delete chunkData.notes[vKey];
                chunkChanged = true;
              } else if (chunkData.notes[vKey] !== cleanedNotes[vKey]) {
                chunkData.notes[vKey] = cleanedNotes[vKey];
                chunkChanged = true;
              }
            }
            if (chunkChanged) {
              await saveChunk(studentId, row.canvasKey, chunkData, (row.v || 0) + 1, false);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to update student_data_cache during notes cleanup', e);
    }
  }

  try {
    await AsyncStorage.setItem(migrationKey, 'true');
  } catch {}

  return hasChanges ? cleanedNotes : null;
};
