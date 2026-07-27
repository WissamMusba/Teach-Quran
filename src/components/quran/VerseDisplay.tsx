import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { FONT_SIZES } from '../../utils/constants';
import { scaleFont } from '../../utils/responsive';
import { getArabicFont } from '../../utils/theme';

const VerseDisplay = ({ verse, highlights, isBookmarked, isReadingMark, onWordPress, onBookmarkToggle, onVerseLongPress, showTranslation, fontSize, flashingVerse }: any) => {
  const textStyle = useSelector((s: any) => s.quran.textStyle);
  const nightMode = useSelector((s: any) => s.settings.nightMode);
  const textBrightness = useSelector((s: any) => s.settings.textBrightness);
  const isIndopakStyle = textStyle === 'saleem' || textStyle === 'indopak' || textStyle === 'mequran' || textStyle === 'alqalam' || textStyle === 'lateef' || textStyle === 'harmattan';
  const displayText = isIndopakStyle ? (verse.textIndopak || verse.textArabic) : verse.textArabic;
  const words = displayText.replace(/۞/u, '').trim().split(' ');
  const textColor = nightMode ? `rgba(255,255,255,${textBrightness / 255})` : `rgba(0,0,0,${textBrightness / 255})`;
  const isFlashing = flashingVerse === verse.verseNumber;
  const fontFamily = getArabicFont(textStyle);
  const baseSize = scaleFont(FONT_SIZES[fontSize]);
  const sizeBoost: Record<string, number> = { saleem: 2, alqalam: 4, lateef: 4 };
  const yAdj: Record<string, number> = { mequran: 2, noto: 1 };
  const size = baseSize + (sizeBoost[textStyle] || 0);
  return (
    <View style={[styles.container, { backgroundColor: isFlashing ? 'rgba(255,215,0,0.15)' : 'transparent', borderBottomColor: nightMode ? '#1e1e1e' : '#e0e0e0' }]}>
      <View style={styles.arabicRow}>
        {words.map((word: string, index: number) => {
          const h = highlights?.find((hl: any) => hl.wordIndex === index);
          return (
            <TouchableOpacity key={index} onPress={() => onWordPress(index)} activeOpacity={0.7}>
              <Text style={[styles.arabicText, { fontSize: size, color: textColor, fontFamily, lineHeight: size * 2.6, transform: yAdj[textStyle] ? [{ translateY: yAdj[textStyle] }] : undefined }, h && { borderBottomWidth: 3, borderBottomColor: h.color, backgroundColor: h.color + 'AA' }]}>{word}{' '}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity onPress={() => onVerseLongPress(verse.verseNumber)} onLongPress={() => onBookmarkToggle(verse.verseNumber)}>
          <View style={[styles.verseBadge, { backgroundColor: nightMode ? '#1e1e1e' : '#e8e8e8' }, isBookmarked && styles.bookmarkedBadge, isReadingMark && styles.readingMarkBadge]}>
            <Text style={[styles.verseBadgeText, isBookmarked && !isReadingMark && styles.bookmarkedBadgeText]}>{isReadingMark ? '📍' : verse.verseNumber}</Text>
          </View>
        </TouchableOpacity>
      </View>
      {showTranslation && <Text style={styles.translation}>{verse.textTranslation}</Text>}
    </View>
  );
};
export default memo(VerseDisplay);
const styles = StyleSheet.create({
  container: { marginBottom: 28, paddingTop: 8, paddingBottom: 8, borderBottomWidth: 1 },
  arabicRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' },
  arabicText: {},
  verseBadge: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginHorizontal: 10, marginTop: 4, borderWidth: 1, borderColor: '#00d4aa' },
  bookmarkedBadge: { backgroundColor: '#ffd700', borderColor: '#ffd700' },
  verseBadgeText: { color: '#ffffff', fontSize: 14, fontWeight: '700', fontFamily: 'normal' },
  bookmarkedBadgeText: { color: '#000000' },
  readingMarkBadge: { backgroundColor: '#4a90d9', borderColor: '#4a90d9' },
  translation: { marginTop: 10, color: '#b0b0b0', fontSize: 16, fontStyle: 'italic', lineHeight: 24, textAlign: 'center' },
});
