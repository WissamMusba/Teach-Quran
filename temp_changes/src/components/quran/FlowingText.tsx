import React, { memo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSelector } from 'react-redux';
import { FONT_SIZES, WORD_TAP_FRACTION, MISTAKE_HIGHLIGHT, cleanQuranWord } from '../../utils/constants';
import { scaleFont } from '../../utils/responsive';
import { getArabicFont } from '../../utils/theme';
import WordHitArea from '../common/WordHitArea';

const FlowingText = ({ verses, highlights, onWordPress, onVerseLongPress, onBookmarkToggle, showTranslation, fontSize, bookmarks, notes, flashingVerse, readingMarkVerse, onDeadTap }: any) => {
  const textStyle = useSelector((s: any) => s.quran.textStyle);
  const nightMode = useSelector((s: any) => s.settings.nightMode);
  const textBrightness = useSelector((s: any) => s.settings.textBrightness);
  const textColor = nightMode ? `rgba(255,255,255,${textBrightness / 255})` : `rgba(0,0,0,${textBrightness / 255})`;
  const fontFamily = getArabicFont(textStyle);
  const baseSize = scaleFont(FONT_SIZES[fontSize]);
  const sizeBoost: Record<string, number> = { saleem: 2, alqalam: 4, lateef: 4 };
  const yAdj: Record<string, number> = {};
  const size = baseSize + (sizeBoost[textStyle] || 0);
  const lineH = size * 2.6;
  return (
    <View style={styles.container}>
      {verses.map((verse: any) => {
        const isIndopakStyle = textStyle === 'saleem' || textStyle === 'indopak' || textStyle === 'alqalam' || textStyle === 'lateef' || textStyle === 'harmattan';
        const displayText = isIndopakStyle ? (verse.textIndopak || verse.textArabic) : verse.textArabic;
        const words = displayText.trim().split(' ').map(cleanQuranWord);
        const vKey = `${verse.surahId}_${verse.verseNumber}`;
        const verseHighs = highlights?.[vKey]?.highlights || [];
        const isBookmarked = !!bookmarks?.[vKey];
        const hasNote = !!notes?.[vKey];
        const isFlashing = flashingVerse === verse.verseNumber;
        const isReadingMark = readingMarkVerse === verse.verseNumber;
        return (
          <View key={vKey} style={[styles.verseBlock, { borderBottomColor: nightMode ? '#2a2a2a' : '#e0e0e0' }]}>
            <Pressable style={[styles.arabicRow, isFlashing && { backgroundColor: 'rgba(255,215,0,0.2)' }]} onPress={(e: any) => onDeadTap?.(e?.nativeEvent?.pageY)}>
              {isBookmarked && <Text style={styles.bookmarkIcon}> 🔖 </Text>}
              {hasNote && <Text style={styles.noteIcon}> 📝 </Text>}
              {isReadingMark && <Text style={styles.readingMarkIcon}> 📍 </Text>}
              {words.map((word: string, wIdx: number) => {
                const h = verseHighs.find((hl: any) => hl.wordIndex === wIdx);
                return (
                  <WordHitArea key={wIdx} tapFraction={WORD_TAP_FRACTION} onWordPress={() => word && onWordPress(verse.verseNumber, wIdx)} onDeadTap={onDeadTap}
                    onLongPress={(e: any) => onVerseLongPress(verse.verseNumber, e?.nativeEvent?.pageY)}>
                    <Text style={[styles.arabicText, { fontSize: size, color: textColor, fontFamily, lineHeight: lineH, transform: yAdj[textStyle] ? [{ translateY: yAdj[textStyle] }] : undefined }, h && MISTAKE_HIGHLIGHT, isFlashing && { backgroundColor: 'rgba(255,215,0,0.2)' }]} maxFontSizeMultiplier={1}>{word} </Text>
                  </WordHitArea>
                );
              })}
            </Pressable>
            {showTranslation && <Text style={styles.translation}>{verse.textTranslation}</Text>}
          </View>
        );
      })}
    </View>
  );
};
const styles = StyleSheet.create({
  container: { width: '100%', padding: 12, backgroundColor: 'transparent' },
  verseBlock: { paddingVertical: 4, borderBottomWidth: 0, marginBottom: 2 },
  arabicRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' },
  arabicText: {},
  bookmarkIcon: { color: '#ffd700', fontSize: 14 },
  noteIcon: { color: '#ffd700', fontSize: 11 },
  readingMarkIcon: { color: '#4a90d9', fontSize: 12 },
  translation: { color: '#b0b0b0', fontStyle: 'italic', fontSize: 14, textAlign: 'center', marginTop: 2 },
});
export default memo(FlowingText);
