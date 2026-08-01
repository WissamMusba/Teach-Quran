import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { getMushafFontSize } from '../../utils/responsive';
import { getArabicFont } from '../../utils/theme';
import { MISTAKE_HIGHLIGHT, cleanQuranWord } from '../../utils/constants';

const PageFlowingView = ({ verses, highlights, bookmarks, notes, readingMarkVerse, showTranslation, onWordPress, onVerseLongPress, onBookmarkToggle, flashingVerse, onInteractivePressIn }: any) => {
  const textStyle = useSelector((s: any) => s.quran.textStyle);
  const nightMode = useSelector((s: any) => s.settings.nightMode);
  const textBrightness = useSelector((s: any) => s.settings.textBrightness);
  const textColor = nightMode ? `rgba(255,255,255,${textBrightness / 255})` : `rgba(0,0,0,${textBrightness / 255})`;
  const fontFamily = getArabicFont(textStyle);
  const size = getMushafFontSize();
  const lineHeight = size * 2.0;
  const lineColor = nightMode ? '#2a2a2a' : '#e0e0e0';
  if (!verses || verses.length === 0) return null;
  return (
    <View style={styles.container}>
      {verses.map((verse: any) => {
        const displayText = (textStyle === 'saleem' || textStyle === 'indopak') ? (verse.textIndopak || verse.textArabic) : verse.textArabic;
        const words = displayText.trim().split(' ').map(cleanQuranWord);
        const vKey = `${verse.surahId}_${verse.verseNumber}`;
        const verseHighs = highlights?.[vKey]?.highlights || [];
        const isBookmarked = !!bookmarks?.[vKey];
        const hasNote = !!notes?.[vKey];
        const isReadingMark = readingMarkVerse === verse.verseNumber;
        const isFlashing = flashingVerse === verse.verseNumber;
        return (
          <View key={vKey} style={[styles.verseBlock, { borderBottomColor: lineColor }]}>
            <Text style={[styles.mainText, { lineHeight }]}>
              {isBookmarked && <Text style={styles.iconGold}> 🔖 </Text>}
              {hasNote && <Text style={styles.iconNote}> 📝 </Text>}
              {isReadingMark && <Text style={styles.iconBlue}> 📍 </Text>}
              {words.map((word: string, wIdx: number) => {
                const h = verseHighs.find((hl: any) => hl.wordIndex === wIdx);
                return (
                  <Text key={wIdx} onPressIn={onInteractivePressIn} onPress={() => onWordPress(verse.verseNumber, wIdx)} onLongPress={(e: any) => onVerseLongPress(verse.verseNumber, e?.nativeEvent?.pageY)}
                    style={[styles.arabicText, { fontSize: size, lineHeight, color: textColor, fontFamily },
                      h && MISTAKE_HIGHLIGHT,
                      isFlashing && { backgroundColor: 'rgba(255,215,0,0.2)' }]}>{word} </Text>
                );
              })}
              <Text onPressIn={onInteractivePressIn} onPress={() => onBookmarkToggle(verse.verseNumber)} onLongPress={(e: any) => onVerseLongPress(verse.verseNumber, e?.nativeEvent?.pageY)}
                style={[styles.verseBadge, { backgroundColor: isReadingMark ? '#4a90d9' : isBookmarked ? '#ffd700' : (nightMode ? '#1e1e1e' : '#e8e8e8'), borderColor: isReadingMark ? '#4a90d9' : isBookmarked ? '#ffd700' : '#00d4aa', color: isBookmarked && !isReadingMark ? '#000' : '#fff' }]}>{` ${verse.verseNumber} `}</Text>
              {showTranslation && verse.textTranslation ? (<Text style={[styles.translation, { color: nightMode ? '#b0b0b0' : '#555' }]}>{'\n'}{verse.textTranslation}{'\n'}</Text>) : null}
            </Text>
          </View>
        );
      })}
    </View>
  );
};
const styles = StyleSheet.create({
  container: { width: '100%' },
  verseBlock: { borderBottomWidth: 1, paddingVertical: 8 },
  mainText: { textAlign: 'justify', width: '100%' },
  arabicText: {},
  iconGold: { color: '#ffd700', fontSize: 16 },
  iconNote: { color: '#ffd700', fontSize: 12 },
  iconBlue: { color: '#4a90d9', fontSize: 14 },
  verseBadge: { fontWeight: 'bold', borderRadius: 12, overflow: 'hidden', fontSize: 12, borderWidth: 1 },
  translation: { fontStyle: 'italic', fontSize: 15 },
});
export default memo(PageFlowingView);
