/**
 * FILE: src/utils/format.ts
 * ROLE: Shared date/time + juz formatting helpers used by the list screens
 *       (Bookmarks, Mistakes, Notes, Dashboard) so every card renders the same
 *       "Date: 6 Aug 2026 / Time: 4:05 PM" style. Also includes a Firestore
 *       timestamp normalizer for the student list cache.
 * DEPENDS ON: src/utils/theme.ts (JUZ_MAP).
 * USED BY: BookmarksScreen, MistakesScreen, NotesScreen, DashboardScreen.
 */
import { JUZ_MAP } from './theme';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** "6 Aug 2026" ('' for falsy input). */
export const formatDate = (ts?: string | number | null): string => {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

/** "4:05 PM" (12-hour clock) from a timestamp; '' for falsy/unparseable input. */
export const formatTime = (ts?: string | number | null): string => {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
};

/**
 * Normalizes any timestamp-ish value (milliseconds int, ISO string, or a
 * Firestore Timestamp object as stored in the SQLite list cache) to epoch ms.
 * Returns 0 for unknown shapes.
 */
export const toMillis = (v: any): number => {
  if (!v) return 0;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const t = Date.parse(v); return isNaN(t) ? 0 : t; }
  if (typeof v?.toMillis === 'function') return v.toMillis();
  if (typeof v?._seconds === 'number') return v._seconds * 1000 + Math.floor((v._nanoseconds || 0) / 1e6);
  if (typeof v?.seconds === 'number') return v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6);
  return 0;
};

/** 1-30: the juz containing a given surah+verse (linear scan of JUZ_MAP). */
export const getJuzForVerse = (surahId: number, verseNum: number): number => {
  let juz = 1;
  for (const entry of JUZ_MAP) {
    if (entry.s < surahId || (entry.s === surahId && entry.v <= verseNum)) juz = entry.j;
  }
  return juz;
};