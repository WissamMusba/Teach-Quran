/**
 * FILE: src/components/quran/MushafPageView.tsx
 * ROLE: Full-page mushaf renderer: lays out page lines right-to-left word-by-word, hides PUA
 *       verse-end markers, measures words and scale-shrinks overflowing lines, and persists/
 *       replays a per-page per-font layout cache (SQLite page_layout_cache).
 * DEPENDS ON: src/utils/responsive.ts (getMushafFontSize/LineHeight), src/utils/constants.ts
 *             (WORD_TAP_FRACTION, MISTAKE_HIGHLIGHT), src/utils/theme.ts (getArabicFont,
 *             getJuzInfoFromPage), src/database/localDB.ts (get/savePageLayoutCache),
 *             ../common/WordHitArea, ./OrnamentalFrame, react-redux (settings/quran slices)
 * USED BY: QuranViewScreen.tsx — SpreadItem (split/two-page mode) and single-page renderItem
 */

import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Pressable } from 'react-native';
import { getMushafFontSize, getMushafLineHeight } from '../../utils/responsive';
import { WORD_TAP_FRACTION, MISTAKE_HIGHLIGHT } from '../../utils/constants';
import WordHitArea from '../common/WordHitArea';
import OrnamentalFrame, { frameInsetFor } from './OrnamentalFrame';
import Svg, { Path } from 'react-native-svg';
import { textInsetFor } from '../../utils/mushafLayout';
import { getPageLayoutCache, savePageLayoutCache, preloadPageLayoutCacheRange } from '../../database/localDB';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
// Cache-key version bump: old rows were persisted from PARTIAL (under-counted) widths and cause
// overflow on reload. Bump the number to invalidate stale rows app-wide; one clean re-measure
// rewrites them. Must be added identically at EVERY get/save call site.
const CACHE_VERSION = 2;
import { getArabicFont, getJuzInfoFromPage } from '../../utils/theme';
import { useSelector } from 'react-redux';

// PUA (Private-Use-Area, U+E000-U+F8FF) glyph handling: QPC mushaf fonts encode decorative
// verse-number circle glyphs in the PUA; standard fonts render them as tofu. stripPua() removes
// them via a FIFO memo cache keyed by exact input string (bounded at PUA_CACHE_MAX 2000);
// hasArabicLetters() then tells real words (PUA embedded mid-word) from verse-end markers
// (PUA-only), which must be hidden instead of rendered.
const puaCache = new Map<string, string>();
const PUA_CACHE_MAX = 2000;
/**
 * stripPua(t) — strips PUA glyphs from a word string, with a memo cache.
 * FLOW: 1) puaCache lookup on the exact input string (hit → return cached);
 *       2) regex-strip all U+E000-U+F8FF chars from (t || '') — the '' guard covers undefined
 *          word.word; 3) evict the oldest entry (first-inserted key — Map insertion order makes
 *          eviction FIFO) when size >= PUA_CACHE_MAX, then store.
 * CALLED BY: isVerseEndMarker decision, WordHitArea expected-count filter, cache-completion
 *            totalLines, and every word render below. Never touches the DB.
 * NOTES: runs on every render but is cached by exact input string — fine for a bounded cache.
 */
const stripPua = (t: string) => {
  const cached = puaCache.get(t);
  if (cached !== undefined) return cached;
  const result = (t || '').replace(/[\uE000-\uF8FF]/g, '');
  if (puaCache.size >= PUA_CACHE_MAX) puaCache.delete(puaCache.keys().next().value);
  puaCache.set(t, result);
  return result;
};
/**
 * hasArabicLetters(t) — true when t contains any real Arabic letter
 * (U+0621-U+064A, U+0671-U+06D3, U+06D5, U+06FA-U+06FC, U+0750-U+077F, U+08A0-U+08FF).
 * PUA-only strings (verse-end markers) return false → hidden; strings with PUA embedded mid-word
 * return true → rendered with the PUA stripped.
 */
const hasArabicLetters = (t: string) => /[\u0621-\u064A\u0671-\u06D3\u06D5\u06FA-\u06FC\u0750-\u077F\u08A0-\u08FF]/u.test(t);

// Sparse-page heuristic: pages with fewer than SPARSE_WORD_THRESHOLD (50) words get
// SPARSE_FONT_BOOST (1.3x) applied to fontSize AND lineHeight, plus space-around justification
// at the line level — typically short surah-opening pages that would otherwise look lost.
const SPARSE_WORD_THRESHOLD = 50;
const SPARSE_FONT_BOOST = 1.3;

/**
 * getFontAdj(ts, hv) — per-font size/vertical-offset corrections so each mushaf font sits at
 * the right visual height. switch: saleem +2, alqalam/uthmani +0, lateef +4, scheherazade
 * -1 when the header is visible, default +0. The size feeds fs (and thus the layout cache
 * key) and the word Text translateY transform (transform array only when adj.y is non-zero).
 * NOTES: hardcoded tuning values — a rebuild could move this into theme.ts.
 * y is 0 for ALL fonts: the old ~3px upward lift is gone; top/bottom balance now comes
 * from the container's percent-based padding (padTop/padBottom = 2.5% of screen height,
 * padSide = 6.7% of page width — floored at frameInsetFor so text never crosses the frame).
 */
const getFontAdj = (ts: string, hv: boolean) => {
  switch (ts) {
    case 'saleem': return { size: 2, y: 0 };
    case 'alqalam': return { size: 0, y: 0 };
    case 'uthmani': return { size: 0, y: 0 };
    case 'lateef': return { size: 4, y: 0 };
    case 'scheherazade': return { size: hv ? -1 : 0, y: 0 };
    default: return { size: 0, y: 0 };
  }
};

/**
 * layoutFsFor / layoutKeyFs — the fs value that rounds into the page_layout_cache key for a
 * (textStyle, headerVisible, sparse) triple: (mushaf size + font adj) x the sparse boost.
 * The headerVisible variant is NOT a separate cache column usage (DB column stays at the
 * legacy false everywhere) — the header shift lands in fs itself, so preloading BOTH header
 * variants means the layout row for each state is ready the moment the header toggles.
 */
const layoutFsFor = (textStyle: string, headerVisible: boolean, sparse: boolean) =>
  Math.round((getMushafFontSize(headerVisible) + getFontAdj(textStyle, headerVisible).size) * (sparse ? SPARSE_FONT_BOOST : 1));
const layoutKeyFs = (textStyle: string, headerVisible: boolean, sparse: boolean) => layoutFsFor(textStyle, headerVisible, sparse) + CACHE_VERSION;

/**
 * warmPageLayoutFor — preloads BOTH header variants' layout rows (mem + SQLite range query) for
 * ONE page, for the mushaf + width + sparse pairing of that page. Called by the QuranView
 * progressive page-warm pipeline for far-ahead pages whose MushafPageView has not mounted yet,
 * so the frame renders the moment they scroll into view regardless of header state.
 * CALLS: preloadPageLayoutCacheRange (localDB) x2 (header shown/header hidden).
 * AFFECTS: layoutCacheMem + page_layout_cache read caching (no writes).
 */
