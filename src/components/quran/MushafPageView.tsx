import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { getMushafFontSize, getMushafLineHeight } from '../../utils/responsive';

const SCREEN_WIDTH = Dimensions.get('window').width;
const IS_TABLET = SCREEN_WIDTH >= 600;
const HORIZ_PAD = IS_TABLET ? SCREEN_WIDTH * 0.04 : 12;
import { getArabicFont } from '../../utils/theme';
import { useSelector } from 'react-redux';

const MushafPageView = ({ headerVisible = true, versesForPage, pageData, highlights, onWordPress, onVerseLongPress, onBookmarkToggle, bookmarks, flashingVerseKey, notes, readingMarkVerse }: any) => {
  const { nightMode, textBrightness, textStyle } = useSelector((s: any) => ({ nightMode: s.settings.nightMode, textBrightness: s.settings.textBrightness, textStyle: s.quran.textStyle }));
  const fontFamily = getArabicFont(textStyle);
  const textColor = nightMode ? `rgba(255, 255, 255, ${textBrightness/255})` : `rgba(0, 0, 0, ${textBrightness/255})`;
  const lineColor = nightMode ? '#2a2a2a' : '#e0e0e0';
  
  if (!pageData || !pageData.lines) return <View style={[styles.container, { paddingHorizontal: HORIZ_PAD }]} />;
  const mushafFontSize = getMushafFontSize(headerVisible);
  const mushafLineHeight = getMushafLineHeight(headerVisible);
  const getFontAdj = (ts: string, hv: boolean) => {
    switch (ts) {
      case 'saleem': return { size: 2, y: 0 };
      case 'alqalam': return { size: 0, y: 0 };
      case 'uthmani': return { size: 0, y: 0 };
      case 'mequran': return { size: hv ? -1 : 0, y: 2 };
      case 'lateef': return { size: 4, y: 0 };
      case 'noto': return { size: 0, y: hv ? 0 : 1 };
      case 'scheherazade': return { size: hv ? -1 : 0, y: 2 };
      default: return { size: 0, y: 0 };
    }
  };
  const adj = getFontAdj(textStyle, headerVisible);

  return (
    <View style={[styles.container, { paddingHorizontal: HORIZ_PAD }]}>
      {pageData.lines.map((line: any, lineIdx: number) => {
        if (line.type === 'surah-header' || line.type === 'basmala') {
          return <View key={lineIdx} style={[styles.headerLine, { borderBottomColor: lineColor }]}><Text style={[styles.headerText, {color: textColor, fontFamily}]}>{line.type === 'basmala' ? 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ' : line.text}</Text></View>;
        }
        return (
          <View key={lineIdx} style={[styles.line, { borderBottomColor: lineColor }]}>
            {line.words?.map((word: any, wordIdx: number) => {
              const parts = word.location ? word.location.split(':') : [];
              const surahId = parts[0] || '0';
              const verseNum = parts.length > 1 ? parseInt(parts[1], 10) : 0;
              const wordPos = parts.length > 2 ? parseInt(parts[2], 10) : 0;
              const vKey = `${surahId}_${verseNum}`;

              // Skip rendering verse-end marker entries (Private Use Area U+F500-F5FF)
              // These are decorative verse-number circle glyphs meant for QPC fonts.
              // Standard fonts render them as garbled tofu. We hide them but keep
              // the layout entry intact so word positions and verse boundaries stay correct.
              const isVerseEndMarker = word.word && /[\uF500-\uF5FF]/.test(word.word);

              const verseObj = versesForPage?.find((v: any) => `${v.surahId}_${v.verseNumber}` === vKey);
              let displayText = word.word;
              const h = highlights?.[vKey]?.highlights?.find((hl: any) => hl.wordIndex === wordPos - 1);
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
                  <Text style={[styles.text, { fontSize: mushafFontSize + adj.size, lineHeight: mushafLineHeight, color: textColor, fontFamily, transform: adj.y ? [{ translateY: adj.y }] : undefined }, h && { borderBottomWidth: 3, borderBottomColor: h.color, backgroundColor: h.color + 'AA' }, isFlashing && { backgroundColor: 'rgba(255, 215, 0, 0.2)' }]}
                    onPress={() => verseNum > 0 && onWordPress(verseNum, wordPos - 1)} onLongPress={() => verseNum > 0 && onVerseLongPress(verseNum)} delayLongPress={300}>
                    {displayText}{' '}
                  </Text>
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
            })}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 12, paddingVertical: 6, justifyContent: 'space-around', backgroundColor: 'transparent' },
  line: { flexDirection: 'row-reverse', alignItems: 'center', flex: 1, width: '100%', overflow: 'visible', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  headerLine: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flex: 1, width: '100%', borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  text: { textAlign: 'center', flexShrink: 1 },
  headerText: { fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  verseBadgeContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 4 },
  verseBadge: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#00d4aa' },
  bookmarkedBadge: { backgroundColor: '#ffd700', borderColor: '#ffd700' },
  readingMarkBadge: { backgroundColor: '#4a90d9', borderColor: '#4a90d9' },
  verseBadgeText: { color: '#ffffff', fontSize: 14, fontWeight: '700', fontFamily: 'normal' },
  bookmarkedBadgeText: { color: '#000000' },
  noteIcon: { color: '#ffd700', fontSize: 12, marginLeft: 4 }
});

export default memo(MushafPageView);