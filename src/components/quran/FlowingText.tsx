import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { FONT_SIZES } from '../../utils/constants';
import { scaleFont } from '../../utils/responsive';
import { getArabicFont } from '../../utils/theme';

const FlowingText = ({ verses, highlights, onWordPress, onVerseLongPress, onBookmarkToggle, showTranslation, fontSize, bookmarkedVerses, notes, flashingVerse, readingMarkVerse }: any) => {
  const textStyle = useSelector((s: any) => s.quran.textStyle);
  const nightMode = useSelector((s: any) => s.settings.nightMode);
  const textBrightness = useSelector((s: any) => s.settings.textBrightness);
  const textColor = nightMode ? `rgba(255,255,255,${textBrightness / 255})` : `rgba(0,0,0,${textBrightness / 255})`;
  const fontFamily = getArabicFont(textStyle);
  const size = scaleFont(FONT_SIZES[fontSize]);
  const lineH = size * 2.6;
  return (
    <View style={styles.container}>
      {verses.map((verse: any) => {
        const displayText = (textStyle === 'saleem' || textStyle === 'indopak') ? (verse.textIndopak || verse.textArabic) : verse.textArabic;
        const words = displayText.replace(/۞/u, '').trim().split(' ');
        const vKey = `${verse.surahId}_${verse.verseNumber}`;
        const verseHighs = highlights?.[vKey]?.highlights || [];
        const isBookmarked = bookmarkedVerses?.includes(verse.verseNumber);
        const hasNote = !!notes?.[vKey];
        const isFlashing = flashingVerse === verse.verseNumber;
        const isReadingMark = readingMarkVerse === verse.verseNumber;
        return (
          <View key={vKey} style={[styles.verseBlock, { borderBottomColor: nightMode ? '#2a2a2a' : '#e0e0e0' }]}>
            <Text style={[styles.mainText, { fontSize: size, color: textColor, fontFamily, lineHeight: lineH }]}>
              {isBookmarked && <Text style={styles.bookmarkIcon}> 🔖 </Text>}
              {hasNote && <Text style={styles.noteIcon}> 📝 </Text>}
              {isReadingMark && <Text style={styles.readingMarkIcon}> 📍 </Text>}
              {words.map((word: string, wIdx: number) => {
                const h = verseHighs.find((hl: any) => hl.wordIndex === wIdx);
                return (
                  <Text key={wIdx} onPress={() => onWordPress(verse.verseNumber, wIdx)} onLongPress={() => onVerseLongPress(verse.verseNumber)}
                    style={[styles.arabicText, h && { borderBottomWidth: 3, borderBottomColor: h.color, backgroundColor: h.color + 'AA' }, isFlashing && { backgroundColor: 'rgba(255,215,0,0.2)' }]}>{word} </Text>
                );
              })}
              <Text onPress={() => onVerseLongPress(verse.verseNumber)} onLongPress={() => onBookmarkToggle(verse.verseNumber)}
                style={[styles.verseBadge, isBookmarked && styles.bookmarkedBadge, isReadingMark && styles.readingMarkBadge]}>{isReadingMark ? '📍' : verse.verseNumber}</Text>
            </Text>
            {showTranslation && <Text style={styles.translation}>{verse.textTranslation}</Text>}
          </View>
        );
      })}
    </View>
  );
};
const styles = StyleSheet.create({
  container: { width: '100%', padding: 15, backgroundColor: 'transparent' },
  verseBlock: { paddingVertical: 8, borderBottomWidth: 1, marginBottom: 6 },
  mainText: { textAlign: 'center', width: '100%' },
  arabicText: {},
  bookmarkIcon: { color: '#ffd700', fontSize: 16 },
  noteIcon: { color: '#ffd700', fontSize: 12 },
  readingMarkIcon: { color: '#4a90d9', fontSize: 14 },
  verseBadge: { color: '#fff', fontWeight: 'bold', backgroundColor: '#1e1e1e', borderColor: '#00d4aa', borderWidth: 1, borderRadius: 12, overflow: 'hidden', fontSize: 12, paddingHorizontal: 8, paddingVertical: 2 },
  bookmarkedBadge: { backgroundColor: '#ffd700', color: '#000', borderColor: '#ffd700' },
  readingMarkBadge: { backgroundColor: '#4a90d9', borderColor: '#4a90d9' },
  translation: { color: '#b0b0b0', fontStyle: 'italic', fontSize: 15, textAlign: 'center', marginTop: 4 },
});
export default memo(FlowingText);