export const warmPageLayoutFor = (pageNum: number, pageData: any, textStyle: string, pageWidth: number) => {
  try {
    const totalWords = Array.isArray(pageData?.lines)
      ? pageData.lines.reduce((a: number, l: any) => a + (l.words ? l.words.length : 0), 0)
      : 0;
    const sparse = totalWords < SPARSE_WORD_THRESHOLD;
    const keySparse = sparse ? 1 : 0;
    const keyW = Math.round(pageWidth);
    preloadPageLayoutCacheRange(pageNum, pageNum, textStyle, false, layoutKeyFs(textStyle, true, sparse), keySparse, keyW);
    preloadPageLayoutCacheRange(pageNum, pageNum, textStyle, false, layoutKeyFs(textStyle, false, sparse), keySparse, keyW);
  } catch { /* best-effort */ }
};

// Reading-mark bookmark glyph — small outline bookmark; filled when the reading mark is set.
// Defined HERE (module level) on purpose: MushafPageView must not import from QuranViewScreen
// (that would be a circular import), so its icon cannot come from the parent.
const BookmarkIcon = ({ c, s = 18, filled = false }: { c: string; s?: number; filled?: boolean }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill={filled ? c : 'none'} stroke={c}>
    <Path d="M7 3h10v18l-5-3.6L7 21V3z" />
  </Svg>
);

/**
 * computeLineExtra(line, lineIdx, pageData, notes) — extra horizontal px a line needs beyond raw
 * word widths: +28 per verse boundary inside the line, +14 more when that verse has a note.
 * FLOW: for each word parse location "surah:verse[:wordPos]"; a word ends a verse when the next
 *       word's verse differs, else the next line's first word differs, else true for the last
 *       line of the page.
 * CALLED BY: the per-line render IIFE below — executes during render, writes
 *            lineExtraRef.current[lineIdx].
 * AFFECTS: the overflow math in handleWordMeasured and the scale in scaleForLine; NOT persisted
 *          in the layout cache (notes can change, so extra is re-derived live per render).
 * NOTES: the boundary rule is duplicated by the isVerseBoundary logic in the word render below —
 *        two implementations of one rule, keep them in sync.
 */
const computeLineExtra = (line: any, lineIdx: number, pageData: any, notes: any) => {
  let extra = 0;
  (line.words || []).forEach((w: any, i: number) => {
    const loc = (w.location || ':').split(':');
    const verseNum = parseInt(loc[1] || '0', 10);
    const next = line.words[i + 1];
    let boundary = false;
    if (next && next.location) boundary = parseInt(next.location.split(':')[1], 10) !== verseNum;
    else {
      const nl = pageData?.lines?.[lineIdx + 1];
      if (nl && nl.words && nl.words.length > 0) boundary = parseInt((nl.words[0].location || ':').split(':')[1] || '0', 10) !== verseNum;
      else boundary = true;
    }
    if (!boundary) return;
    extra += 28;
    if (notes?.[`${loc[0] || '0'}_${verseNum}`]) extra += 14;
  });
  return extra;
};

/**
 * MushafPageView — full-page mushaf renderer; orchestrates the measure-then-scale mechanism
 * and the layout-cache pipeline.
 * FLOW:
 *   1. Derive per-font colors/size from redux (textStyle, nightMode, textBrightness).
 *   2. Sparse-page boost when total words < SPARSE_WORD_THRESHOLD.
 *   3. Reset effect clears all measurement refs + lineScale + cacheState('loading') when
 *      pageNum/textStyle/pageWidth/fixNonce change (headerVisible is NOT among the deps — see
 *      NOTES). Cache-load effect then async-reads the page_layout_cache row keyed by
 *      (pageNum, textStyle, headerVisible=false, fs, sparse, rounded pageWidth); headerVisible
 *      is hardcoded false at BOTH the get and save call sites, so header toggling does not
 *      invalidate the cache (it still shifts fs, which IS in the cache key).
 *   4. Render gate: cacheState 'loading' → empty container; no measurement starts before the
 *      cache verdict arrives.
 *   5. Lines render row-reverse RTL: per word stripPua → isVerseEndMarker? badge-only fragment :
 *      WordHitArea (onMeasured → handleWordMeasured) wrapping a Text scaled by scaleForLine().
 *   6. overlayLayer (frame + juz/surah/page badges, pointerEvents="none") + actionPills append.
 *
 * Props (all `any`-typed, mostly optional):
 *   - headerVisible (default true) — feeds getMushafFontSize/getMushafLineHeight; hides the
 *     juz/surah/page badges + actionPills when false. Layout cache ignores it (see FLOW 3).
 *   - pageNum (default 0) — cache key + juz badge lookup; 0 → no juz/page badges.
 *   - pageWidth (default SCREEN_WIDTH) — layout width; rounded into the cache key
 *     (half-screen width in split/two-page mode).
 *   - surahNames — map id → name for the surah pill (redux quran.surahNames).
 *   - versesForPage — fallback verse rows (pageVersesCache) used only when pageData is missing.
 *   - pageData — mushaf page object { lines: [{type, words:[{word, location}]}] }.
 *   - highlights — { "surah_verse": { highlights: [{wordIndex,...}] } } → mistake underlines.
 *   - onWordPress(verseNum, wordPos) — word tap → toggle mistake highlight.
 *   - onVerseLongPress(verseNum, pageY) — verse action menu (parent handleVerseLongPress).
 *   - onBookmarkToggle(verseNum, surahId) — bookmark toggle; kept as the LEGACY fallback
 *     for the verse badge when onBadgePress is not provided.
 *   - onBadgePress(verseNum, pageY?) — verse BADGE tap → opens the SAME verse action menu
 *     as long-press (parent handleVerseLongPress), instead of auto-bookmarking.
 *     pageY comes from the press event; undefined → menu's centered-overlay mode.
 *   - bookmarks, notes, readingMarkVerse, flashingVerseKey — per-verse badge state.
 *   - onDeadTap(pageY) — tap on line background/word margins → toggle header.
 *   - fixNonce (default 0) — bump to force full re-measure + cache reload (recovery path;
 *     no longer exposed as UI — the "Fix font" pill was removed).
 *   - onSpread / spread — tablet spread-mode toggle pill (split mode only).
 * CALLED BY: QuranViewScreen.tsx — SpreadItem (split/two-page mode) and single-page renderItem.
 * NOTES:
 *   - memo() export is largely ineffective: pageData/highlights/bookmarks/notes prop identities
 *     change on parent re-renders; versesForPage comes from a state cache so it stays stable.
 *   - verseByKey (below) is DEAD CODE — built from versesForPage but never referenced.
 *   - Cache-hit sums can UNDER-COUNT overflowed lines: once a line gets scaled, later word
 *     measurements for it early-return, so the persisted sum for that line is partial; restored
 *     scales on a cache hit may differ from first-visit ones until the cache entry is cleared.
  *   - headerVisible is absent from BOTH effect dep arrays: getMushafFontSize returns the SAME
  *     size for both header states (responsive.ts), so fs (cache key) never shifts on a header
  *     toggle — both states share one layout row. If the size bump is ever re-added, cache-hit
  *     scales would under-shrink the hidden-header variant and text would spill into the frame
  *     (see the note in responsive.ts).
  *   - The vertical fit (pitchScale/fontScale) is render-time only: derived from the measured
  *     innerH, applied inline to the word Text, and never part of fs — so it cannot invalidate
  *     cached rows or interact with the header-shared layout key.
 *   - maxFontSizeMultiplier={1} on word/fallback Text — the app owns font scaling; the OS must
 *     not re-inflate text sizes.
 */
