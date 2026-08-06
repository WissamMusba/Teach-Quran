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
import OrnamentalFrame from './OrnamentalFrame';
import { getPageLayoutCache, savePageLayoutCache } from '../../database/localDB';

const SCREEN_WIDTH = Dimensions.get('window').width;
const hPad = (w: number) => (w >= 600 ? w * 0.08 : 10);
// Cache-key version bump: old rows were persisted from PARTIAL (under-counted) widths and cause
// overflow on reload. Bump the number to invalidate stale rows app-wide; one clean re-measure
// rewrites them. Must be added identically at EVERY get/save call site.
const CACHE_VERSION = 1;
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
 *   - onBookmarkToggle(verseNum, surahId) — bookmark toggle from the verse badge.
 *   - bookmarks, notes, readingMarkVerse, flashingVerseKey — per-verse badge state.
 *   - onDeadTap(pageY) — tap on line background/word margins → toggle header.
 *   - fixNonce (default 0) — bump to force full re-measure + cache reload ("Fix font").
 *   - onFixFont — "Fix font" pill → clearPageLayoutCacheRange ±3 pages in the parent.
 *   - onSpread / spread — tablet spread-mode toggle pill (split mode only).
 * CALLED BY: QuranViewScreen.tsx — SpreadItem (split/two-page mode) and single-page renderItem.
 * NOTES:
 *   - memo() export is largely ineffective: pageData/highlights/bookmarks/notes prop identities
 *     change on parent re-renders; versesForPage comes from a state cache so it stays stable.
 *   - verseByKey (below) is DEAD CODE — built from versesForPage but never referenced.
 *   - Cache-hit sums can UNDER-COUNT overflowed lines: once a line gets scaled, later word
 *     measurements for it early-return, so the persisted sum for that line is partial; restored
 *     scales on a cache hit may differ from first-visit ones until "Fix font" re-measures.
 *   - headerVisible is absent from BOTH effect dep arrays: toggling the header shifts fs (cache
 *     key) but does NOT clear measurement refs — a stale-measure/cache mismatch window for which
 *     the fixNonce bump is the recovery path.
 *   - maxFontSizeMultiplier={1} on word/fallback Text — the app owns font scaling; the OS must
 *     not re-inflate text sizes.
 */
