import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { COLORS, SPACING, scaleFont, FONT_SIZES, getArabicFont, moderateScale } from '../../utils/theme';
const FlowingText = ({ verses, highlights, onWordPress, onVerseLongPress, onBookmarkToggle, showTranslation, fontSize, bookmarkedKeys, notes, flashingVerse, readingMarkVerse }: any) => {
  const textStyle = useSelector((s: any) => s.quran.textStyle);
  const nightMode = useSelector((s: any) => s.settings.nightMode);
  const textBrightness = useSelector((s: any) => s.settings.textBrightness);
  const alpha = textBrightness / 255;
  const textColor = nightMode ? `rgba(255,255,255,${alpha})` : `rgba(26,26,26,${alpha})`;
  const arabicFont = getArabicFont(textStyle);
  const scaledFontSize = scaleFont(FONT_SIZES[fontSize as keyof typeof FONT_SIZES] || 24);
  const lineHeight = scaledFontSize * 2.1;
  return (
    <View style={[styles.container, { paddingHorizontal: SPACING.xl }]}>
      {verses.map((verse: any) => {
        const displayText = textStyle === 'indopak' ? (verse.textIndopak || verse.textArabic) : verse.textArabic;
        const words = displayText.replace(/۞/u, '').trim().split(' ');
        const vKey = `${verse.surahId}_${verse.verseNumber}`;
        const verseHighs = highlights?.[vKey]?.highlights || [];
        const isBookmarked = bookmarkedKeys?.includes(vKey);
        const hasNote = !!notes?.[vKey];
        const isFlashing = flashingVerse === verse.verseNumber;
        const isReadingMark = readingMarkVerse === verse.verseNumber;
        return (
          <Text key={vKey} style={[styles.mainText, { lineHeight }]}>
            {isBookmarked && <Text style={styles.bookmarkIcon}> 🔖 </Text>}
            {hasNote && <Text style={styles.noteIcon}> 📝 </Text>}
            {isReadingMark && <Text style={styles.readingMarkIcon}> 📍 </Text>}
            {words.map((word: string, wIdx: number) => {
              const h = verseHighs.find((hl: any) => hl.wordIndex === wIdx);
              return (
                <Text key={wIdx} onPress={() => onWordPress(verse.verseNumber, wIdx)} onLongPress={() => onVerseLongPress(verse.verseNumber)}
                  style={[styles.arabicText, { fontSize: scaledFontSize, lineHeight, color: textColor, fontFamily: arabicFont },
                    h && { borderBottomWidth: 3, borderBottomColor: h.color, backgroundColor: h.color + '33' },
                    isFlashing && { backgroundColor: 'rgba(255,215,0,0.25)' }]}>
                  {word}{' '}
                </Text>
              );
            })}
            <Text onPress={() => onVerseLongPress(verse.verseNumber)} onLongPress={() => onBookmarkToggle(verse.verseNumber)}
              style={[styles.verseBadge, { backgroundColor: isReadingMark ? COLORS.blue : isBookmarked ? COLORS.gold : (nightMode ? COLORS.bgCardLight : '#ddd'), borderColor: isReadingMark ? COLORS.blue : isBookmarked ? COLORS.gold : COLORS.primary, color: isBookmarked && !isReadingMark ? '#000' : '#fff' }]}>
              {' '}{verse.verseNumber}{' '}
            </Text>
            {showTranslation && verse.textTranslation ? (
              <Text style={[styles.translation, { color: nightMode ? COLORS.textSecondary : COLORS.textDarkSecondary, fontSize: moderateScale(14) }]}>{'\n'}{verse.textTranslation}{'\n\n'}</Text>
            ) : (<Text>{' '}</Text>)}
          </Text>
        );
      })}
    </View>
  );
};
const styles = StyleSheet.create({
  container: { width: '100%', paddingVertical: SPACING.lg },
  mainText: { textAlign: 'justify', width: '100%' },
  arabicText: {},
  bookmarkIcon: { color: COLORS.gold, fontSize: 16 },
  noteIcon: { color: COLORS.gold, fontSize: 12 },
  readingMarkIcon: { color: COLORS.blue, fontSize: 14 },
  verseBadge: { fontWeight: 'bold', borderRadius: 12, overflow: 'hidden', fontSize: 12, borderWidth: 1 },
  translation: { fontStyle: 'italic' },
});
export default memo(FlowingText);
