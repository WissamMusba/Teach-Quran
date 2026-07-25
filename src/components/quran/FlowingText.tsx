import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { FONT_SIZES } from '../../utils/constants';
import { scaleFont } from '../../utils/responsive';
import { getArabicFont } from '../../utils/theme';

const FlowingText = ({ verses, highlights, onWordPress, onVerseLongPress, onBookmarkToggle, showTranslation, fontSize, bookmarkedVerses, notes, flashingVerse, readingMarkVerse, onInteractivePressIn }: any) => {
  const textStyle = useSelector((s: any) => s.quran.textStyle);
  const nightMode = useSelector((s: any) => s.settings.nightMode);
  const textBrightness = useSelector((s: any) => s.settings.textBrightness);
  const textColor = nightMode ? `rgba(255,255,255,${textBrightness / 255})` : `rgba(0,0,0,${textBrightness / 255})`;
  const fontFamily = getArabicFont(textStyle);
  const size = scaleFont(FONT_SIZES[fontSize]);
  return (
    <View style={styles.container}>
      {verses.map((verse: any) => {
        const displayText = textStyle === 'indopak' ? (verse.textIndopak || verse.textArabic) : verse.textArabic;
        const words = displayText.replace(/۞/u, '').trim().split(' ');
        const vKey = `${verse.surahId}_${verse.verseNumber}`;
        const verseHighs = highlights?.[vKey]?.highlights || [];
        const isBookmarked = bookmarkedVerses?.includes(verse.verseNumber);
        const hasNote = !!notes?.[vKey];
        const isFlashing = flashingVerse === verse.verseNumber;
        const isReadingMark = readingMarkVerse === verse.verseNumber;
        return (
            <Text key={vKey} style={[styles.mainText, { fontSize: size, color: textColor, fontFamily, lineHeight: size * 2.0 }]}>
              {isBookmarked && <Text style={styles.bookmarkIcon}> 🔖 </Text>}
            {hasNote && <Text style={styles.noteIcon}> 📝 </Text>}
            {isReadingMark && <Text style={styles.readingMarkIcon}> 📍 </Text>}
            {words.map((word: string, wIdx: number) => {
              const h = verseHighs.find((hl: any) => hl.wordIndex === wIdx);
              return (
                <Text key={wIdx} onPressIn={onInteractivePressIn} onPress={() => onWordPress(verse.verseNumber, wIdx)} onLongPress={() => onVerseLongPress(verse.verseNumber)}
                  style={[styles.arabicText, h && { borderBottomWidth: 3, borderBottomColor: h.color, backgroundColor: h.color + 'AA' }, isFlashing && { backgroundColor: 'rgba(255,215,0,0.2)' }]}>{word} </Text>
              );
            })}
            <TouchableOpacity onPressIn={onInteractivePressIn} onPress={() => onVerseLongPress(verse.verseNumber)} onLongPress={() => onBookmarkToggle(verse.verseNumber)}>
              <View style={[styles.verseBadge, isBookmarked && styles.bookmarkedBadge, isReadingMark && styles.readingMarkBadge]}>
                <Text style={[styles.verseBadgeText, isBookmarked && !isReadingMark && styles.bookmarkedBadgeText]}>{isReadingMark ? '📍' : verse.verseNumber}</Text>
              </View>
            </TouchableOpacity>
            {showTranslation && <Text style={styles.translation}>{'\n'}{verse.textTranslation}{'\n'}</Text>}
          </Text>
        );
      })}
    </View>
  );
};
const styles = StyleSheet.create({
  container: { width: '100%', padding: 15, backgroundColor: 'transparent' },
  mainText: { textAlign: 'justify', width: '100%' },
  arabicText: {},
  bookmarkIcon: { color: '#ffd700', fontSize: 16 },
  noteIcon: { color: '#ffd700', fontSize: 12 },
  readingMarkIcon: { color: '#4a90d9', fontSize: 14 },
  verseBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1e1e1e', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#00d4aa' },
  verseBadgeText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  bookmarkedBadge: { backgroundColor: '#ffd700', borderColor: '#ffd700' },
  bookmarkedBadgeText: { color: '#000' },
  readingMarkBadge: { backgroundColor: '#4a90d9', borderColor: '#4a90d9' },
  translation: { color: '#b0b0b0', fontStyle: 'italic' },
});
export default memo(FlowingText);
