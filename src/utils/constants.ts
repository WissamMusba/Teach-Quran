export const DRAWING_COLORS = [
  { id: 'red', name: 'Red', hex: '#FF0000' },
  { id: 'blue', name: 'Blue', hex: '#0066FF' },
  { id: 'green', name: 'Green', hex: '#00CC00' },
  { id: 'yellow', name: 'Yellow', hex: '#FFD700' },
  { id: 'black', name: 'Black', hex: '#000000' }
];
export const FONT_SIZES = { small: 22, medium: 26, large: 30, xl: 36 };
export const WORD_TAP_FRACTION = 0.5;
export const SYNC_INTERVAL = 5 * 60 * 1000;
export const MISTAKE_COLOR = '#FF3B30';
export const MISTAKE_HIGHLIGHT: { borderBottomWidth: number; borderBottomColor: string; backgroundColor: string } = {
  borderBottomWidth: 3,
  borderBottomColor: MISTAKE_COLOR,
  backgroundColor: `${MISTAKE_COLOR}AA`,
};
const cleanWordCache = new Map<string, string>();
const CLEAN_WORD_CACHE_MAX = 2000;
export const cleanQuranWord = (w: string) => {
  const cached = cleanWordCache.get(w);
  if (cached !== undefined) return cached;
  const result = (w || '').replace(/[\u06DD\u06DE\uFD3E\uFD3F]/gu, '');
  if (cleanWordCache.size >= CLEAN_WORD_CACHE_MAX) cleanWordCache.delete(cleanWordCache.keys().next().value);
  cleanWordCache.set(w, result);
  return result;
};