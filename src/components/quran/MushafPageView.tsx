import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { getMushafFontSize, getMushafLineHeight } from '../../utils/responsive';
import { getArabicFont } from '../../utils/theme';
import { useSelector } from 'react-redux';

const MushafPageView = ({ containerHeight, versesForPage, pageData, highlights, onWordPress, onVerseLongPress, onBookmarkToggle, bookmarks, flashingVerseKey, notes, readingMarkVerse }: any) => {
  const { nightMode, textBrightness, textStyle } = useSelector((s: any) => ({ nightMode: s.settings.nightMode, textBrightness: s.settings.textBrightness, textStyle: s.quran.textStyle }));
  const fontFamily = getArabicFont(textStyle);
  const textColor = nightMode ? `rgba(255, 255, 255, ${textBrightness/255})` : `rgba(0, 0, 0, ${textBrightness/255})`;
  const lineColor = nightMode ? '#2a2a2a' : '#e0e0e0';
  
  if (!pageData || !pageData.lines) return <View style={styles.container} />;
  
  const baseFontSize = getMushafFontSize();
  const baseLineHeight = getMushafLineHeight();
  let mushafFontSize = baseFontSize;
  let mushafLineHeight = baseLineHeight;
  
  if (containerHeight > 0) {
    const maxLineHeight = containerHeight / 15.5;
    if (maxLineHeight < baseLineHeight) {
      mushafLineHeight = maxLineHeight;
      mushafFontSize = mushafLineHeight / 1.85;
    }
  }

  return (
    <View style={[styles.container, { justifyContent: 'space-around' }]}>
      {pageData.lines.map((line: any, lineIdx: number) => {
        if (line.type === 'surah-header' || line.type === 'basmala') {
          return <View key={lineIdx} style={[styles.headerLine, { height: mushafLineHeight, borderBottomColor: lineColor }]}><Text style={[styles.headerText, {color: textColor, fontSize: mushafFontSize + 4, fontFamily}]}>{line.type === 'basmala' ? 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ' : line.text}</Text></View>;
        }
        return (
          <View key={lineIdx} style={[styles.line, { height: mushafLineHeight, borderBottomColor: lineColor }]}>
            {line.words?.map((word: any, wordIdx: number) => {
              const parts = word.location ? word.location.split(':') : [];
              const surahId = parts[0] || '0';
              const verseNum = parts.length > 1 ? parseInt(parts[1], 10) : 0;
              const wordPos = parts.length > 2 ? parseInt(parts[2], 10) : 0;

              const vKey = `${surahId}_${verseNum}`;
              const verseObj = versesForPage.find((v: any) => `${v.surahId}_${v.verseNumber}` === vKey);
              let displayText = word.word;
              if (verseObj) {
                const fullText = (textStyle === 'saleem' || textStyle === 'indopak' || textStyle === 'mequran') ? (verseObj.textIndopak || verseObj.textArabic) : verseObj.textArabic;
                const wordsArray = fullText.replace(/۞/u, '').trim().split(' ');
                displayText = wordsArray[wordPos - 1] || word.word;
              }

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

              return (
                <React.Fragment key={wordIdx}>
                  <Text style={[styles.text, { fontSize: mushafFontSize, color: textColor, fontFamily }, h && { borderBottomWidth: 3, borderBottomColor: h.color, backgroundColor: h.color + 'AA' }, isFlashing && { backgroundColor: 'rgba(255, 215, 0, 0.2)' }]}
                    onPress={() => verseNum > 0 && onWordPress(verseNum, wordPos - 1)} onLongPress={() => verseNum > 0 && onVerseLongPress(verseNum)} delayLongPress={300}>
                    {displayText}{' '}
                  </Text>
                  {isVerseBoundary && (
                    <View style={styles.verseBadgeContainer}>
                      <TouchableOpacity onPress={() => onBookmarkToggle(verseNum)}>
                        <View style={[styles.verseBadge, isBookmarked && styles.bookmarkedBadge, isReadingMark && styles.readingMarkBadge]}>
                          <Text style={[styles.verseBadgeText, isBookmarked && styles.bookmarkedBadgeText]}>{isReadingMark ? '📍' : verseNum}</Text>
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
  container: { flex: 1, width: '100%', backgroundColor: 'transparent' },
  line: { flexDirection: 'row-reverse', alignItems: 'center', width: '100%', overflow: 'visible', justifyContent: 'space-between', borderBottomWidth: 1, paddingHorizontal: 12 },
  headerLine: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', width: '100%', borderBottomWidth: 1, paddingHorizontal: 12 },
  text: { textAlign: 'center', flexShrink: 1, includeFontPadding: false, textAlignVertical: 'center' },
  headerText: { fontWeight: 'bold', textAlign: 'center', includeFontPadding: false },
  verseBadgeContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 4 },
  verseBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1e1e1e', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#00d4aa' },
  bookmarkedBadge: { backgroundColor: '#ffd700', borderColor: '#ffd700' },
  readingMarkBadge: { backgroundColor: '#4a90d9', borderColor: '#4a90d9' },
  verseBadgeText: { color: '#ffffff', fontSize: 14, fontWeight: '700', fontFamily: 'normal' },
  bookmarkedBadgeText: { color: '#000000' },
  noteIcon: { color: '#ffd700', fontSize: 12, marginLeft: 4 }
});

export default memo(MushafPageView);
