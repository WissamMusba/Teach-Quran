/**
 * FILE: src/utils/mushafLayout.ts
 * ROLE: Split-view (two-page spread) geometry helpers — the only module for the tablet spread math used by QuranViewScreen's page-mode FlatList.
 * DEPENDS ON: nothing (pure functions + two constants).
 * USED BY: QuranViewScreen.tsx (GUTTER, SPLIT_MIN_WIDTH, pairIndexForPage, anchorFromIndex, pagePairsFor); SettingsScreen.tsx (SPLIT_MIN_WIDTH).
 * NOTES: The pair model is why page-mode scroll targets are index-based in split mode (scrollToIndex index = pairIndexForPage(page)) while single mode is offset-based (offset = (page-1)*winW). Keep the two mappings in sync with each other.
 */

// GUTTER = 12 — px gap between the two halves of a spread; subtracted in QuranViewScreen's pageW = (winW - GUTTER)/2.
export const GUTTER = 12;
// SPLIT_MIN_WIDTH = 768 (dp) — below this width the app NEVER shows spreads (splitOn = settings.mushafSplit && winW >= SPLIT_MIN_WIDTH), and SettingsScreen hides the Spread switch entirely.
export const SPLIT_MIN_WIDTH = 768;

// WHAT: Maps a real page number to its FlatList index: p <= 1 -> 0 (page 1 is a lone right page), else floor(p/2).
// CALLED BY: QuranViewScreen scroll math — onMomentumScrollEnd, handleSelectPage, deep-link, scroll-sync.
// AFFECTS: Which FlatList item (spread pair) is scrolled to.
// NOTES: Math verified for the whole range — p=2..3 -> 1 (pair [2,3]), p=604 -> 302 (last pair [604, null]), p=610 -> 305 (last Indopak pair [610, null]). No off-by-one at the edges.
export const pairIndexForPage = (p: number): number => (p <= 1 ? 0 : Math.floor(p / 2));

// WHAT: Inverse of pairIndexForPage: index 0 -> page 1, else 2*i (the left page of the pair).
// CALLED BY: QuranViewScreen onMomentumScrollEnd — converts the scrolled FlatList index back to a page number for header/cache/drawing keys.
// AFFECTS: currentPageNum after a spread swipe.
// NOTES: Deliberately anchors spreads to their EVEN page (index i -> 2*i), so an odd page lands on
//        the same index as the even page of its pair — currentPageNum snaps to the even page.
export const anchorFromIndex = (i: number): number => (i === 0 ? 1 : 2 * i);

// WHAT: Builds the FlatList data for split mode: [[1], [2,3], [4,5], ..., [lastEven, lastOdd|null]] — page 1 alone, then pairs, with null padding for an odd final page.
// FLOW: loop i=1..floor(total/2); odd = even+1 clamped to null when it exceeds totalPages.
// CALLED BY: QuranViewScreen (pageNumbers -> pagePairsFor(pageNumbers.length) when splitOn, feeding the page-mode FlatList data).
// AFFECTS: Page-mode FlatList item count/layout in split mode; SpreadItem renders the two MushafPageViews side by side per pair.
// NOTES: Edge cases verified — total=1 -> [[1]] (loop skipped); total=2 -> [[1],[2,null]]; total=604
//        -> 303 items ending [604, null]; total=610 -> 306 items ending [610, null]. The lone final
//        even page sits in the pair's even slot (consistent with the lone page-1 slot), and
//        SpreadItem renders a null slot as an empty half, so no null page is ever rendered as text.
export const pagePairsFor = (totalPages: number): (number | null)[][] => {
  const out: (number | null)[][] = [[1]];
  for (let i = 1; i <= Math.floor(totalPages / 2); i++) {
    const even = 2 * i;
    const odd = even + 1 > totalPages ? null : even + 1;
    out.push([even, odd]);
  }
  return out;
};
