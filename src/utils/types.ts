export interface Verse {
  id: number; surahId: number; verseNumber: number;
  textArabic: string; textIndopak?: string; textTranslation?: string;
  page?: number; juz?: number;
}
export interface Surah {
  id: number; name: string; englishName: string;
  englishNameTranslation: string; numberOfAyahs: number; revelationType: string;
}
export interface Highlight { id: string; wordIndex: number; color: string; createdAt: string; }
export interface Bookmark { surah: number; verse: number; createdAt: string; }
export interface DrawingPath {
  points: string[]; color: string; width: number; opacity: number;
  tool: 'pen' | 'eraser' | 'underline'; style?: 'straight' | 'wavy' | 'double';
}
export interface StudentData {
  bookmarks: Record<string, Bookmark>;
  highlights: Record<string, { highlights: Highlight[] }>;
  drawings: Record<string, { paths: DrawingPath[]; updatedAt: string }>;
  notes: Record<string, string>;
  lastRead: { surah: number; verse: number } | null;
  updatedAt?: string;
}
export interface Student { id: string; name: string; createdAt?: string; }
export interface MushafWord { word: string; location: string; }
export interface MushafLine { type: 'text' | 'surah-header' | 'basmala'; text?: string; words?: MushafWord[]; }
export interface MushafPage { page: number; lines: MushafLine[]; }
export interface AuthResponse { success: boolean; error?: string; uid?: string; }
export interface StudentResponse { success: boolean; error?: string; students?: Student[]; studentId?: string; }
export interface SyncResponse { success: boolean; error?: string; synced?: number; failed?: number; }
export type QuranViewParams = { surahId?: number; scrollToVerse?: number; };
