/**
 * FILE: src/database/migrateV1toV2.ts
 * ROLE: One-way migration of a legacy v1 student blob (drawings/highlights/
 *       notes/bookmarks/lastRead) into the v2+ chunked store (student_data_cache
 *       + student_manifest_cache).
 * DEPENDS ON: src/database/localDB.ts (getChunk, saveChunk, getManifest,
 *             saveManifestLocal); src/database/quranData.ts (getVersePage).
 * NOTES:
 *   - IDEMPOTENCY: every write is merge-based (INSERT OR REPLACE with existing
 *     chunk data preserved, manifest merged instead of replaced), so running
 *     the migration twice — or re-running after a mid-run failure — cannot lose
 *     data. The manifest is written LAST, so a failed run leaves the student
 *     partially migrated but re-runnable.
 *   - FAILURE MODE: errors propagate to the caller (fail-fast); because chunks
 *     are merged, an aborted run never corrupts and the manifest is only
 *     written once every key succeeded.
 */
import { getChunk, saveChunk, saveManifestLocal, getManifest } from './localDB';
import { getVersePage } from './quranData';

export const migrateBlobToV2 = async (studentId: string, blob: any, textStyle: string) => {
  for (const [canvasKey, v] of Object.entries(blob.drawings || {}) as Array<[string, any]>) {
    if (v && v.paths && v.paths.length > 0) {
      // FIX: merge with the existing chunk (same pattern as localDB
      // saveStudentData) — the old code wrote { strokes } alone, wiping any
      // co-located highlights/notes already stored under this canvasKey
      // (re-migration, or data written between a partial run and its retry).
      const cur = await getChunk(studentId, canvasKey);
      const data = { ...(cur?.data || { strokes: [], highlights: {}, notes: {} }), strokes: v.paths };
      await saveChunk(studentId, canvasKey, data, (cur?.v || 0) + 1);
    }
  }
  const byVerse = async (verseKey: string, section: 'highlights' | 'notes', payload: any) => {
    const [surah, verse] = verseKey.split('_').map(Number);
    if (!surah || !verse) return;
    const page = await getVersePage(surah, verse, textStyle).catch(() => 0);
    const canvasKey = page > 0 ? `page_${page}` : `surah_${surah}`;
    const cur = (await getChunk(studentId, canvasKey)) || { data: { strokes: [], highlights: {}, notes: {} }, v: 0 };
    cur.data[section] = { ...(cur.data[section] || {}), [verseKey]: payload };
    await saveChunk(studentId, canvasKey, cur.data, cur.v + 1);
  };
  for (const [vk, data] of Object.entries(blob.highlights || {})) await byVerse(vk, 'highlights', data);
  for (const [vk, text] of Object.entries(blob.notes || {})) { if (text) await byVerse(vk, 'notes', text); }
  // FIX: merge with the existing manifest instead of hardcoding v:1 and empty
  // pages/audioNotes — the old code REPLACED the manifest wholesale, which on a
  // re-run reset v (breaking the monotonic version the sync engine relies on)
  // and dropped pages/audioNotes the student had accumulated post-migration.
  const existing = await getManifest(studentId);
  await saveManifestLocal(studentId, {
    schemaVersion: 3,
    v: (existing.data.v || 0) + 1,
    pages: existing.data.pages || {},
    bookmarks: (blob.bookmarks && Object.keys(blob.bookmarks).length > 0) ? blob.bookmarks : (existing.data.bookmarks || {}),
    audioNotes: existing.data.audioNotes || {},
    lastRead: blob.lastRead || existing.data.lastRead || null,
  });
};
