import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { FONT_SIZES } from '../../utils/constants';
import { scaleFont } from '../../utils/responsive';

const VerseDisplay = ({ verse, highlights, isBookmarked, onWordPress, onBookmarkToggle, onVerseLongPress, showTranslation, fontSize }: any) => {
  const textStyle = useSelector((s: any) => s.quran.textStyle);
  const displayText = textStyle === 'indopak' ? (verse.textIndopak || verse.textArabic) : verse.textArabic;
  const words = displayText.replace(/۞/u, '').trim().split(' ');
  
  return (
    <View style={styles.container}>
      <View style={styles.arabicRow}>
        {words.map((word: string, index: number) => {
          const h = highlights?.find((hl: any) => hl.wordIndex === index);
          return <Text key={index} onPress={() => onWordPress(index)} style={[styles.arabicText, { fontSize: scaleFont(FONT_SIZES[fontSize]) }, h && { borderBottomWidth: 3, borderBottomColor: h.color, backgroundColor: h.color + 'AA' }]}>{word}{' '}</Text>;
        })}
        <TouchableOpacity onPress={() => onVerseLongPress(verse.verseNumber)}>
          <View style={[styles.verseBadge, isBookmarked && styles.bookmarkedBadge]}>
            <Text style={[styles.verseBadgeText, isBookmarked && styles.bookmarkedBadgeText]}>{verse.verseNumber}</Text>
          </View>
        </TouchableOpacity>
      </View>
      {showTranslation && <Text style={styles.translation}>{verse.textTranslation}</Text>}
    </View>
  );
};

const arePropsEqual = (prev: any, next: any) => prev.verse.id === next.verse.id && prev.isBookmarked === next.isBookmarked && prev.showTranslation === next.showTranslation && prev.fontSize === next.fontSize && JSON.stringify(prev.highlights) === JSON.stringify(next.highlights);
export default memo(VerseDisplay, arePropsEqual);

const styles = StyleSheet.create({
  container: { marginBottom: 28, paddingTop: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#1e1e1e', backgroundColor: 'transparent' },
  arabicRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center' },
  arabicText: { color: '#ffffff', lineHeight: 56 },
  verseBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1e1e1e', justifyContent: 'center', alignItems: 'center', marginLeft: 10, marginTop: 4, borderWidth: 1, borderColor: '#00d4aa' },
  bookmarkedBadge: { backgroundColor: '#ffd700', borderColor: '#ffd700' },
  verseBadgeText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  bookmarkedBadgeText: { color: '#000000' },
  translation: { marginTop: 10, color: '#b0b0b0', fontSize: 16, fontStyle: 'italic', lineHeight: 24 }
});