const MushafPageView = ({ headerVisible = true, pageNum = 0, pageWidth = SCREEN_WIDTH, surahNames = {}, versesForPage, pageData, highlights, onWordPress, onVerseLongPress, onBookmarkToggle, onBadgePress, bookmarks, flashingVerseKey, notes, readingMarkVerse, onDeadTap, fixNonce = 0, onSpread, spread, showReadingMarkBtn = false, readingMarkActive = false, onReadingMarkToggle = undefined }: any) => {
  const nightMode = useSelector((s: any) => s.settings.nightMode);
  const textBrightness = useSelector((s: any) => s.settings.textBrightness);
  const textStyle = useSelector((s: any) => s.quran.textStyle);
  const fontFamily = getArabicFont(textStyle);
  const textColor = nightMode ? `rgba(255, 255, 255, ${textBrightness/255})` : `rgba(0, 0, 0, ${textBrightness/255})`;
  const lineColor = nightMode ? '#2a2a2a' : '#e0e0e0';
  
  const firstWord = pageData?.lines?.find((l: any) => l.words?.length > 0)?.words?.[0];
  const firstSurahId = firstWord?.location ? parseInt(firstWord.location.split(':')[0], 10) : 0;
  const juzInfo = pageNum > 0 ? getJuzInfoFromPage(pageNum) : { juz: 0, pagesLeft: 0 };
  const grayC = nightMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';
  const frameC = nightMode ? 'rgba(123,167,219,0.35)' : 'rgba(28,61,114,0.35)';
  const badgeBg = nightMode ? 'rgba(18,18,20,0.85)' : 'rgba(255,255,255,0.88)';
const mushafFontSize = getMushafFontSize(headerVisible);
  const mushafLineHeight = getMushafLineHeight(headerVisible);
  /**
   * getFontAdj (module-level) — see above; adj.y feeds the translateY transform below.
   */
  const adj = getFontAdj(textStyle, headerVisible);
  // Header-visible descender clearance: with the header showing, the page box is shorter and
  // the pitch squeeze (pitchScale) keeps the line stack inside it, so the QPC fonts' descenders
  // poke below the line box and get visually clipped. Lifting every word 2px up keeps the tails
  // visible; no header → no lift (layout position unchanged either way — pure visual transform).
  const wordLiftY = adj.y + (headerVisible ? -2 : 0);
  const compact = pageWidth < 600;

  // User-specified padding (percent-based): top/bottom = 2.5% of the SCREEN HEIGHT, left/right =
  // 6.7% of the PAGE WIDTH (textInsetFor, shared with stroke.ts for drawing registration). Each
  // is floored at frameInsetFor(pageWidth) so the text always stays strictly inside the frame's
  // inner text box (never under the pattern band or its rules).
  const padTop = Math.max(0.025 * SCREEN_HEIGHT, frameInsetFor(pageWidth));
  const padBottom = padTop;
  const padSide = textInsetFor(pageWidth);

  // Sparse-page detection: count words across pageData lines (else whitespace-split fallback
  // verses); sparse → SPARSE_FONT_BOOST on fontSize AND lineHeight. fs rounds into the layout
  // cache key — any font-size shift (textStyle, header visibility, sparse flag) reloads the row.
  const totalWords = pageData?.lines
    ? pageData.lines.reduce((a: number, l: any) => a + (l.words ? l.words.length : 0), 0)
    : (versesForPage || []).reduce((a: number, v: any) => a + ((v.textArabic || '').trim().split(/\s+/).filter(Boolean).length), 0);
  const sparse = totalWords < SPARSE_WORD_THRESHOLD;
  const fs = layoutFsFor(textStyle, headerVisible, sparse);

  // Measurement + cache state. Refs survive re-renders so measurement progress is never lost:
  //   lineScale (state)      — per-line font multiplier from the measured pass (cache-miss path)
  //   scaleRef                — same multipliers without triggering re-renders (used mid-measure)
  //   widthsRef               — measured word widths per line
  //   lineExtraRef            — live computeLineExtra result per line (re-derived every render)
  //   filledCountRef          — number of words measured so far per line
  //   layoutContentRef        — loaded cache row (number[] of per-line sums); non-null → cache-hit
  //   completedLinesRef       — lines whose measured count reached the expected word count
  //   cacheWrittenRef         — one-shot guard for the completion write-back
  //   cacheState ('loading'|'miss'|'hit') — render gate; 'loading' renders an empty container
  const [lineScale, setLineScale] = useState<Record<number, number>>({});
  const scaleRef = useRef<Record<number, number>>({});
  const widthsRef = useRef<Record<number, (number | undefined)[]>>({});
  const lineExtraRef = useRef<Record<number, number>>({});
  const filledCountRef = useRef<Record<number, number>>({});
  const layoutContentRef = useRef<number[] | null>(null);
  const completedLinesRef = useRef<Set<number>>(new Set());
  const cacheWrittenRef = useRef(false);
  const frozenRef = useRef(false);
  const [cacheState, setCacheState] = useState<'loading' | 'miss' | 'hit'>('loading');
  const [fontReady, setFontReady] = useState(false);
  const [innerH, setInnerH] = useState(0);
  // Vertical box height measurement. CRITICAL: this must fire on the VERY FIRST layout of the
  // mounted view — which happens while the 'loading' GATE is rendered (cache-hit pages swap the
  // gate for the full mushaf at the SAME size, so the full container's own onLayout would never
  // fire and innerH would stay 0 → pitchScale/fontScale 1 → full-size text in the shorter
  // header-visible box → bottom clipped until a header toggle resizes the box). All three
  // containers (fallback,
  // gate, full) therefore share this handler: whichever renders first captures the true height;
  // later resizes (header toggle, player bar mount, rotation) re-fire it because the size changes.
  const onBoxLayout = useCallback((e: any) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h > 0 && h !== innerH) setInnerH(h);
  }, [innerH]);

  // Vertical-fit audit (header-visible worst case): with AnimatedHeader (~64) + AudioPlayerBar
  // (~60) in flow the page box is screenH - 124 - 24 - 28 = screenH - 176 tall. A tall 15-line
  // page at the largest font of its width tier needs 15 x lineHeight: e.g. 375x667 -> 15 x 32
  // = 480 vs (667 - 176) - (17.6 + 17.6) = 455.8 -> OVERFLOW by ~24px; short screens overflow,
  // tall ones fit (412x915 -> 594 <= 693.2). Fix: when the measured inner height (onLayout below)
  // proves it, pitchScale below squeezes the LINE PITCH to fit the stack — the font itself stays
  // full-size until the pitch would fall below PITCH_FLOOR_RATIO (fontScale's only job). The
  // width-fit scale (scaleForLine) is untouched - it handles horizontal overflow from un-scaled
  // widths only.
  const wordLineCount = (pageData?.lines || []).reduce(
    (a: number, l: any) => a + (l.words && l.words.some((w: any) => hasArabicLetters(stripPua(w.word))) ? 1 : 0), 0);
  const fitPadTop = padTop;
  const fitPadBottom = padBottom;
  const fitLineH = mushafLineHeight * (sparse ? SPARSE_FONT_BOOST : 1);
  // Two-factor vertical fit: pitchScale squeezes LINE PITCH only; fontScale
  // keeps the font at full size until the pitch would fall below PITCH_FLOOR_RATIO
  // (glyph-collision prevention) — then both shrink gracefully, so fonts stay big
  // with the header visible and bottoms never clip.
  const naturalRatio = mushafLineHeight / (mushafFontSize + adj.size);
  const PITCH_FLOOR_RATIO = 1.2;
  const needH = wordLineCount * fitLineH;
  const availH = innerH - fitPadTop - fitPadBottom;
  const pitchScale = needH > 0 && availH > 0 ? Math.min(1, Math.max(0.5, availH / needH)) : 1;
  const fontScale = Math.min(1, Math.max(0.5, (pitchScale * naturalRatio) / PITCH_FLOOR_RATIO));

  useEffect(() => {
    let mounted = true;
    setFontReady(false);
    const t = setTimeout(() => { if (mounted) setFontReady(true); }, 150);
    return () => { mounted = false; clearTimeout(t); };
  }, [fontFamily, fixNonce]);

  // DEAD CODE: verseByKey is built from versesForPage but never referenced below.
  // hlMap indexes highlights by "surahId_verseNumber" for per-word mistake lookups.
  const verseByKey = new Map<string, any>();
  if (versesForPage) {
    for (const v of versesForPage) {
      const key = `${v.surahId}_${v.verseNumber}`;
      if (!verseByKey.has(key)) verseByKey.set(key, v);
    }
  }
  const hlMap = new Map<string, any>(Object.entries(highlights || {}));

  // Ta'awwud line placement: a surah begins exactly where a 'surah-header' or 'basmala'
  // marker line appears; Fallback for headerless pages (e.g. At-Tawba): the first line's
  // first word is verse 1 word 1. taawudLineIdx lands on that line so the ta'awwud renders
  // ABOVE the surah-start line (it takes only its own content height — no flex:1 — so verse
  // lines keep their space). Non-interactive, not part of word measurement.
  const taawudLineIdx = (() => {
    const lines = pageData?.lines || [];
    const i = lines.findIndex((l: any) => l.type === 'surah-header' || l.type === 'basmala');
    if (i !== -1) return i;
    const loc = ((lines[0]?.words?.[0]?.location) || '').split(':');
    return (loc.length >= 2 && parseInt(loc[1], 10) === 1 && parseInt(loc[2] || '1', 10) === 1) ? 0 : -1;
  })();

  // Reset effect — a page/font/width/fixNonce change invalidates ALL measurement state and pushes
  // the pipeline back to 'loading' so the next pass starts clean. NOTE: headerVisible is absent
  // from the deps — and must stay absent: the two header states share one fs (responsive.ts) and
  // one layout-cache row, so a toggle is a same-key cache hit, not a re-measure.
  useEffect(() => {
    scaleRef.current = {};
    widthsRef.current = {};
    lineExtraRef.current = {};
    filledCountRef.current = {};
    layoutContentRef.current = null;
    completedLinesRef.current = new Set();
    cacheWrittenRef.current = false;
    frozenRef.current = false;
    setLineScale({});
    setCacheState('loading');
  }, [pageNum, textStyle, pageWidth, fixNonce]);

  // Cache-load effect — reads the layout sums WITHOUT waiting for fontReady: the DB/mem read
  // does not need the font (only the measure pass does), so a cache-hit page renders the moment
  // it mounts instead of after the 150ms font gate. Fire-and-forget preload warms 3 behind /
  // 7+ ahead pages in ONE SQLite query via preloadPageLayoutCacheRange (they land in
  // layoutCacheMem synchronously, so swiping to them later costs zero DB traffic) — for BOTH
  // header states (fs variant), so toggling the header never cold-recomputes. 'hit' →
  // layoutContentRef set and scaleForLine switches to the arithmetic single-pass path; 'miss' →
  // measurement path (which still waits for fontReady inside handleWordMeasured). Cancellation
  // flag guards the unmount race. headerVisible is a dep so a header toggle hot-swaps the row.
  useEffect(() => {
    if (!pageData?.lines?.length) return;
    let cancelled = false;
    const keySparse = sparse ? 1 : 0;
    const keyW = Math.round(pageWidth);
    const first = Math.max(1, pageNum - 3);
    const last = pageNum + 7;
    preloadPageLayoutCacheRange(first, last, textStyle, false, layoutKeyFs(textStyle, headerVisible, sparse), keySparse, keyW);
    preloadPageLayoutCacheRange(first, last, textStyle, false, layoutKeyFs(textStyle, !headerVisible, sparse), keySparse, keyW);
    getPageLayoutCache(pageNum, textStyle, false, layoutKeyFs(textStyle, headerVisible, sparse), keySparse, keyW)
      .then((cached) => {
        if (cancelled) return;
        if (cached) {
          layoutContentRef.current = cached;
          cacheWrittenRef.current = false;
          setCacheState('hit');
          scheduleVerify();
        } else {
          setCacheState('miss');
        }
      });
    return () => { cancelled = true; };
  }, [pageNum, textStyle, fs, pageWidth, fixNonce, headerVisible]);

  const scheduleVerify = useCallback(() => {
    setTimeout(() => commitVerify(), 350);
  }, []);

  const commitVerify = useCallback(() => {
    // Post-settle: the completion handler already compared/froze — never re-correct after that
    // (at most ONE correction per page, then stable forever, no pulsing).
    if (frozenRef.current) return;
    const fresh = widthsRef.current;
    const keys = Object.keys(fresh).map(Number);
    if (keys.length === 0) return;
    const totalLines = (pageData?.lines || []).reduce(
      (a: number, l: any) => a + (l.words && l.words.some((w: any) => hasArabicLetters(stripPua(w.word))) ? 1 : 0), 0);
    // Only a FULLY-measured pass may rewrite the row — partial live sums must never clobber
    // the persisted (possibly fuller) sums, that is how under-counts got written before.
    if (completedLinesRef.current.size < totalLines) return;
    const lineW = pageWidth - 2 * padSide;
    const sums: number[] = [];
    for (let k = 0; k <= Math.max(...keys); k++) {
      const arr = fresh[k];
      sums[k] = arr ? arr.reduce((a: number, b: number) => a + (b || 0), 0) : 0;
    }
    const saved = layoutContentRef.current || [];
    const differs = sums.length !== saved.length ||
      sums.some((s, i) => Math.abs(s - (saved[i] || 0)) > 1.5);
    if (differs) {
      layoutContentRef.current = sums;
      setLineScale({});
      const keySparse = sparse ? 1 : 0;
      const sumsW = Math.round(pageWidth);
    // Persist for BOTH header variants: the sums are raw (full-size) widths, valid for any
    // font size, and the two header states share one fs, so the toggled-header state opens
    // from cache instead of re-measuring.
      savePageLayoutCache(pageNum, textStyle, false, layoutKeyFs(textStyle, headerVisible, sparse), keySparse, sumsW, sums);
      savePageLayoutCache(pageNum, textStyle, false, layoutKeyFs(textStyle, !headerVisible, sparse), keySparse, sumsW, sums);
    }
  }, [pageNum, textStyle, fs, pageWidth, sparse, headerVisible, pageData]);

  /**
   * handleWordMeasured(lineKey, wordIdx, w, expected) — core of the measure-then-scale dance.
   * Accumulates measured word widths per line; on overflow computes a shrink scale; when every
   * line is complete and nothing written yet, persists the sums to the layout cache.
   * FLOW:
   *   1. Bail when the cache already loaded (cache-hit path needs no measuring); font not ready.
   *   2. Normalize the measured width back to a RAW value when the line is already scaled
   *      (divide by scale), so the width store is always unscaled and complete.
   *   3. content = Σ widths + live lineExtra; overflow when content > lineW+2 on a complete line,
   *      or > lineW on a PARTIAL one — the partial check pre-empts the overflow flash before the
   *      line finishes measuring.
   *   4. On overflow: scale = max(0.5, (lineW-12)/content) → scaleRef + lineScale state, which
   *      re-renders the line with the scaled font.
   *   5. On complete: track in completedLinesRef; when ALL lines (counted only where the line
   *      holds any real Arabic word) are done and nothing written yet → build sums[] indexed
   *      0..maxLineIdx and savePageLayoutCache. Write-back omits lineExtra — correct, because
   *      extra is notes-dependent and re-derived per render.
   * NOTES/QUIRKS:
   *   - expected comes from the render-time closure (words where hasArabicLetters(stripPua(word)))
   *     and matches the RENDERED WordHitArea count exactly, so completeness is exact.
   *   - A scaled line keeps recording widths, normalized back to raw via division by the current
   *     scale, so the persisted sums are ALWAYS full-size — the cache-hit path recomputes the
   *     identical scale and reloaded pages never overflow.
   *   - setLineScale fires only when the scale actually changes (>1e-3), so the measure pass
   *     causes at most one extra render per overflow line.
   *   - The overflow scale is computed from PARTIAL data (step 3) to avoid an overflow flash.
   */
  const handleWordMeasured = (lineKey: number, wordIdx: number, w: number, expected: number) => {
    if (frozenRef.current) return;
    if (!fontReady) return;
    // Once a line is scaled, later measurements arrive at the SCALED font. Divide by the current
    // scale to recover the raw unscaled width so the store (and the persisted sums) always hold
    // full-size widths. Cache-hit scale then mirrors first-visit exactly — no under-count, no
    // overflow on reload, single measurement pass, never causes new re-renders by itself.
    if (scaleRef.current[lineKey]) w = w / scaleRef.current[lineKey];
    if (!widthsRef.current[lineKey]) widthsRef.current[lineKey] = [];
    if (widthsRef.current[lineKey][wordIdx] === undefined) {
      filledCountRef.current[lineKey] = (filledCountRef.current[lineKey] || 0) + 1;
    }
    widthsRef.current[lineKey][wordIdx] = w;
    const arr = widthsRef.current[lineKey];
    const lineW = pageWidth - 2 * padSide;
    // Effective sum = max of the persisted (possibly under-counted) cached sum and the live
    // measured sum, so a cache-hit page whose cached line under-counts still re-scales instead
    // of letting words spill past the inner rule.
    const cached = layoutContentRef.current?.[lineKey] || 0;
    const liveArrSum = arr.reduce<number>((a, b) => a + (b || 0), 0);
    const content = Math.max(cached, liveArrSum) + (lineExtraRef.current[lineKey] || 0);
    const complete = (filledCountRef.current[lineKey] || 0) >= expected;
    // The scale-setting branch is MISS-path only: during a cache-HIT verify pass the render
    // already sizes via scaleForLine's arithmetic (max(cached, live)), so we only RECORD widths
    // here; the completion handler below compares live vs cached and corrects AT MOST ONCE.
    if (!frozenRef.current && !layoutContentRef.current && content > (complete ? lineW + 2 : lineW)) {
      const scale = Math.max(0.5, (lineW - 12) / content);
      const prevScale = scaleRef.current[lineKey];
      if (!prevScale || Math.abs(prevScale - scale) > 1e-3) {
        scaleRef.current[lineKey] = scale;
        setLineScale(prev => ({ ...prev, [lineKey]: scale }));
      }
    }
    if (complete && !cacheWrittenRef.current) {
      completedLinesRef.current.add(lineKey);
      const totalLines = (pageData?.lines || []).reduce(
        (a: number, l: any) => a + (l.words && l.words.some((w: any) => hasArabicLetters(stripPua(w.word))) ? 1 : 0), 0);
      if (completedLinesRef.current.size >= totalLines) {
        const keys = Object.keys(widthsRef.current).map(Number);
        if (keys.length === 0) { cacheWrittenRef.current = true; frozenRef.current = true; return; }
        const sums: number[] = [];
        for (let k = 0; k <= Math.max(...keys); k++) {
          const arr = widthsRef.current[k];
          sums[k] = arr ? arr.reduce((a, b) => a + (b || 0), 0) : 0;
        }
        // Cache-HIT verify: compare the fully-measured live sums against the cached row. If any
        // live sum exceeds its cached sum by more than 2px the row under-counts (stale/partial
        // write from an older version) — correct the render (single re-render via setLineScale)
        // and rewrite BOTH header-variant rows with the fresh raw sums. If they match, keep the
        // cached row untouched. Either way the page FREEZES here: no further re-scaling ever.
        const saved = layoutContentRef.current;
        const needsRewrite = !saved || sums.length !== saved.length ||
          sums.some((s, i) => s - (saved[i] || 0) > 2);
        if (needsRewrite) {
          layoutContentRef.current = sums;
          setLineScale({});
          // Sums are raw (full-size) widths — persist BOTH header variants so the
          // toggled-header state renders from cache instead of re-measuring the page.
          savePageLayoutCache(pageNum, textStyle, false, layoutKeyFs(textStyle, headerVisible, sparse), sparse ? 1 : 0,
            Math.round(pageWidth), sums);
          savePageLayoutCache(pageNum, textStyle, false, layoutKeyFs(textStyle, !headerVisible, sparse), sparse ? 1 : 0,
            Math.round(pageWidth), sums);
        }
        cacheWrittenRef.current = true;
        frozenRef.current = true;
      }
    }
  };

  /**
   * scaleForLine(lineIdx) — the font multiplier for a line.
   * Cache-hit path: total = persisted sum + live lineExtra → single-pass arithmetic scale (no
   * measuring at all). Miss path: measured lineScale state || 1. Clamped at 0.5; 1 when the
   * content fits within lineW+2. Applied to the fontSize of the word Text below.
   */
  const scaleForLine = (lineIdx: number) => {
    if (layoutContentRef.current) {
      const lineW = pageWidth - 2 * padSide;
      const live = (widthsRef.current[lineIdx] || []).reduce((a, b) => a + (b || 0), 0);
      const total = Math.max(layoutContentRef.current[lineIdx] || 0, live) + (lineExtraRef.current[lineIdx] || 0);
      return total > lineW + 2 ? Math.max(0.5, (lineW - 12) / total) : 1;
    }
    return lineScale[lineIdx] || 1;
  };

  // overlayLayer — absolute-fill layer that NEVER intercepts taps itself but lets its children
  // be targets: the root uses pointerEvents="box-none" (not "none") because a "none" parent
  // blocks the ENTIRE subtree from hit-testing (PointerEvents.canChildrenBeTouchTarget(NONE) is
  // false in RN native), which would make the reading-mark bookmark button un-tappable. With
  // box-none the layer itself still passes taps through to the mushaf lines underneath, while
  // the button (a child) receives its own presses. The decorative badge pills and the frame are
  // explicitly pointerEvents="none" (the frame already is, inside OrnamentalFrame) so taps over
  // them fall through to the page rows exactly like the pre-button "none" root did. Holds:
  //   the OrnamentalFrame page border + up to four corner/bottom badges: Juz pill (top-left),
  //   pages-left (bottom-right), surah name (top-right), page number (bottom-mid), plus the
  //   optional reading-mark bookmark button (top-right, left of the surah pill). Badges ALWAYS
  //   render (header visibility does not gate them) and sit in the page's margin bands OUTSIDE
  //   the frame: top pills at top: -22 lift them above the top band edge (wrapper marginTop is
  //   24); bottom pills at bottom: -12 sit snug above the screen edge (wrapper marginBottom is
  //   14 — pill bottom lands ~2px above the screen edge, pill top rests just inside the frame's
  //   bottom band — over the frame, never over text). compact (<600px) shrinks the pill styles.
  const overlayLayer = (
    <View style={[StyleSheet.absoluteFill, { zIndex: 10 }]} pointerEvents="box-none">
      <OrnamentalFrame color={frameC} bg={badgeBg} nightMode={nightMode} />
      {firstSurahId > 0 && (
        <View pointerEvents="none" style={[styles(nightMode).badgePill, styles(nightMode).topLeft, { borderColor: frameC, backgroundColor: badgeBg }, compact && styles(nightMode).badgePillCompact]}>
          <Text style={[styles(nightMode).badgeText, { color: grayC }, compact && styles(nightMode).badgeTextCompact]}>Juz {juzInfo.juz}</Text>
        </View>
      )}
      {pageNum > 0 && (
        <View pointerEvents="none" style={[styles(nightMode).badgePill, styles(nightMode).bottomRight, { borderColor: frameC, backgroundColor: badgeBg }, compact && styles(nightMode).badgePillCompact]}>
          <Text style={[styles(nightMode).badgeText, { color: grayC }, compact && styles(nightMode).badgeTextCompact]}>{juzInfo.pagesLeft} pages left in Juz</Text>
        </View>
      )}
      {firstSurahId > 0 && (
        <View pointerEvents="none" style={[styles(nightMode).badgePill, styles(nightMode).topRight, { borderColor: frameC, backgroundColor: badgeBg }, compact && styles(nightMode).badgePillCompact]}>
          <Text style={[styles(nightMode).badgeText, { color: grayC }, compact && styles(nightMode).badgeTextCompact]}>{surahNames?.[firstSurahId] || `Surah ${firstSurahId}`} ({firstSurahId})</Text>
        </View>
      )}
      {showReadingMarkBtn && onReadingMarkToggle && (
        <TouchableOpacity style={styles(nightMode).readingMarkBtn} onPress={onReadingMarkToggle} activeOpacity={0.5} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <BookmarkIcon c={nightMode ? '#7BA7DB' : '#1C3D72'} s={20} filled={readingMarkActive} />
        </TouchableOpacity>
      )}
      {pageNum > 0 && (
        <View pointerEvents="none" style={[styles(nightMode).badgePill, styles(nightMode).bottomMid, { borderColor: frameC, backgroundColor: badgeBg }, compact && styles(nightMode).badgePillCompact]}>
          <Text style={[styles(nightMode).badgeText, { color: grayC }, compact && styles(nightMode).badgeTextCompact]}>Page {pageNum + 1}</Text>
        </View>
      )}
    </View>
  );

  // actionPills — bottom-left pill cluster, shown ONLY when the header is hidden AND onSpread is
  // provided: the tablet spread toggle. (The "Fix font" pill was removed by request — the layout
  // cache now only re-measures on font/page/width/fixNonce changes.)
  const actionPills = onSpread && !headerVisible ? (
    <View style={styles(nightMode).bottomLeftRow}>
      {onSpread && (
        <TouchableOpacity style={[styles(nightMode).badgePill, styles(nightMode).actionPillGap, { borderColor: frameC, backgroundColor: badgeBg }, compact && styles(nightMode).badgePillCompact]}
          onPress={() => onSpread()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles(nightMode).badgeText, { color: spread ? (nightMode ? '#7BA7DB' : '#1C3D72') : grayC }, compact && styles(nightMode).badgeTextCompact]}>{spread ? 'Spread' : 'Spread'}</Text>
        </TouchableOpacity>
      )}
    </View>
  ) : null;

  // Fallback path — pageData (or its lines) missing: simple per-verse rows from versesForPage
  // using the verse's own text. No word-level measurement, no highlights (no wordIndex
  // granularity), no layout-cache interaction. The font uses the sparse boost too; each row is a
  // Pressable → onDeadTap, the inner text zone → onWordPress(verseNum, 0) / onVerseLongPress,
  // plus the bookmark badge and note icon.
  if (!pageData || !pageData.lines || pageData.lines.length === 0) {
    return (
      <View style={[styles(nightMode).container, { paddingHorizontal: padSide, paddingTop: padTop, paddingBottom: padBottom }]} onLayout={onBoxLayout}>
        <View style={styles(nightMode).fallbackBody}>
          {(versesForPage || []).map((v: any, i: number) => {
            const fKey = `${v.surahId}_${v.verseNumber}`;
            const fBookmarked = !!bookmarks?.[fKey];
            const fReadingMark = readingMarkVerse === v.verseNumber;
            const fHasNote = !!notes?.[fKey];
            return (
              <Pressable key={`${fKey}_${i}`} style={styles(nightMode).fallbackRow} onPress={(e: any) => onDeadTap?.(e?.nativeEvent?.pageY)}>
                <Pressable style={styles(nightMode).fallbackTextZone}
                  onPress={() => onWordPress(v.verseNumber, 0)}
                  onLongPress={(e: any) => onVerseLongPress(v.verseNumber, e?.nativeEvent?.pageY)}
                  delayLongPress={300}>
                  <Text style={[styles(nightMode).fallbackText, { fontSize: (mushafFontSize + adj.size) * (sparse ? SPARSE_FONT_BOOST : 1), lineHeight: mushafLineHeight * (sparse ? SPARSE_FONT_BOOST : 1), color: textColor, fontFamily }]} maxFontSizeMultiplier={1}>
                    {v.textArabic}{' '}
                  </Text>
                </Pressable>
                <View style={styles(nightMode).verseBadgeContainer}>
                  <TouchableOpacity onPress={(e: any) => onBadgePress ? onBadgePress(v.verseNumber, e?.nativeEvent?.pageY) : onBookmarkToggle(v.verseNumber, v.surahId)}>
                    <View style={[styles(nightMode).verseBadge, { backgroundColor: nightMode ? '#1e1e1e' : '#e8e8e8' }, fBookmarked && styles(nightMode).bookmarkedBadge, fReadingMark && styles(nightMode).readingMarkBadge]}>
                      <Text style={[styles(nightMode).verseBadgeText, { color: nightMode ? '#fff' : '#121212' }, fBookmarked && styles(nightMode).bookmarkedBadgeText]}>{fReadingMark ? '📍' : v.verseNumber === 1 && v.surahId === 1 ? '' : v.verseNumber}</Text>
                    </View>
                  </TouchableOpacity>
                  {fHasNote && <Text style={styles(nightMode).noteIcon}>📝</Text>}
                </View>
              </Pressable>
            );
          })}
        </View>
        {overlayLayer}
        {actionPills}
      </View>
    );
  }

  // Render gate — hold at an empty container until the cache verdict ('hit'/'miss') arrives so
  // no measurement starts before it.
  // Render gate — cache-hit pages render IMMEDIATELY (scales come from persisted sums +
  // live lineExtra; no measurement, no font wait). Only the miss path holds until fontReady:
  // words laid out before the real font loads fire onLayout once and would never re-measure,
  // so measurement must not start on the fallback font. fontReady persists across page swipes
  // (only resets on font/fixNonce change), so this costs ~150ms once per font, not per page.
  if (cacheState === 'loading' || (cacheState === 'miss' && !fontReady)) {
    return <View style={[styles(nightMode).container, { paddingHorizontal: padSide, paddingTop: padTop, paddingBottom: padBottom }]} onLayout={onBoxLayout} />;
  }

  // Main mushaf layout — one row-reverse Pressable per line (RTL word order), with a
  // verse-boundary badge after the word that ends each verse. 'surah-header' lines are skipped
  // entirely; 'basmala' lines get their own centered header style (hardcoded Arabic text,
  // fontSize 24 * sparse boost). Sparse pages justify lines space-around.
  return (
    <View style={[styles(nightMode).container, { paddingHorizontal: padSide, paddingTop: padTop, paddingBottom: padBottom }]} onLayout={onBoxLayout}>
      {pageData.lines.map((line: any, lineIdx: number) => {
        const taawud = lineIdx === taawudLineIdx ? (
          <View style={styles(nightMode).taawudRow}>
            <View style={[styles(nightMode).taawudRule, { backgroundColor: nightMode ? 'rgba(123,167,219,0.30)' : 'rgba(28,61,114,0.35)' }]} />
            <Text style={[styles(nightMode).taawudText, { color: nightMode ? 'rgba(255,255,255,0.60)' : 'rgba(0,0,0,0.60)', fontFamily, fontSize: Math.max(12, Math.round(fs * 0.55)) }]}>
              {'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ'}
            </Text>
            <View style={[styles(nightMode).taawudRule, { backgroundColor: nightMode ? 'rgba(123,167,219,0.30)' : 'rgba(28,61,114,0.35)' }]} />
          </View>
        ) : null;
        if (line.type === 'surah-header') {
          return <React.Fragment key={lineIdx}>{taawud}</React.Fragment>;
        }
        if (line.type === 'basmala') {
          return <React.Fragment key={lineIdx}>{taawud}<View style={[styles(nightMode).headerLine, { borderBottomColor: lineColor }]}><Text style={[styles(nightMode).headerText, { color: textColor, fontFamily, fontSize: 24 * (sparse ? SPARSE_FONT_BOOST : 1) }]}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text></View></React.Fragment>;
        }
        return (
          <React.Fragment key={lineIdx}>
            {taawud}
            <Pressable style={[styles(nightMode).line, { borderBottomColor: lineColor }, sparse && { justifyContent: 'space-around' }]} onPress={(e: any) => onDeadTap?.(e?.nativeEvent?.pageY)}>
            {(() => {
              lineExtraRef.current[lineIdx] = computeLineExtra(line, lineIdx, pageData, notes);
              return line.words?.map((word: any, wordIdx: number) => {
              // Per-word render: location "surah:verse:wordPos" parsed into surahId/verseNum/
              // wordPos; vKey "surahId_verseNum" drives the highlight/badge lookups; a word is
              // highlighted when hl.wordIndex === wordPos - 1.
              const parts = word.location ? word.location.split(':') : [];
              const surahId = parts[0] || '0';
              const verseNum = parts.length > 1 ? parseInt(parts[1], 10) : 0;
              const wordPos = parts.length > 2 ? parseInt(parts[2], 10) : 0;
              const vKey = `${surahId}_${verseNum}`;

              // Skip rendering verse-end marker entries (Private Use Area U+E000-U+F8FF).
              // These are decorative verse-number circle glyphs meant for QPC fonts.
              // Standard fonts render them as garbled tofu. We hide them but keep
              // the layout entry intact so word positions and verse boundaries stay correct.
              // Entries with real Arabic letters after stripping PUA are real words
              // (PUA embedded mid-word) and must be rendered with the PUA removed.
              const stripped = stripPua(word.word);
              const isVerseEndMarker = !!word.word && !hasArabicLetters(stripped);

              let displayText = stripped;
              const h = hlMap.get(vKey)?.highlights?.find((hl: any) => hl.wordIndex === wordPos - 1);
              const isBookmarked = !!bookmarks?.[vKey];
              const isFlashing = flashingVerseKey === vKey;
              const hasNote = !!notes?.[vKey];
              const isReadingMark = readingMarkVerse === verseNum;
              // Verse-boundary detection: this word ends a verse when the next word belongs to a
              // different verse; else the next line's first word does; else the very last line of
              // the page ends a verse. NOTE: mirrors the rule inside computeLineExtra — two
              // copies of one rule, keep them in sync.
              const nextWord = line.words[wordIdx + 1];
              let isVerseBoundary = false;
              if (nextWord && nextWord.location) {
                isVerseBoundary = nextWord.location.split(':')[1] !== String(verseNum);
              } else if (!nextWord) {
                const nextLine = pageData.lines[lineIdx + 1];
                if (nextLine && nextLine.words && nextLine.words.length > 0) {
                  const nw = nextLine.words[0];
                  if (nw && nw.location) {
                    isVerseBoundary = nw.location.split(':')[1] !== String(verseNum);
                  }
                } else {
                  isVerseBoundary = true;
                }
              }

              // If this is a verse-end marker, don't render the garbled text
              // but still allow verse boundary badge to appear
              if (isVerseEndMarker) {
                return (
                  <React.Fragment key={wordIdx}>
                    {isVerseBoundary && (
                      <View style={styles(nightMode).verseBadgeContainer}>
                        <TouchableOpacity onPress={(e: any) => onBadgePress ? onBadgePress(verseNum, e?.nativeEvent?.pageY) : onBookmarkToggle(verseNum, parseInt(surahId, 10))}>
                          <View style={[styles(nightMode).verseBadge, { backgroundColor: nightMode ? '#1e1e1e' : '#e8e8e8' }, isBookmarked && styles(nightMode).bookmarkedBadge, isReadingMark && styles(nightMode).readingMarkBadge]}>
                            <Text style={[styles(nightMode).verseBadgeText, { color: nightMode ? '#fff' : '#121212' }, isBookmarked && styles(nightMode).bookmarkedBadgeText]}>{isReadingMark ? '📍' : verseNum === 1 && surahId === '1' ? '' : verseNum}</Text>
                          </View>
                        </TouchableOpacity>
                        {hasNote && <Text style={styles(nightMode).noteIcon}>📝</Text>}
                      </View>
                    )}
                  </React.Fragment>
                );
              }

              return (
                <React.Fragment key={wordIdx}>
                  <WordHitArea tapFraction={WORD_TAP_FRACTION} style={styles(nightMode).wordBox}
                    onWordPress={() => verseNum > 0 && onWordPress(verseNum, wordPos - 1)} onDeadTap={onDeadTap}
                    onLongPress={(e: any) => verseNum > 0 && onVerseLongPress(verseNum, e?.nativeEvent?.pageY)} delayLongPress={300}
                    onMeasured={(w) => handleWordMeasured(lineIdx, wordIdx, w, (line.words || []).filter((w: any) => hasArabicLetters(stripPua(w.word))).length)}>
                    <Text style={[styles(nightMode).text, { fontSize: (mushafFontSize + adj.size) * (scaleForLine(lineIdx)) * (sparse ? SPARSE_FONT_BOOST : 1) * fontScale, lineHeight: mushafLineHeight * (sparse ? SPARSE_FONT_BOOST : 1) * pitchScale, color: textColor, fontFamily, includeFontPadding: true, transform: wordLiftY ? [{ translateY: wordLiftY }] : undefined }, h && MISTAKE_HIGHLIGHT, isFlashing && { backgroundColor: 'rgba(255, 215, 0, 0.2)' }]} maxFontSizeMultiplier={1}>
                      {displayText}{' '}
                    </Text>
                  </WordHitArea>
                  {isVerseBoundary && (
                    <View style={styles(nightMode).verseBadgeContainer}>
                      <TouchableOpacity onPress={(e: any) => onBadgePress ? onBadgePress(verseNum, e?.nativeEvent?.pageY) : onBookmarkToggle(verseNum, parseInt(surahId, 10))}>
                        <View style={[styles(nightMode).verseBadge, { backgroundColor: nightMode ? '#1e1e1e' : '#e8e8e8' }, isBookmarked && styles(nightMode).bookmarkedBadge, isReadingMark && styles(nightMode).readingMarkBadge]}>
                          <Text style={[styles(nightMode).verseBadgeText, { color: nightMode ? '#fff' : '#121212' }, isBookmarked && styles(nightMode).bookmarkedBadgeText]}>{isReadingMark ? '📍' : verseNum === 1 && surahId === '1' ? '' : verseNum}</Text>
                        </View>
                      </TouchableOpacity>
                      {hasNote && <Text style={styles(nightMode).noteIcon}>📝</Text>}
                    </View>
                  )}
                </React.Fragment>
              );
              });
            })()}
          </Pressable>
          </React.Fragment>
        );
      })}
      {overlayLayer}
      {actionPills}
    </View>
  );
};

