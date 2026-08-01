import React, { memo, useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Pressable } from 'react-native';
import { getMushafFontSize, getMushafLineHeight } from '../../utils/responsive';
import { WORD_TAP_FRACTION, MISTAKE_HIGHLIGHT } from '../../utils/constants';
import WordHitArea from '../common/WordHitArea';

const SCREEN_WIDTH = Dimensions.get('window').width;
const IS_TABLET = SCREEN_WIDTH >= 600;
const HORIZ_PAD = IS_TABLET ? SCREEN_WIDTH * 0.08 : 16;
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

const MushafPageView = ({ headerVisible = true, pageNum = 0, surahNames = {}, versesForPage, pageData, highlights, onWordPress, onVerseLongPress, onBookmarkToggle, bookmarks, flashingVerseKey, notes, readingMarkVerse, onDeadTap }: any) => {
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

  const [lineScale, setLineScale] = useState<Record<number, number>>({});
  const scaleRef = useRef<Record<number, number>>({});
  const widthsRef = useRef<Record<number, (number | undefined)[]>>({});
  const lineExtraRef = useRef<Record<number, number>>({});
  const filledCountRef = useRef<Record<number, number>>({});

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
    setLineScale({});
  }, [headerVisible, textStyle]);

  const handleWordMeasured = (lineKey: number, wordIdx: number, w: number, expected: number) => {
    if (scaleRef.current[lineKey]) return;
    if (!widthsRef.current[lineKey]) widthsRef.current[lineKey] = [];
    if (widthsRef.current[lineKey][wordIdx] === undefined) {
      filledCountRef.current[lineKey] = (filledCountRef.current[lineKey] || 0) + 1;
    }
    widthsRef.current[lineKey][wordIdx] = w;
    const arr = widthsRef.current[lineKey];
    const content = arr.reduce<number>((a, b) => a + (b || 0), 0) + (lineExtraRef.current[lineKey] || 0);
    const lineW = SCREEN_WIDTH - 2 * HORIZ_PAD;
    const complete = (filledCountRef.current[lineKey] || 0) >= expected;
    if (content > (complete ? lineW + 2 : lineW)) {
      const scale = Math.max(0.65, (lineW - 12) / content);
      scaleRef.current[lineKey] = scale;
      setLineScale(prev => ({ ...prev, [lineKey]: scale }));
    }
  };

  const overlayLayer = (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.frameOuter, { borderColor: frameC }]} />
      <View style={[styles.frameInner, { borderColor: frameC }]} />
      <View style={[styles.corner, { backgroundColor: frameC, top: 5, left: 5 }]} />
      <View style={[styles.corner, { backgroundColor: frameC, top: 5, right: 5 }]} />
      <View style={[styles.corner, { backgroundColor: frameC, bottom: 5, left: 5 }]} />
      <View style={[styles.corner, { backgroundColor: frameC, bottom: 5, right: 5 }]} />
      <Text style={[styles.overlayText, styles.topLeft, { color: grayC }]}>{!headerVisible && firstSurahId > 0 ? `Juz ${juzInfo.juz}` : ''}</Text>
      <Text style={[styles.overlayText, styles.topMid, { color: grayC }]}>{!headerVisible && pageNum > 0 ? `${juzInfo.pagesLeft} pages left in Juz` : ''}</Text>
      <Text style={[styles.overlayText, styles.topRight, { color: grayC }]}>{!headerVisible && firstSurahId > 0 ? `${surahNames?.[firstSurahId] || `Surah ${firstSurahId}`} (${firstSurahId})` : ''}</Text>
      <Text style={[styles.overlayText, styles.bottomMid, { color: grayC }]}>{!headerVisible && pageNum > 0 ? `Page ${pageNum + 1}` : ''}</Text>
    </View>
  );

  if (!pageData || !pageData.lines || pageData.lines.length === 0) {
    return (
      <View style={[styles.container, { paddingHorizontal: HORIZ_PAD }]}>
        <View style={styles.fallbackBody}>
          {(versesForPage || []).map((v: any, i: number) => {
            const fKey = `${v.surahId}_${v.verseNumber}`;
            const fBookmarked = !!bookmarks?.[fKey];
            const fReadingMark = readingMarkVerse === v.verseNumber;
            const fHasNote = !!notes?.[fKey];
            return (
              <Pressable key={`${fKey}_${i}`} style={styles.fallbackRow} onPress={onDeadTap}>
                <Pressable style={styles.fallbackTextZone}
                  onPress={() => onWordPress(v.verseNumber, 0)}
                  onLongPress={(e: any) => onVerseLongPress(v.verseNumber, e?.nativeEvent?.pageY)}
                  delayLongPress={300}>
                  <Text style={[styles.fallbackText, { fontSize: mushafFontSize + adj.size, lineHeight: mushafLineHeight, color: textColor, fontFamily }]} maxFontSizeMultiplier={1}>
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
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingHorizontal: HORIZ_PAD }]}>
      {pageData.lines.map((line: any, lineIdx: number) => {
        if (line.type === 'surah-header') {
          return null;
        }
        if (line.type === 'basmala') {
          return <View key={lineIdx} style={[styles.headerLine, { borderBottomColor: lineColor }]}><Text style={[styles.headerText, {color: textColor, fontFamily}]}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text></View>;
        }
        return (
          <Pressable key={lineIdx} style={[styles.line, { borderBottomColor: lineColor }]} onPress={onDeadTap}>
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
                    onMeasured={(w) => handleWordMeasured(lineIdx, wordIdx, w, (line.words || []).length)}>
                    <Text style={[styles.text, { fontSize: (mushafFontSize + adj.size) * (lineScale[lineIdx] || 1), lineHeight: mushafLineHeight, color: textColor, fontFamily, transform: adj.y ? [{ translateY: adj.y }] : undefined }, h && MISTAKE_HIGHLIGHT, isFlashing && { backgroundColor: 'rgba(255, 215, 0, 0.2)' }]} maxFontSizeMultiplier={1}>
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
  frameOuter: { position: 'absolute', top: 5, bottom: 5, left: 5, right: 5, borderWidth: 1.2, borderRadius: 18 },
  frameInner: { position: 'absolute', top: 10, bottom: 10, left: 10, right: 10, borderWidth: 1, borderRadius: 13 },
  corner: { position: 'absolute', width: 8, height: 8, borderRadius: 2, transform: [{ rotate: '45deg' }] },
  overlayText: { position: 'absolute', fontSize: 11, fontWeight: '600' },
  topLeft: { top: 9, left: 18 },
  topMid: { top: 9, left: 0, right: 0, textAlign: 'center' },
  topRight: { top: 14, right: 52 },
  bottomMid: { bottom: 7, left: 0, right: 0, textAlign: 'center' }
});

export default memo(MushafPageView);