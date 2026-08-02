export const GUTTER = 12;
export const SPLIT_MIN_WIDTH = 768;

export const pairIndexForPage = (p: number): number => (p <= 1 ? 0 : Math.floor(p / 2));

export const anchorFromIndex = (i: number): number => (i === 0 ? 1 : 2 * i);

export const pagePairsFor = (totalPages: number): (number | null)[][] => {
  const out: (number | null)[][] = [[1]];
  for (let i = 1; i <= Math.floor(totalPages / 2); i++) {
    const even = 2 * i;
    const odd = even + 1 > totalPages ? null : even + 1;
    out.push([even, odd]);
  }
  return out;
};