// Shared style constants — no per-page memoization needed because the text scale lives inline in
// the Text style prop. line: row-reverse + flex:1 so each line fills one vertical slot;
// wordBox flexShrink:0 keeps words intact; container uses space-around (sparse pages get an
// additional line-level space-around).
const styles = (nightMode: boolean) => StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 12, paddingVertical: 16, justifyContent: 'space-around', backgroundColor: 'transparent' },
  taawudRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', paddingVertical: 2 },
  taawudRule: { flex: 1, height: 1, marginHorizontal: 10 },
  taawudText: { textAlign: 'center' },
  line: { flexDirection: 'row-reverse', alignItems: 'center', flex: 1, width: '100%', overflow: 'visible', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  headerLine: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flex: 1, width: '100%', borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  text: { textAlign: 'center', flexShrink: 1 },
  fallbackBody: { flex: 1, justifyContent: 'flex-start' },
  fallbackRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', width: '100%', marginBottom: 8 },
  fallbackTextZone: { flexShrink: 1 },
  fallbackText: { flexWrap: 'wrap', flexShrink: 1, textAlign: 'right' },
  wordBox: { flexShrink: 0 },
  headerText: { fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  verseBadgeContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 3, flexShrink: 1, minWidth: 18 },
  verseBadge: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: (nightMode ? '#7BA7DB' : '#1C3D72') },
  bookmarkedBadge: { backgroundColor: '#ffd700', borderColor: '#ffd700' },
  readingMarkBadge: { backgroundColor: '#4a90d9', borderColor: '#4a90d9' },
  verseBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '700', fontFamily: 'normal' },
  bookmarkedBadgeText: { color: '#000000' },
  noteIcon: { color: '#ffd700', fontSize: 10, marginLeft: 2 },
  badgePill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  badgeText: { fontSize: 9.5, fontWeight: '600' },
  badgePillCompact: { paddingVertical: 4, paddingHorizontal: 4 },
  badgeTextCompact: { fontSize: 8.5 },
  topLeft: { position: 'absolute', top: -22, left: 6 },
  topRight: { position: 'absolute', top: -22, right: 19 },
  readingMarkBtn: { position: 'absolute', top: -22, right: -4, zIndex: 20, elevation: 20 },
  bottomMid: { position: 'absolute', bottom: -26, alignSelf: 'center' },
  bottomRight: { position: 'absolute', bottom: -26, right: 6 },
  bottomLeftRow: { position: 'absolute', bottom: 2, left: 10, flexDirection: 'row', alignItems: 'center' },
  actionPillGap: { marginRight: 6 }
});

// memo export — see component NOTES: largely ineffective due to prop identity churn
// (pageData/highlights/bookmarks/notes change on parent re-renders).
export default memo(MushafPageView);