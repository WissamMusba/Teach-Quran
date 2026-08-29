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

import React, { memo, useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Pressable, ActivityIndicator, InteractionManager } from 'react-native';
import { getMushafFontSize, getMushafLineHeight } from '../../utils/responsive';
import { WORD_TAP_FRACTION, MISTAKE_HIGHLIGHT } from '../../utils/constants';
import TutorialAnchor from '../../tutorial/TutorialAnchor';
import WordHitArea from '../common/WordHitArea';
import OrnamentalFrame, { frameInsetFor, frameInsetVFor } from './OrnamentalFrame';
import Svg, { Path } from 'react-native-svg';
import { textInsetFor } from '../../utils/mushafLayout';
import { getPageLayoutCache, getLayoutCacheSync, savePageLayoutCache, savePageLayoutCacheMemOnly, preloadPageLayoutCacheRange } from '../../database/localDB';
import type { PageLayoutCacheRow, PageLayoutCacheFit } from '../../database/localDB';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
// The layout cache stores NORMALIZED line-width sums: every measured word width is divided by
// the page's rendered base size (normFontSize = (mushafFontSize + adj.size) x sparse boost x
// fontScale), and every cache-hit replay multiplies the sums back by the current base size.
// Rows are therefore FONT-SIZE-INDEPENDENT — changing the app's mushaf font size (settings or a
// new release) never invalidates the cache, so a page is measured ONCE per (page, textStyle,
// sparse, width) per device and then replayed forever from SQLite. The DB key no longer carries
// fs (always 0); localDB's layoutVer bump wiped the old fs-keyed rows.
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
// Exported so the startup prefetcher (src/utils/startupPrefetch.ts) reuses the exact same rule.
export const SPARSE_WORD_THRESHOLD = 50;
const SPARSE_FONT_BOOST = 1.3;

// Session-wide font-settle gate (FIX 2): only the FIRST MushafPageView mount of a session waits
// the 150ms font-settle timer; every later page renders immediately because the loaded font's
// metrics are already stable (RN loads a font family once per process).
let fontLoadedOnce = false;

/**
 * getFontAdj(ts, hv) — per-font size/vertical-offset corrections so each mushaf font sits at
 * the right visual height. switch: saleem +2, alqalam/uthmani +0, lateef +4 (default +0).
 * The size feeds fs (and thus the layout cache key) and the word Text translateY transform
 * (transform array only when adj.y is non-zero).
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
    default: return { size: 0, y: 0 };
  }
};

/**
 * warmPageLayoutFor — preloads the layout row (mem + SQLite range query) for ONE page, for the
 * mushaf + width + sparse pairing of that page. Called by the QuranView progressive page-warm
 * pipeline for far-ahead pages whose MushafPageView has not mounted yet, so the frame renders
 * the moment they scroll into view regardless of header state.
 * CALLS: preloadPageLayoutCacheRange (localDB).
 * AFFECTS: layoutCacheMem + page_layout_cache read caching (no writes).
 */
