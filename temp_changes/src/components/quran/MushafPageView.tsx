import React, { memo, useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Pressable } from 'react-native';
import { getMushafFontSize, getMushafLineHeight } from '../../utils/responsive';
import { WORD_TAP_FRACTION, MISTAKE_HIGHLIGHT } from '../../utils/constants';
import WordHitArea from '../common/WordHitArea';
import OrnamentalFrame from './OrnamentalFrame';
import { getPageLayoutCache, savePageLayoutCache } from '../../database/localDB';

const SCREEN_WIDTH = Dimensions.get('window').width;
const hPad = (w: number) => (w >= 600 ? w * 0.08 : 16);
import { getArabicFont, getJuzInfoFromPage } from '../../utils/theme';
import { useSelector } from 'react-redux';

const puaCache = new Map<string, string>();
const PUA_CACHE_MAX = 2000;
const stripPua = (t: string) => {
  const cached = puaCache.get(t);
  if (cached !== undefined) return cached;
  const result = (t || '').replace(/[\uE000-\uF8FF]/g, '');
  if (puaCache.size >= PUA_CACHE_MAX) puaCache.delete(puaCache.keys().next().value);
  puaCache.set(t, result);
  return result;
};
const hasArabicLetters = (t: string) => /[\u0621-\u064A\u0671-\u06D3\u06D5\u06FA-\u06FC\u0750-\u077F\u08A0-\u08FF]/u.test(t);

const SPARSE_WORD_THRESHOLD = 50;
const SPARSE_FONT_BOOST = 1.3;

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
    extra += 40;
    if (notes?.[`${loc[0] || '0'}_${verseNum}`]) extra += 16;
  });
  return extra;
};

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

  const totalWords = pageData?.lines
    ? pageData.lines.reduce((a: number, l: any) => a + (l.words ? l.words.length : 0), 0)
    : (versesForPage || []).reduce((a: number, v: any) => a + ((v.textArabic || '').trim().split(/\s+/).filter(Boolean).length), 0);
  const sparse = totalWords < SPARSE_WORD_THRESHOLD;
  const fs = Math.round((mushafFontSize + adj.size) * (sparse ? SPARSE_FONT_BOOST : 1));

  const [lineScale, setLineScale] = useState<Record<number, number>>({});
  const scaleRef = useRef<Record<number, number>>({});
  const widthsRef = useRef<Record<number, (number | undefined)[]>>({});
  const lineExtraRef = useRef<Record<number, number>>({});
  const filledCountRef = useRef<Record<number, number>>({});
  const layoutContentRef = useRef<number[] | null>(null);
  const completedLinesRef = useRef<Set<number>>(new Set());
  const cacheWrittenRef = useRef(false);
  const [cacheState, setCacheState] = useState<'loading' | 'miss' | 'hit'>('loading');

  const verseByKey = new Map<string, any>();
  if (versesForPage) {
    for (const v of versesForPage) {
      const key = `${v.surahId}_${v.verseNumber}`;
      if (!verseByKey.has(key)) verseByKey.set(key, v);
    }
  }
  const hlMap = new Map<string, any>(Object.entries(highlights || {}));

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
  }, [pageNum, headerVisible, textStyle, pageWidth, fixNonce]);

  useEffect(() => {
    if (!pageData || !pageData.lines || pageData.lines.length === 0) return;
    let cancelled = false;
    getPageLayoutCache(pageNum, textStyle, headerVisible, fs, sparse ? 1 : 0, Math.round(pageWidth))
      .then((cached) => {
        if (cancelled) return;
        if (cached) { layoutContentRef.current = cached; setCacheState('hit'); }
        else setCacheState('miss');
      });
    return () => { cancelled = true; };
  }, [pageNum, textStyle, headerVisible, fs, pageWidth, fixNonce]);

  const handleWordMeasured = (lineKey: number, wordIdx: number, w: number, expected: number) => {
    if (layoutContentRef.current) return;
    if (scaleRef.current[lineKey]) return;
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
      const scale = Math.max(0.65, (lineW - 12) / content);
      scaleRef.current[lineKey] = scale;
      setLineScale(prev => ({ ...prev, [lineKey]: scale }));
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
        savePageLayoutCache(pageNum, textStyle, headerVisible, fs, sparse ? 1 : 0,
          Math.round(pageWidth), sums);
      }
    }
  };

  const scaleForLine = (lineIdx: number) => {
    if (layoutContentRef.current) {
      const lineW = pageWidth - 2 * hPad(pageWidth);
      const total = (layoutContentRef.current[lineIdx] || 0) + (lineExtraRef.current[lineIdx] || 0);
      return total > lineW + 2 ? Math.max(0.65, (lineW - 12) / total) : 1;
    }
    return lineScale[lineIdx] || 1;
  };

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

  if (cacheState === 'loading') {
    return <View style={[styles.container, { paddingHorizontal: hPad(pageWidth) }]} />;
  }

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
  verseBadgeContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 4, flexShrink: 1, minWidth: 24 },
  verseBadge: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#00d4aa' },
  bookmarkedBadge: { backgroundColor: '#ffd700', borderColor: '#ffd700' },
  readingMarkBadge: { backgroundColor: '#4a90d9', borderColor: '#4a90d9' },
  verseBadgeText: { color: '#ffffff', fontSize: 14, fontWeight: '700', fontFamily: 'normal' },
  bookmarkedBadgeText: { color: '#000000' },
  noteIcon: { color: '#ffd700', fontSize: 12, marginLeft: 4 },
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

export default memo(MushafPageView);