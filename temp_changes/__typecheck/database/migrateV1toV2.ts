import { getChunk, saveChunk, saveManifestLocal } from './localDB';
import { getVersePage } from './quranData';

export const migrateBlobToV2 = async (studentId: string, blob: any, textStyle: string) => {
  for (const [canvasKey, v] of Object.entries(blob.drawings || {}) as Array<[string, any]>) {
    if (v && v.paths && v.paths.length > 0) await saveChunk(studentId, canvasKey, { strokes: v.paths }, 1);
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
  await saveManifestLocal(studentId, {
    schemaVersion: 3, v: 1,
    pages: {}, bookmarks: blob.bookmarks || {}, audioNotes: {}, lastRead: blob.lastRead || null,
  });
};
