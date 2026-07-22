import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FONT_SIZES } from '../../utils/constants';

const VerseDisplay = ({ verse, highlights, isBookmarked, onWordPress, onBookmarkToggle, onVerseLongPress, showTranslation, fontSize }: any) => {
  const cleanText = verse.textArabic.replace(/۞/u, '').trim();
  const words = cleanText.split(' ');
  return (
    <View style={styles.container}>
      <View style={styles.arabicRow}>
        {words.map((word: string, index: number) => {
          const h = highlights?.find((hl: any) => hl.wordIndex === index);
          return <Text key={index} onPress={() => onWordPress(index)} style={[styles.arabicText, { fontSize: FONT_SIZES[fontSize] }, h && { borderBottomWidth: 3, borderBottomColor: h.color, backgroundColor: h.color + '30' }]}>{word}{' '}</Text>;
        })}
        <TouchableOpacity onPress={() => onVerseLongPress(verse.verseNumber)}>
          <View style={[styles.verseBadge, isBookmarked && styles.bookmarkedBadge]}>
            <Text style={styles.verseBadgeText}>{verse.verseNumber}</Text>
          </View>
        </TouchableOpacity>
      </View>
      {showTranslation && <Text style={styles.translation}>{verse.textTranslation}</Text>}
    </View>
  );
};
const arePropsEqual = (prev: any, next: any) => prev.verse.id === next.verse.id && prev.isBookmarked === next.isBookmarked && prev.showTranslation === next.showTranslation && prev.fontSize === next.fontSize && prev.onVerseLongPress === next.onVerseLongPress && JSON.stringify(prev.highlights) === JSON.stringify(next.highlights);
export default memo(VerseDisplay, arePropsEqual);
const styles = StyleSheet.create({
  container: { marginBottom: 15, paddingTop: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#1e1e1e', backgroundColor: 'transparent' },
  arabicRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center' },
  arabicText: { color: '#ffffff', lineHeight: 45 },
  verseBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', marginLeft: 5, marginRight: 5, marginTop: 5 },
  bookmarkedBadge: { backgroundColor: '#FFD700' },
  verseBadgeText: { color: '#aaa', fontSize: 12, fontWeight: 'bold' },
  translation: { marginTop: 10, color: '#aaaaaa', fontSize: 16, fontStyle: 'italic', lineHeight: 24 }
});