export const warmPageLayoutFor = (pageNum: number, pageData: any, textStyle: string, pageWidth: number, fontSizeScale = 1) => {
  try {
    const totalWords = Array.isArray(pageData?.lines)
      ? pageData.lines.reduce((a: number, l: any) => a + (l.words ? l.words.length : 0), 0)
      : 0;
    const sparse = totalWords < SPARSE_WORD_THRESHOLD;
    const keySparse = sparse ? 1 : 0;
    const keyW = Math.round(pageWidth * fontSizeScale);
    preloadPageLayoutCacheRange(pageNum, pageNum, textStyle, false, keySparse, keyW);
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
 *      (pageNum, textStyle, headerVisible=false, sparse, rounded pageWidth) — the row holds
 *      NORMALIZED (font-size-independent) line-width sums, so it serves every header state and
 *      any font size.
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
  *   - headerVisible is absent from BOTH effect dep arrays: the layout cache row is
  *     font-size-independent (normalized sums), so both header states and every font size share
  *     ONE row per (page, textStyle, sparse, width) — measured once per device, replayed forever.
  *   - The vertical fit (pitchScale/fontScale) is folded into the normalization base: measured
  *     widths are divided by (base size x fontScale) before persisting and multiplied back on
  *     replay, so the fit itself cannot invalidate cached rows — it just changes the
  *     multiplier. Since layoutVer 4 the fit is PERSISTED with the row (fitAtPassRef frozen at
  *     the same render as the base) and a cache-hit mount replays it synchronously when the
  *     current box+header match the stored ones — the fit runs live only on cache miss or on
  *     box/header drift.
 *   - maxFontSizeMultiplier={1} on word/fallback Text — the app owns font scaling; the OS must
 *     not re-inflate text sizes.
 */
const MushafPageView = ({ headerVisible = true, pageNum = 0, pageWidth = SCREEN_WIDTH, surahNames = {}, versesForPage, pageData, highlights, onWordPress, onVerseLongPress, onBookmarkToggle, onBadgePress, bookmarks, flashingVerseKey, notes, readingMarkVerse, onDeadTap, fixNonce = 0, onSpread, spread, showReadingMarkBtn = false, readingMarkActive = false, isCurrentPage = false, onReadingMarkToggle = undefined, onToggleHeader = undefined, hideBottomChrome = false, hideFrame = false, persistLayout = true, onMeasured = undefined, fontSizeScale = 1 }: any) => {
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
// v97: fontSizeScale (prop) shrinks the tablet mushaf font — 0.78 in split view, 0.88 for
// single-page tablets — without touching the phone buckets. 1 (phones) = byte-identical.
// v98: LANDSCAPE split halves are short — font drops further (0.65 via the caller) and the
// line box tightens 18% so the first line stops clipping under the top band.
const isLandscapeSplit = spread === true && Dimensions.get('window').width > Dimensions.get('window').height;
const mushafFontSize = getMushafFontSize(headerVisible) * fontSizeScale;
  const mushafLineHeight = getMushafLineHeight(headerVisible) * fontSizeScale * (isLandscapeSplit ? 0.82 : 1);
  /**
   * getFontAdj (module-level) — see above; adj.y feeds the translateY transform below.
   */
  const adj = getFontAdj(textStyle, headerVisible);
  // Header-visible descender clearance: with the header showing, the page box is shorter and
  // the pitch squeeze (pitchScale) keeps the line stack inside it, so the QPC fonts' descenders
  // poke below the line box and get visually clipped. Every word is nudged 2px DOWN (requested
  // tuning) to keep the tails visible; no header → no shift (layout position unchanged either
  // way — pure visual transform).
  const wordLiftY = adj.y + (headerVisible ? 2 : 0);
  const compact = pageWidth < 600;

  // User-specified padding (percent-based): top/bottom = 1.0% of the SCREEN HEIGHT (was 2.5% —
  // the dead gap between the frame's inner rule and the first/last line is slimmed so the text
  // gains room; the taller vertical frame bands give the frame its presence), left/right = 6.7%
  // of the PAGE WIDTH (textInsetFor, shared with stroke.ts for drawing registration). Each is
  // floored at the frame inset so the text always stays strictly inside the frame's inner text
  // box (never under the pattern band or its rules).
  // v98: landscape split — text sits ~10px from the frame's inner rule (matches the 8px
  // seam between the two frames); the frame itself does not move.
  const padTop = isLandscapeSplit ? Math.max(8, frameInsetVFor(pageWidth) - 12) : Math.max(0.010 * SCREEN_HEIGHT, frameInsetVFor(pageWidth));
  const padBottom = padTop;
  // v97 — TRUE CONTENT WIDTH: lines were laid out against the NOMINAL pageWidth prop while the
  // real container is narrower by the wrapper margins (up to ~37px in tablet split), so full
  // lines could cross the frame's inner rule ("words clipped / not inside the frame"). The box
  // is measured on-layout; when it differs meaningfully from the nominal width the LAYOUT runs
  // against the measured width. Phones differ by only ~12px and keep their exact legacy
  // rendering (delta ≤ 16 → nominal, unchanged math).
  const [boxWState, setBoxWState] = useState(0);
  const boxWRef = useRef(0);
  const layoutW = boxWState > 0 && Math.abs(pageWidth - boxWState) > 16 ? boxWState : pageWidth;
  const padSide = textInsetFor(layoutW);

  // Sparse-page detection: count words across pageData lines (else whitespace-split fallback
  // verses); sparse → SPARSE_FONT_BOOST on fontSize AND lineHeight. fs rounds into the layout
  // cache key — any font-size shift (textStyle, header visibility, sparse flag) reloads the row.
  const totalWords = pageData?.lines
    ? pageData.lines.reduce((a: number, l: any) => a + (l.words ? l.words.length : 0), 0)
    : (versesForPage || []).reduce((a: number, v: any) => a + ((v.textArabic || '').trim().split(/\s+/).filter(Boolean).length), 0);
  const sparse = totalWords < SPARSE_WORD_THRESHOLD;
  // fs (base rendered size WITHOUT the per-line scale) — used for the ta'awwud line only; the
  // layout cache no longer keys on it (normalized sums are font-size-independent).
  const fs = Math.round(getMushafFontSize(headerVisible) * fontSizeScale + adj.size);

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
  // One-shot vertical-fit storage (P1 teardown: v62 measured once per key and replayed forever;
  // v81 re-fit on every mount). layoutFitRef holds the fit payload ({ boxH, headerVisible,
  // pitchScale, fontScale }) of the cached row for the CURRENT key — replayed synchronously by
  // replayFit below when it matches the current box+header. fitAtPassRef freezes the fit at the
  // SAME render moment passNormFontSizeRef freezes the normalization base (first measured word),
  // so a persisted row's sums and fit are SELF-consistent: sums normalize by base size x frozen
  // fontScale, and the replay multiplies them back by base size x the SAME replayed fontScale —
  // pixel-identical to the first visit, by construction.
  const layoutFitRef = useRef<PageLayoutCacheFit | null>(null);
  const fitAtPassRef = useRef<PageLayoutCacheFit | null>(null);
  // P1-E — the normalization base is FROZEN for the lifetime of ONE measure pass: onBoxLayout
  // (box height) can re-fire mid-pass (gate→full swap, player bar mount, header toggle, rotation)
  // and re-derive fontScale → normFontSize. Without a fixed base, words measured before the
  // resize would normalize against the OLD base and words after it against the NEW one — a
  // single persisted row mixing two units that mis-scales on every later replay. Zeroed by the
  // reset effect so each new page/pass starts clean.
  const passNormFontSizeRef = useRef(0);
  const [cacheState, setCacheState] = useState<'loading' | 'miss' | 'hit'>('loading');
  const [fontReady, setFontReady] = useState(fontLoadedOnce);
  const [innerH, setInnerH] = useState(0);
  // Vertical box height measurement. CRITICAL: this must fire on the VERY FIRST layout of the
  // mounted view — which happens while the 'loading' GATE is rendered (cache-hit pages swap the
  // gate for the full mushaf at the SAME size, so the full container's own onLayout would never
  // fire and innerH would stay 0 → pitchScale/fontScale 1 → full-size text in the shorter
  // header-visible box → bottom clipped until a header toggle resizes the box). All three
  // containers (fallback, gate, full) therefore share this handler: whichever renders first
  // captures the true height. FIRST measurement (innerHRef still 0) applies SYNCHRONOUSLY —
  // the first-paint gate depends on innerH, so no rAF/timer may delay it. LATER resizes
  // (header show/hide height animation firing every frame, rotation, player bar mount)
  // coalesce behind a ~70ms settle timeout that clears/replaces the timer on each event and
  // applies the LATEST pending height once — a per-frame setInnerH would re-derive
  // pitchScale/fontScale and thrash the ~400 word re-fit on every one of the ~8 animation
  // frames.
  const innerHSettleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const innerHRef = useRef(0);
  const pendingInnerHRef = useRef(0);
  const onBoxLayout = useCallback((e: any) => {
    const w = Math.round(e.nativeEvent.layout.width);
    const h = Math.round(e.nativeEvent.layout.height);
    // v97: capture the TRUE box width for the layoutW fix (immediate, no settle — width is
    // stable per mount and padSide/lineW must be correct from the first measure pass).
    if (w > 0 && boxWRef.current !== w) { boxWRef.current = w; setBoxWState(w); }
    if (h <= 0) return;
    pendingInnerHRef.current = h;
    if (innerHRef.current === 0) {
      // First measurement for this mounted page — apply immediately so the gate never waits.
      innerHRef.current = h;
      setInnerH(h);
      return;
    }
    // Resize — coalesce: reset the settle window on each event (clear/replace), latest h wins.
    if (innerHSettleRef.current !== null) clearTimeout(innerHSettleRef.current);
    innerHSettleRef.current = setTimeout(() => {
      innerHSettleRef.current = null;
      setInnerH((prev) => (pendingInnerHRef.current !== prev ? pendingInnerHRef.current : prev));
    }, 70);
  }, []);
  useEffect(() => () => {
    if (innerHSettleRef.current !== null) clearTimeout(innerHSettleRef.current);
  }, []);

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
  // Bismillah sizing: derived from the fitted line slot (was a hardcoded 24px that wrapped to
  // 2-3 lines, overflowed its flex:1 slot and slid under the frame band). Capped small + explicit
  // lineHeight so the bismillah can never tower above its slot or get covered by the frame.
  const basmalaFontSize = Math.min(19, Math.max(13, fitLineH * 0.6));
  const basmalaLineH = Math.max(19, fitLineH * 0.9);
  // Two-factor vertical fit: pitchScale squeezes LINE PITCH only; fontScale
  // keeps the font at full size until the pitch would fall below PITCH_FLOOR_RATIO
  // (glyph-collision prevention) — then both shrink gracefully, so fonts stay big
  // with the header visible and bottoms never clip.
  const naturalRatio = mushafLineHeight / (mushafFontSize + adj.size);
  const PITCH_FLOOR_RATIO = 1.2;
  const needH = wordLineCount * fitLineH;
  const availH = innerH - fitPadTop - fitPadBottom;
  // One-shot vertical fit (P1 teardown): the fit is a pure function of its inputs — innerH,
  // headerVisible (line height + box height), textStyle/sparse (in the cache key) and this
  // page's wordLineCount — so the row's stored fit, when it matches the CURRENT box+header,
  // IS what the live math would produce. (innerH === 0 covers the first paint of a fresh mount,
  // before onBoxLayout's synchronous first-measure lands; the comparison validates on the very
  // next render.) A matching cache-hit replays pitchScale/fontScale directly: no innerH wait,
  // no font gate, no ActivityIndicator, no re-measure — the v62 one-shot property restored for
  // the vertical fit. Any mismatch (hidden pre-measure slot box, header toggle, player-bar
  // mount, rotation) falls back to the live math below — byte-for-byte v81 behavior for those
  // mounts. The bismillah sizing (basmalaFontSize/basmalaLineH) stays render-time: it derives
  // from fitLineH only and is untouched in every case.
  const replayFit = cacheState === 'hit' && layoutFitRef.current !== null &&
    layoutFitRef.current.headerVisible === headerVisible &&
    (innerH === 0 || layoutFitRef.current.boxH === innerH)
    ? layoutFitRef.current
    : null;
  const pitchScale = replayFit
    ? replayFit.pitchScale
    : (needH > 0 && availH > 0 ? Math.min(1, Math.max(0.5, availH / needH)) : 1);
  const fontScale = replayFit
    ? replayFit.fontScale
    : Math.min(1, Math.max(0.5, (pitchScale * naturalRatio) / PITCH_FLOOR_RATIO));
  // Normalization base for the layout cache: the rendered size every word is drawn at (before
  // the per-line scaleForLine). Measured widths are divided by this BEFORE persisting and
  // multiplied back on replay, so cached rows survive any font-size change (settings, header
  // toggle, release updates) — each page is measured once per device, not once per font size.
  const normFontSize = (mushafFontSize + adj.size) * (sparse ? SPARSE_FONT_BOOST : 1) * fontScale;

  useEffect(() => {
    let mounted = true;
    if (fontLoadedOnce) { setFontReady(true); return; }
    setFontReady(false);
    const t = setTimeout(() => { if (mounted) { fontLoadedOnce = true; setFontReady(true); } }, 150);
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
  // first word is verse 1 word 1. v96: a SET of indices — the old single findIndex only
  // marked the FIRST start, so pages beginning 2-3 surahs rendered the ta'awwud above the
  // first one only. Each strip renders ABOVE its own surah-start line (it takes only its
  // own content height — no flex:1 — so verse lines keep their space). Non-interactive,
  // not part of word measurement.
  const taawudLineSet = (() => {
    const lines = pageData?.lines || [];
    const set = new Set<number>();
    // Only the 'surah-header' line marks where the A'udhu belongs. A 'basmala' line
    // directly follows its surah-header, so adding BOTH made every surah render the
    // A'udhu twice (once per marker). Fatiha has no basmala line (Basmala is Ayah 1)
    // — which is exactly why it was the only surah that looked correct.
    lines.forEach((l: any, i: number) => {
      if (l.type === 'surah-header') set.add(i);
    });
    if (!set.size) {
      const loc = ((lines[0]?.words?.[0]?.location) || '').split(':');
      if (loc.length >= 2 && parseInt(loc[1], 10) === 1 && parseInt(loc[2] || '1', 10) === 1) set.add(0);
    }
    return set;
  })();

  // Reset effect — a page/font/width/fixNonce change invalidates ALL measurement state and pushes
  // the pipeline back to 'loading' so the next pass starts clean. NOTE: headerVisible is absent
  // from the deps — and must stay absent: one font-size-independent layout row serves both
  // header states, so a toggle is a same-key cache hit, not a re-measure.
  // useLayoutEffect + declared BEFORE the cache-load effect: both run pre-paint in declaration
  // order, so a warm mount resets first and the cache-load hit lands before the frame paints
  // (a plain useEffect here would run AFTER the layout effect's hit and clobber it back to
  // 'loading' — a stuck skeleton).
  useLayoutEffect(() => {
    scaleRef.current = {};
    widthsRef.current = {};
    lineExtraRef.current = {};
    filledCountRef.current = {};
    layoutContentRef.current = null;
    completedLinesRef.current = new Set();
    cacheWrittenRef.current = false;
    frozenRef.current = false;
    passNormFontSizeRef.current = 0;
    layoutFitRef.current = null;
    fitAtPassRef.current = null;
    setLineScale({});
    setCacheState('loading');
  }, [pageNum, textStyle, pageWidth, fontSizeScale, fixNonce]);

  // Cache-load effect — reads the layout sums WITHOUT waiting for fontReady: the DB/mem read does
  // not need the font (only the measure pass does), so a cache-hit page renders the moment it
  // mounts instead of after the 150ms font gate. Runs in useLayoutEffect (before paint) so a warm
  // layoutCacheMem hit resolves synchronously and the page never even flashes the loading
  // skeleton. Rows are font-size-independent (normalized sums), so the SAME row serves both
  // header states and any font size. 'hit' → layoutContentRef set + frozenRef=true and scaleForLine
  // switches to the arithmetic single-pass path — ZERO measurement work (no verification pass, no
  // re-measure, no pulsing); 'miss' → measurement path (which still waits for fontReady inside
  // handleWordMeasured). Cancellation flag guards the unmount race.
  useLayoutEffect(() => {
    if (!pageData?.lines?.length) return;
    let cancelled = false;
    const keySparse = sparse ? 1 : 0;
    const keyW = Math.round(pageWidth * fontSizeScale);
    const applyHit = (cached: PageLayoutCacheRow | null) => {
      if (cancelled) return;
      if (cached) {
        layoutContentRef.current = cached.lines;
        // The row's fit payload (may be null on defensive legacy rows) feeds the one-shot
        // vertical-fit replay below; null → live fit math, exactly like v81.
        layoutFitRef.current = cached.fit;
        frozenRef.current = true;
        setCacheState('hit');
        // Layout row already persisted (cache hit) — the page needs nothing more; onMeasured
        // lets an optional hidden-instance owner know the row is settled.
        if (onMeasured) onMeasured(pageNum);
      } else {
        setCacheState('miss');
      }
    };
    // (a) Mem-first: the exact key is already in layoutCacheMem → resolve synchronously and
    // SKIP the SQLite read entirely.
    const memHit = getLayoutCacheSync(pageNum, textStyle, false, keySparse, keyW);
    if (memHit !== undefined) {
      applyHit(memHit);
    } else {
      getPageLayoutCache(pageNum, textStyle, false, keySparse, keyW).then(applyHit);
    }
    // (b/c) Deferred ±4 preload: warms the neighbour rows into layoutCacheMem in ONE query,
    // pushed to runAfterInteractions so it can never block the render. Keys already present in
    // layoutCacheMem are re-stored with identical values (no-op) — only genuinely-missing keys
    // ever touch SQLite.
    InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      preloadPageLayoutCacheRange(Math.max(1, pageNum - 4), pageNum + 4, textStyle, false, keySparse, keyW);
    });
    return () => { cancelled = true; };
  }, [pageNum, textStyle, pageWidth, fontSizeScale, fixNonce, headerVisible]);

  /**
   * handleWordMeasured(lineKey, wordIdx, w, expected) — core of the measure-then-scale dance.
   * Accumulates measured word widths per line; when every line is complete and nothing written
   * yet, persists the sums to the layout cache.
   * FLOW:
   *   1. Bail when the cache already loaded (cache-hit path needs no measuring); font not ready.
   *   2. Normalize each measured width by normFontSize into the NORMALIZED (font-size-independent)
   *      unit — the persisted sums are always in these units, and the cache-hit replay multiplies
   *      them back by the current base size. Measured once per device, replayed forever.
   *   3. On complete: track in completedLinesRef; when ALL lines (counted only where the line
   *      holds any real Arabic word) are done and nothing written yet → build sums[] indexed
   *      0..maxLineIdx and savePageLayoutCache. Write-back omits lineExtra — correct, because
   *      extra is notes-dependent and re-derived per render.
   * SINGLE-COMMIT scaling (no progressive per-word rescale): every word of the page measures at
   * scale 1, and ALL line scales are applied in ONE state update at completion (layoutContentRef
   * + setLineScale({}) switch scaleForLine to the arithmetic path). This kills the visible
   * "font fixing / Y offset changing for seconds" artifact — a cold page settles with a single
   * snap instead of re-sizing word by word — and slashes the re-renders per measure pass.
   * NOTES/QUIRKS:
   *   - expected comes from the render-time closure (words where hasArabicLetters(stripPua(word)))
   *     and matches the RENDERED WordHitArea count exactly, so completeness is exact.
   *   - During the measure pass lines render at scale 1, so overflowing lines may briefly spill
   *     past the inner rule until the single completion snap — acceptable vs. multi-second jitter.
   */
  const handleWordMeasured = (lineKey: number, wordIdx: number, w: number, expected: number) => {
    if (frozenRef.current) return;
    if (!fontReady) return;
    // P1-E — freeze the normalization base for this whole pass (see passNormFontSizeRef): a
    // mid-pass box resize must not remix the units of an in-flight row. The vertical fit is
    // frozen at the SAME moment (fitAtPassRef): the persisted sums are in units of base size x
    // the frozen fontScale, so the row's fit MUST be the one in effect at this render — a later
    // cache-hit replay then pairs the sums with exactly the base they were normalized by.
    let passBase = passNormFontSizeRef.current;
    if (!passBase) {
      passBase = normFontSize;
      passNormFontSizeRef.current = passBase;
      fitAtPassRef.current = { boxH: innerH, headerVisible, pitchScale, fontScale };
    }
    // Normalize to the font-size-independent unit — the persisted sums are always in these
    // units, and the cache-hit replay multiplies them back by the current base size.
    w = passBase > 0 ? w / passBase : 0;
    if (!widthsRef.current[lineKey]) widthsRef.current[lineKey] = [];
    if (widthsRef.current[lineKey][wordIdx] === undefined) {
      filledCountRef.current[lineKey] = (filledCountRef.current[lineKey] || 0) + 1;
    }
    widthsRef.current[lineKey][wordIdx] = w;
    const complete = (filledCountRef.current[lineKey] || 0) >= expected;
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
        // Measure pass concluded (cache-MISS path only — a cache-hit mount never reaches here:
        // frozenRef is set immediately on hit). Persist the freshly measured sums ONCE, paired
        // with the fit frozen at the pass start (fitAtPassRef — set before the first width was
        // recorded, so every completion that reaches this point carries it), then freeze: no
        // verification pass, no re-measure, no pulsing — a page is measured once per device and
        // replayed forever from SQLite.
        layoutContentRef.current = sums;
        setLineScale({});
        // P0-C — the hidden pre-measure slot (persistLayout=false) keeps its row in
        // layoutCacheMem ONLY: background writes must never queue behind the reader's own
        // connection traffic; visible pages always persist (savePageLayoutCache → SQLite).
        const fitRow: PageLayoutCacheRow = { lines: sums, fit: fitAtPassRef.current };
        if (persistLayout) savePageLayoutCache(pageNum, textStyle, false, sparse ? 1 : 0, Math.round(pageWidth * fontSizeScale), fitRow);
        else savePageLayoutCacheMemOnly(pageNum, textStyle, false, sparse ? 1 : 0, Math.round(pageWidth * fontSizeScale), fitRow);
        // The page's layout row is now persisted; onMeasured lets an optional hidden-instance
        // owner know the row is settled.
        if (onMeasured) onMeasured(pageNum);
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
      const lineW = layoutW - 2 * padSide;
      const live = (widthsRef.current[lineIdx] || []).reduce((a, b) => a + (b || 0), 0);
      // Cached sums are normalized units — multiply back by the CURRENT base size.
      const total = Math.max(layoutContentRef.current[lineIdx] || 0, live) * normFontSize + (lineExtraRef.current[lineIdx] || 0);
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
  //   the OrnamentalFrame page border + the corner badges: Juz pill (top-left) and surah-name
  //   pill (top-right), plus the optional reading-mark bookmark button (top-right, left of the
  //   surah pill). Badges ALWAYS render (header visibility does not gate them) and sit in the
  //   top margin band OUTSIDE the frame: top pills at top: -22 lift them above the top band
  //   edge (wrapper marginTop is 24). The bottom band (Page N / N pages left pills — v93) hangs
  //   from the frame's bottom edge at bottom: -22 into the wrapper's 24px bottom margin band,
  //   scrolling with the page exactly like the top pills; the screen-level strip (QuranViewScreen)
  //   keeps only the Hide/Show-Header button.
  //   compact (<600px) shrinks the pill styles.
  // hideFrame (hidden pre-render harness only): skips the OrnamentalFrame entirely — hidden
  //   off-screen pages must NOT touch the shared frame_cache/SESSION_BOX (a different-height
  //   hidden box would leak into every visible page's frame and squash it). Word measurement
  //   is frame-independent (textInsetFor is width-only), so hidden pages measure identically.
  const overlayLayer = (
    <View style={[StyleSheet.absoluteFill, { zIndex: 10 }]} pointerEvents="box-none">
      {!hideFrame && <OrnamentalFrame color={frameC} bg={badgeBg} nightMode={nightMode} />}
      {firstSurahId > 0 && (
        <View pointerEvents="none" style={[styles(nightMode).badgePill, styles(nightMode).topLeft, { borderColor: frameC, backgroundColor: badgeBg }, compact && styles(nightMode).badgePillCompact]}>
          <Text style={[styles(nightMode).badgeText, { color: grayC }, compact && styles(nightMode).badgeTextCompact]}>Juz {juzInfo.juz}</Text>
        </View>
      )}
      {firstSurahId > 0 && (
        <View pointerEvents="none" style={[styles(nightMode).badgePill, styles(nightMode).topRight, { borderColor: frameC, backgroundColor: badgeBg }, compact && styles(nightMode).badgePillCompact]}>
          <Text style={[styles(nightMode).badgeText, { color: grayC }, compact && styles(nightMode).badgeTextCompact]}>{surahNames?.[firstSurahId] || `Surah ${firstSurahId}`} ({firstSurahId})</Text>
        </View>
      )}
      {showReadingMarkBtn && onReadingMarkToggle && (
        // position/top/right MUST live on the TutorialAnchor wrapper, not the button: the
        // anchor View is an in-flow child of this absolute-fill layer, so an absolute button
        // inside an unstyled anchor positions against the anchor's 0x0 box (lands off-screen)
        // AND the anchor measures 0x0 so the spotlight never finds it (same bug class as the
        // v99.0 draw-toolbar fix). active={isCurrentPage}: the page FlatList keeps neighbour
        // pages mounted — only the CURRENT page may register 'reading-ribbon', otherwise the
        // neighbours' offscreen measures race this page's and the spotlight flashes between
        // the ribbon and the top-left corner.
        <TutorialAnchor id="reading-ribbon" active={isCurrentPage} style={{ position: 'absolute', top: -22, right: -4, zIndex: 20, elevation: 20 }}>
        <TouchableOpacity style={styles(nightMode).readingMarkBtn} onPress={onReadingMarkToggle} activeOpacity={0.5} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <BookmarkIcon c={nightMode ? '#7BA7DB' : '#1C3D72'} s={20} filled={readingMarkActive} />
        </TouchableOpacity>
        </TutorialAnchor>
      )}
      {/* v93 — bottom chrome row, mirror of the top pills: the "Page N" + "N pages left in Juz"
          pills PLUS the Hide/Show-Header button, all hanging from the frame's bottom edge
          (bottom: -22, same straddle the top pills use) into the page cell's 24px bottom margin
          band, so the WHOLE row scrolls with the page. Hide button left, Page N horizontally
          centered, pages-left pill right. Same badgePill/badgeText chip styling. Hidden during
          share capture (keeps captured JPGs clean). */}
      {pageNum > 0 && !hideBottomChrome && (
        <View pointerEvents="box-none" style={styles(nightMode).bottomPillRow}>
          {onToggleHeader && (
            <TouchableOpacity style={styles(nightMode).headerToggleBtn} onPress={onToggleHeader} activeOpacity={0.75} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles(nightMode).headerToggleText}>{headerVisible ? 'Hide Header' : 'Show Header'}</Text>
            </TouchableOpacity>
          )}
          <View pointerEvents="none" style={styles(nightMode).bottomCenterWrap}>
            <View style={[styles(nightMode).badgePill, { borderColor: frameC, backgroundColor: badgeBg }, compact && styles(nightMode).badgePillCompact]}>
              <Text style={[styles(nightMode).badgeText, { color: grayC }, compact && styles(nightMode).badgeTextCompact]}>Page {pageNum + 1}</Text>
            </View>
          </View>
          <View pointerEvents="none" style={[styles(nightMode).badgePill, { borderColor: frameC, backgroundColor: badgeBg }, compact && styles(nightMode).badgePillCompact]}>
            <Text style={[styles(nightMode).badgeText, { color: grayC }, compact && styles(nightMode).badgeTextCompact]}>{juzInfo.pagesLeft} pages left in Juz</Text>
          </View>
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
  // FIX 4 — page JSON missing AND no verse fallback: render the frame + a centered spinner in
  // the same container (onLayout still captures the true box height), never a black/empty void.
  if (!pageData || !pageData.lines || pageData.lines.length === 0) {
    if (!versesForPage || versesForPage.length === 0) {
      return (
        <View style={[styles(nightMode).container, { paddingHorizontal: padSide, paddingTop: padTop, paddingBottom: padBottom }]} onLayout={onBoxLayout}>
          <View style={styles(nightMode).skeletonWrap}>
            <ActivityIndicator size="large" color={nightMode ? '#7BA7DB' : '#1C3D72'} />
          </View>
          {overlayLayer}
          {actionPills}
        </View>
      );
    }
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
                      <Text style={[styles(nightMode).verseBadgeText, { color: nightMode ? '#fff' : '#121212' }, fBookmarked && styles(nightMode).bookmarkedBadgeText]}>{fReadingMark ? '📍' : v.verseNumber}</Text>
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
  // no measurement starts before it. CACHE-HIT mounts with a replayable one-shot fit paint
  // IMMEDIATELY: the replayed pitchScale/fontScale need neither the box height nor the font
  // gate, so the first painted frame is the full mushaf — no ActivityIndicator, no innerH
  // round-trip, no re-measure (v62's synchronous width replay, restored for the vertical fit).
  // ALL other states wait for fontReady + innerH: a miss must measure with the real font on the
  // settled box, and a hit whose stored fit does NOT match the current box/header (validated by
  // onBoxLayout's synchronous first-measure on the frame after mount) falls back to the live fit
  // math — v81 behavior, unchanged. FIX 4 — while pending, render the frame + spinner (same
  // container size so onBoxLayout still captures the true height), never a black void.
  if (cacheState === 'loading' || (!replayFit && (!fontReady || innerH === 0))) {
    return (
      <View style={[styles(nightMode).container, { paddingHorizontal: padSide, paddingTop: padTop, paddingBottom: padBottom }]} onLayout={onBoxLayout}>
        <View style={styles(nightMode).skeletonWrap}>
          <ActivityIndicator size="large" color={nightMode ? '#7BA7DB' : '#1C3D72'} />
        </View>
        {overlayLayer}
        {actionPills}
      </View>
    );
  }

  // Main mushaf layout — one row-reverse Pressable per line (RTL word order), with a
  // verse-boundary badge after the word that ends each verse. 'surah-header' lines are skipped
  // entirely; 'basmala' lines get their own centered header style (hardcoded Arabic text,
  // fitted to the line slot so it never spills under the frame). Sparse pages justify
  // lines space-around.
  return (
    <View style={[styles(nightMode).container, { paddingHorizontal: padSide, paddingTop: padTop, paddingBottom: padBottom }]} onLayout={onBoxLayout}>
      {pageData.lines.map((line: any, lineIdx: number) => {
        const taawud = taawudLineSet.has(lineIdx) ? (
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
          return <React.Fragment key={lineIdx}><View style={[styles(nightMode).headerLine, { borderBottomColor: lineColor }]}><Text style={[styles(nightMode).headerText, { color: textColor, fontFamily, fontSize: basmalaFontSize, lineHeight: basmalaLineH }]}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text></View></React.Fragment>;
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
                const badgeEl = (
                      <View style={styles(nightMode).verseBadgeContainer}>
                        <TouchableOpacity onPress={(e: any) => onBadgePress ? onBadgePress(verseNum, e?.nativeEvent?.pageY) : onBookmarkToggle(verseNum, parseInt(surahId, 10))}>
                          <View style={[styles(nightMode).verseBadge, { backgroundColor: nightMode ? '#1e1e1e' : '#e8e8e8' }, isBookmarked && styles(nightMode).bookmarkedBadge, isReadingMark && styles(nightMode).readingMarkBadge]}>
                            <Text style={[styles(nightMode).verseBadgeText, { color: nightMode ? '#fff' : '#121212' }, isBookmarked && styles(nightMode).bookmarkedBadgeText]}>{isReadingMark ? '📍' : verseNum}</Text>
                          </View>
                        </TouchableOpacity>
                        {hasNote && <Text style={styles(nightMode).noteIcon}>📝</Text>}
                      </View>
                );
                return (
                  <React.Fragment key={wordIdx}>
                    {isVerseBoundary && badgeEl}
                  </React.Fragment>
                );
              }

              return (
                <React.Fragment key={wordIdx}>
                  <WordHitArea tapFraction={WORD_TAP_FRACTION} style={styles(nightMode).wordBox}
                    onWordPress={() => verseNum > 0 && onWordPress(verseNum, wordPos - 1, parseInt(surahId, 10))} onDeadTap={onDeadTap}
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
                          <Text style={[styles(nightMode).verseBadgeText, { color: nightMode ? '#fff' : '#121212' }, isBookmarked && styles(nightMode).bookmarkedBadgeText]}>{isReadingMark ? '📍' : verseNum}</Text>
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
  skeletonWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  topRight: { position: 'absolute', top: -22, right: 30 },
  readingMarkBtn: {},
  bottomLeftRow: { position: 'absolute', bottom: 2, left: 10, flexDirection: 'row', alignItems: 'center' },
  // v93 — the bottom chrome row hangs from the frame's bottom edge like the top pills do at
  // top: -22; the page cell's 24px bottom margin gives it room (the whole row scrolls with the
  // page). Hide button left, Page N absolutely centered, pages-left pill right. box-none on the
  // row so only the Hide button is tappable (the pills pass taps through, like the top pills).
  bottomPillRow: { position: 'absolute', bottom: -22, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6 },
  bottomCenterWrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  headerToggleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: nightMode ? 'rgba(18,18,20,0.78)' : 'rgba(255,255,255,0.92)', borderWidth: 1, borderColor: nightMode ? 'rgba(255,255,255,0.18)' : 'rgba(28,61,114,0.30)' },
  headerToggleText: { color: (nightMode ? '#7BA7DB' : '#1C3D72'), fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  actionPillGap: { marginRight: 6 }
});

// memo export — see component NOTES: largely ineffective due to prop identity churn
// (pageData/highlights/bookmarks/notes change on parent re-renders).
export default memo(MushafPageView);