const MushafPageView = ({ headerVisible = true, pageNum = 0, pageWidth = SCREEN_WIDTH, surahNames = {}, versesForPage, pageData, highlights, onWordPress, onVerseLongPress, onBookmarkToggle, bookmarks, flashingVerseKey, notes, readingMarkVerse, onDeadTap, fixNonce = 0, onFixFont, onSpread, spread }: any) => {
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
  const frameC = nightMode ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.14)';
  const badgeBg = nightMode ? 'rgba(18,18,20,0.85)' : 'rgba(255,255,255,0.88)';
  const mushafFontSize = getMushafFontSize(headerVisible);
  const mushafLineHeight = getMushafLineHeight(headerVisible);
  /**
   * getFontAdj(ts, hv) — per-font size/vertical-offset corrections so each mushaf font sits at
   * the right visual height. switch: saleem +2, alqalam/uthmani +0, lateef +4, scheherazade
   * -1/+2y when the header is visible, default +0. The result feeds fs (and thus the cache key)
   * and the word Text translateY transform (transform array only when adj.y is non-zero).
   * NOTES: hardcoded tuning values — a rebuild could move this into theme.ts.
   */
  const getFontAdj = (ts: string, hv: boolean) => {
    switch (ts) {
      case 'saleem': return { size: 2, y: 0 };
      case 'alqalam': return { size: 0, y: 0 };
      case 'uthmani': return { size: 0, y: 0 };
      case 'lateef': return { size: 4, y: 0 };
      case 'scheherazade': return { size: hv ? -1 : 0, y: 2 };
      default: return { size: 0, y: 0 };
    }
  };
  const adj = getFontAdj(textStyle, headerVisible);
  const compact = pageWidth < 600;

  // Sparse-page detection: count words across pageData lines (else whitespace-split fallback
  // verses); sparse → SPARSE_FONT_BOOST on fontSize AND lineHeight. fs rounds into the layout
  // cache key — any font-size shift (textStyle, header visibility, sparse flag) reloads the row.
  const totalWords = pageData?.lines
    ? pageData.lines.reduce((a: number, l: any) => a + (l.words ? l.words.length : 0), 0)
    : (versesForPage || []).reduce((a: number, v: any) => a + ((v.textArabic || '').trim().split(/\s+/).filter(Boolean).length), 0);
  const sparse = totalWords < SPARSE_WORD_THRESHOLD;
  const fs = Math.round((mushafFontSize + adj.size) * (sparse ? SPARSE_FONT_BOOST : 1));

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
  const [cacheState, setCacheState] = useState<'loading' | 'miss' | 'hit'>('loading');
  const [fontReady, setFontReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    setFontReady(false);
    const t = setTimeout(() => { if (mounted) setFontReady(true); }, 150);
    return () => { mounted = false; clearTimeout(t); };
  }, [fontFamily, pageNum, fixNonce]);

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

  // Reset effect — a page/font/width/fixNonce change invalidates ALL measurement state and pushes
  // the pipeline back to 'loading' so the next pass starts clean. NOTE: headerVisible is absent
  // from the deps (and from the cache key — hardcoded false at both DB call sites), yet it still
  // shifts fs which IS in the cache key; a fixNonce bump is the recovery path (see component
  // NOTES).
  useEffect(() => {
    scaleRef.current = {};
    widthsRef.current = {};
    lineExtraRef.current = {};
    filledCountRef.current = {};
    layoutContentRef.current = null;
    completedLinesRef.current = new Set();
    cacheWrittenRef.current = false;
    setLineScale({});
    setCacheState('loading');
  }, [pageNum, textStyle, pageWidth, fixNonce]);

  // Cache-load effect — async SQLite read of the layout sums; 'hit' → layoutContentRef set and
  // scaleForLine switches to the arithmetic single-pass path; 'miss' → measurement path. The
  // cancellation flag guards the unmount race. Deps mirror the reset effect (no headerVisible).
  useEffect(() => {
    if (!fontReady || !pageData?.lines?.length) return;
    let cancelled = false;
    getPageLayoutCache(pageNum, textStyle, false, fs + CACHE_VERSION, sparse ? 1 : 0, Math.round(pageWidth))
      .then((cached) => {
        if (cancelled) return;
        if (cached) {
          layoutContentRef.current = cached;
          setCacheState('hit');
          scheduleVerify();
        } else {
          setCacheState('miss');
        }
      });
    return () => { cancelled = true; };
  }, [pageNum, textStyle, fs, pageWidth, fixNonce, fontReady]);

  const scheduleVerify = useCallback(() => {
    setTimeout(() => commitVerify(), 350);
  }, []);

  const commitVerify = useCallback(() => {
    const fresh = widthsRef.current;
    const keys = Object.keys(fresh).map(Number);
    if (keys.length === 0) return;
    const lineW = pageWidth - 2 * hPad(pageWidth);
    const sums: number[] = [];
    for (let k = 0; k <= Math.max(...keys); k++) {
      const arr = fresh[k];
      sums[k] = arr ? arr.reduce((a: number, b: number) => a + (b || 0), 0) + (lineExtraRef.current[k] || 0) : 0;
    }
    const saved = layoutContentRef.current || [];
    const differs = sums.length !== saved.length ||
      sums.some((s, i) => Math.abs(s - (saved[i] || 0)) > 1.5);
    if (differs) {
      layoutContentRef.current = sums;
      setLineScale({});
      savePageLayoutCache(pageNum, textStyle, false, fs + CACHE_VERSION, sparse ? 1 : 0, Math.round(pageWidth), sums);
    }
  }, [pageNum, textStyle, fs, pageWidth, sparse]);

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
    if (!fontReady) return;
    if (layoutContentRef.current) return;
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
    const lineW = pageWidth - 2 * hPad(pageWidth);
    const content = arr.reduce<number>((a, b) => a + (b || 0), 0) + (lineExtraRef.current[lineKey] || 0);
    const complete = (filledCountRef.current[lineKey] || 0) >= expected;
    if (content > (complete ? lineW + 2 : lineW)) {
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
        cacheWrittenRef.current = true;
        const keys = Object.keys(widthsRef.current).map(Number);
        if (keys.length === 0) return;
        const sums: number[] = [];
        for (let k = 0; k <= Math.max(...keys); k++) {
          const arr = widthsRef.current[k];
          sums[k] = arr ? arr.reduce((a, b) => a + (b || 0), 0) : 0;
        }
        savePageLayoutCache(pageNum, textStyle, false, fs + CACHE_VERSION, sparse ? 1 : 0,
          Math.round(pageWidth), sums);
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
      const lineW = pageWidth - 2 * hPad(pageWidth);
      const total = (layoutContentRef.current[lineIdx] || 0) + (lineExtraRef.current[lineIdx] || 0);
      return total > lineW + 2 ? Math.max(0.5, (lineW - 12) / total) : 1;
    }
    return lineScale[lineIdx] || 1;
  };

  // overlayLayer — absolute-fill pointerEvents="none" layer (never intercepts taps) holding the
  // OrnamentalFrame page border + up to four corner/bottom badges: Juz pill (top-left),
  // pages-left (bottom-right), surah name (top-right), page number (bottom-mid). All badges are
  // hidden while headerVisible and gated on pageNum > 0 / firstSurahId > 0 (firstSurahId parsed
  // from the first word's location "surah:verse"); compact (<600px) shrinks the pill styles.
  const overlayLayer = (
    <View style={[StyleSheet.absoluteFill, { zIndex: 10 }]} pointerEvents="none">
      <OrnamentalFrame color={frameC} bg={badgeBg} nightMode={nightMode} />
      {!headerVisible && firstSurahId > 0 && (
        <View style={[styles.badgePill, styles.topLeft, { borderColor: frameC, backgroundColor: badgeBg }, compact && styles.badgePillCompact]}>
          <Text style={[styles.badgeText, { color: grayC }, compact && styles.badgeTextCompact]}>Juz {juzInfo.juz}</Text>
        </View>
      )}
      {!headerVisible && pageNum > 0 && (
        <View style={[styles.badgePill, styles.bottomRight, { borderColor: frameC, backgroundColor: badgeBg }, compact && styles.badgePillCompact]}>
          <Text style={[styles.badgeText, { color: grayC }, compact && styles.badgeTextCompact]}>{juzInfo.pagesLeft} pages left in Juz</Text>
        </View>
      )}
      {!headerVisible && firstSurahId > 0 && (
        <View style={[styles.badgePill, styles.topRight, { borderColor: frameC, backgroundColor: badgeBg }, compact && styles.badgePillCompact]}>
          <Text style={[styles.badgeText, { color: grayC }, compact && styles.badgeTextCompact]}>{surahNames?.[firstSurahId] || `Surah ${firstSurahId}`} ({firstSurahId})</Text>
        </View>
      )}
      {!headerVisible && pageNum > 0 && (
        <View style={[styles.badgePill, styles.bottomMid, { borderColor: frameC, backgroundColor: badgeBg }, compact && styles.badgePillCompact]}>
          <Text style={[styles.badgeText, { color: grayC }, compact && styles.badgeTextCompact]}>Page {pageNum + 1}</Text>
        </View>
      )}
    </View>
  );

  // actionPills — bottom-left pill cluster, shown ONLY when the header is hidden AND at least one
  // of onFixFont/onSpread is provided: "Fix font" (always, when onFixFont → parent clears the
  // layout-cache range ±3 pages + bumps fixNonce) and the tablet spread toggle (when onSpread).
  // NOTE: the spread pill renders the same 'Spread' label for both states — the active/inactive
  // label distinction is not implemented here.
  const actionPills = (onFixFont || onSpread) && !headerVisible ? (
    <View style={styles.bottomLeftRow}>
      {onSpread && (
        <TouchableOpacity style={[styles.badgePill, styles.actionPillGap, { borderColor: frameC, backgroundColor: badgeBg }, compact && styles.badgePillCompact]}
          onPress={() => onSpread()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.badgeText, { color: spread ? '#00D4AA' : grayC }, compact && styles.badgeTextCompact]}>{spread ? 'Spread' : 'Spread'}</Text>
        </TouchableOpacity>
      )}
      {onFixFont && (
        <TouchableOpacity style={[styles.badgePill, { borderColor: frameC, backgroundColor: badgeBg }, compact && styles.badgePillCompact]}
          onPress={() => onFixFont()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.badgeText, { color: grayC }, compact && styles.badgeTextCompact]}>Fix font</Text>
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
      <View style={[styles.container, { paddingHorizontal: hPad(pageWidth) }]}>
        <View style={styles.fallbackBody}>
          {(versesForPage || []).map((v: any, i: number) => {
            const fKey = `${v.surahId}_${v.verseNumber}`;
            const fBookmarked = !!bookmarks?.[fKey];
            const fReadingMark = readingMarkVerse === v.verseNumber;
            const fHasNote = !!notes?.[fKey];
            return (
              <Pressable key={`${fKey}_${i}`} style={styles.fallbackRow} onPress={(e: any) => onDeadTap?.(e?.nativeEvent?.pageY)}>
                <Pressable style={styles.fallbackTextZone}
                  onPress={() => onWordPress(v.verseNumber, 0)}
                  onLongPress={(e: any) => onVerseLongPress(v.verseNumber, e?.nativeEvent?.pageY)}
                  delayLongPress={300}>
                  <Text style={[styles.fallbackText, { fontSize: (mushafFontSize + adj.size) * (sparse ? SPARSE_FONT_BOOST : 1), lineHeight: mushafLineHeight * (sparse ? SPARSE_FONT_BOOST : 1), color: textColor, fontFamily }]} maxFontSizeMultiplier={1}>
                    {v.textArabic}{' '}
                  </Text>
                </Pressable>
                <View style={styles.verseBadgeContainer}>
                  <TouchableOpacity onPress={() => onBookmarkToggle(v.verseNumber, v.surahId)}>
                    <View style={[styles.verseBadge, { backgroundColor: nightMode ? '#1e1e1e' : '#e8e8e8' }, fBookmarked && styles.bookmarkedBadge, fReadingMark && styles.readingMarkBadge]}>
                      <Text style={[styles.verseBadgeText, { color: nightMode ? '#fff' : '#121212' }, fBookmarked && styles.bookmarkedBadgeText]}>{fReadingMark ? '📍' : v.verseNumber}</Text>
                    </View>
                  </TouchableOpacity>
                  {fHasNote && <Text style={styles.noteIcon}>📝</Text>}
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
  if (cacheState === 'loading') {
    return <View style={[styles.container, { paddingHorizontal: hPad(pageWidth) }]} />;
  }

  // Main mushaf layout — one row-reverse Pressable per line (RTL word order), with a
  // verse-boundary badge after the word that ends each verse. 'surah-header' lines are skipped
  // entirely; 'basmala' lines get their own centered header style (hardcoded Arabic text,
  // fontSize 24 * sparse boost). Sparse pages justify lines space-around.
  return (
    <View style={[styles.container, { paddingHorizontal: hPad(pageWidth) }]}>
      {pageData.lines.map((line: any, lineIdx: number) => {
        if (line.type === 'surah-header') {
          return null;
        }
        if (line.type === 'basmala') {
          return <View key={lineIdx} style={[styles.headerLine, { borderBottomColor: lineColor }]}><Text style={[styles.headerText, { color: textColor, fontFamily, fontSize: 24 * (sparse ? SPARSE_FONT_BOOST : 1) }]}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text></View>;
        }
        return (
          <Pressable key={lineIdx} style={[styles.line, { borderBottomColor: lineColor }, sparse && { justifyContent: 'space-around' }]} onPress={(e: any) => onDeadTap?.(e?.nativeEvent?.pageY)}>
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
                      <View style={styles.verseBadgeContainer}>
                        <TouchableOpacity onPress={() => onBookmarkToggle(verseNum, parseInt(surahId, 10))}>
                          <View style={[styles.verseBadge, { backgroundColor: nightMode ? '#1e1e1e' : '#e8e8e8' }, isBookmarked && styles.bookmarkedBadge, isReadingMark && styles.readingMarkBadge]}>
                            <Text style={[styles.verseBadgeText, { color: nightMode ? '#fff' : '#121212' }, isBookmarked && styles.bookmarkedBadgeText]}>{isReadingMark ? '📍' : verseNum}</Text>
                          </View>
                        </TouchableOpacity>
                        {hasNote && <Text style={styles.noteIcon}>📝</Text>}
                      </View>
                    )}
                  </React.Fragment>
                );
              }

              return (
                <React.Fragment key={wordIdx}>
                  <WordHitArea tapFraction={WORD_TAP_FRACTION} style={styles.wordBox}
                    onWordPress={() => verseNum > 0 && onWordPress(verseNum, wordPos - 1)} onDeadTap={onDeadTap}
                    onLongPress={(e: any) => verseNum > 0 && onVerseLongPress(verseNum, e?.nativeEvent?.pageY)} delayLongPress={300}
                    onMeasured={(w) => handleWordMeasured(lineIdx, wordIdx, w, (line.words || []).filter((w: any) => hasArabicLetters(stripPua(w.word))).length)}>
                    <Text style={[styles.text, { fontSize: (mushafFontSize + adj.size) * (scaleForLine(lineIdx)) * (sparse ? SPARSE_FONT_BOOST : 1), lineHeight: mushafLineHeight * (sparse ? SPARSE_FONT_BOOST : 1), color: textColor, fontFamily, transform: adj.y ? [{ translateY: adj.y }] : undefined }, h && MISTAKE_HIGHLIGHT, isFlashing && { backgroundColor: 'rgba(255, 215, 0, 0.2)' }]} maxFontSizeMultiplier={1}>
                      {displayText}{' '}
                    </Text>
                  </WordHitArea>
                  {isVerseBoundary && (
                    <View style={styles.verseBadgeContainer}>
                      <TouchableOpacity onPress={() => onBookmarkToggle(verseNum, parseInt(surahId, 10))}>
                        <View style={[styles.verseBadge, { backgroundColor: nightMode ? '#1e1e1e' : '#e8e8e8' }, isBookmarked && styles.bookmarkedBadge, isReadingMark && styles.readingMarkBadge]}>
                          <Text style={[styles.verseBadgeText, { color: nightMode ? '#fff' : '#121212' }, isBookmarked && styles.bookmarkedBadgeText]}>{isReadingMark ? '📍' : verseNum}</Text>
                        </View>
                      </TouchableOpacity>
                      {hasNote && <Text style={styles.noteIcon}>📝</Text>}
                    </View>
                  )}
                </React.Fragment>
              );
              });
            })()}
          </Pressable>
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
const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 12, paddingVertical: 16, justifyContent: 'space-around', backgroundColor: 'transparent' },
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
  verseBadge: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#00d4aa' },
  bookmarkedBadge: { backgroundColor: '#ffd700', borderColor: '#ffd700' },
  readingMarkBadge: { backgroundColor: '#4a90d9', borderColor: '#4a90d9' },
  verseBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '700', fontFamily: 'normal' },
  bookmarkedBadgeText: { color: '#000000' },
  noteIcon: { color: '#ffd700', fontSize: 10, marginLeft: 2 },
  badgePill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  badgeText: { fontSize: 9.5, fontWeight: '600' },
  badgePillCompact: { paddingVertical: 4, paddingHorizontal: 4 },
  badgeTextCompact: { fontSize: 8.5 },
  topLeft: { position: 'absolute', top: 2, left: 10 },
  topRight: { position: 'absolute', top: 2, right: 40 },
  bottomMid: { position: 'absolute', bottom: 2, alignSelf: 'center' },
  bottomRight: { position: 'absolute', bottom: 2, right: 10 },
  bottomLeftRow: { position: 'absolute', bottom: 2, left: 10, flexDirection: 'row', alignItems: 'center' },
  actionPillGap: { marginRight: 6 }
});

// memo export — see component NOTES: largely ineffective due to prop identity churn
// (pageData/highlights/bookmarks/notes change on parent re-renders).
export default memo(MushafPageView);