import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { FONT_SIZES } from '../../utils/constants';
import { scaleFont } from '../../utils/responsive';

const VerseDisplay = ({ verse, highlights, isBookmarked, isReadingMark, onWordPress, onBookmarkToggle, onVerseLongPress, showTranslation, fontSize, flashingVerse }: any) => {
  const { textStyle, nightMode, textBrightness } = useSelector((s: any) => ({ textStyle: s.quran.textStyle, nightMode: s.settings.nightMode, textBrightness: s.settings.textBrightness }));
  const displayText = textStyle === 'indopak' ? (verse.textIndopak || verse.textArabic) : verse.textArabic;
  const words = displayText.replace(/۞/u, '').trim().split(' ');
  const textColor = nightMode ? `rgba(255, 255, 255, ${textBrightness/255})` : `rgba(0, 0, 0, ${textBrightness/255})`;
  const isFlashing = flashingVerse === verse.verseNumber;
  
  return (
    <View style={[styles.container, isFlashing && { backgroundColor: 'rgba(255, 215, 0, 0.2)' }]}>
      <View style={styles.arabicRow}>
        {words.map((word: string, index: number) => {
          const h = highlights?.find((hl: any) => hl.wordIndex === index);
          return <Text key={index} onPress={() => onWordPress(index)} style={[styles.arabicText, { fontSize: scaleFont(FONT_SIZES[fontSize]), color: textColor }, h && { borderBottomWidth: 3, borderBottomColor: h.color, backgroundColor: h.color + 'AA' }]}>{word}{' '}</Text>;
        })}
        <TouchableOpacity onPress={() => onVerseLongPress(verse.verseNumber)} onLongPress={() => onBookmarkToggle(verse.verseNumber)}>
          <View style={[styles.verseBadge, isBookmarked && styles.bookmarkedBadge, isReadingMark && styles.readingMarkBadge]}>
            <Text style={[styles.verseBadgeText, isBookmarked && styles.bookmarkedBadgeText]}>{isReadingMark ? '📍' : verse.verseNumber}</Text>
          </View>
        </TouchableOpacity>
      </View>
      {showTranslation && <Text style={styles.translation}>{verse.textTranslation}</Text>}
    </View>
  );
};

export default memo(VerseDisplay);

const styles = StyleSheet.create({
  container: { marginBottom: 28, paddingTop: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#1e1e1e', backgroundColor: 'transparent' },
  arabicRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center' },
  arabicText: { lineHeight: 56 },
  verseBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1e1e1e', justifyContent: 'center', alignItems: 'center', marginLeft: 10, marginTop: 4, borderWidth: 1, borderColor: '#00d4aa' },
  bookmarkedBadge: { backgroundColor: '#ffd700', borderColor: '#ffd700' },
  verseBadgeText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  bookmarkedBadgeText: { color: '#000000' },
  readingMarkBadge: { backgroundColor: '#4a90d9', borderColor: '#4a90d9' },
  translation: { marginTop: 10, color: '#b0b0b0', fontSize: 16, fontStyle: 'italic', lineHeight: 24 }
});
