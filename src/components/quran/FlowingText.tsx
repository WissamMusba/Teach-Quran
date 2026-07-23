import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { FONT_SIZES } from '../../utils/constants';
import { scaleFont } from '../../utils/responsive';

const FlowingText = ({ verses, highlights, onWordPress, onVerseLongPress, onBookmarkToggle, showTranslation, fontSize, bookmarkedVerses, notes, flashingVerse }: any) => {
  const { textStyle, nightMode, textBrightness } = useSelector((s: any) => ({ textStyle: s.quran.textStyle, nightMode: s.settings.nightMode, textBrightness: s.settings.textBrightness }));
  const textColor = nightMode ? `rgba(255, 255, 255, ${textBrightness/255})` : `rgba(0, 0, 0, ${textBrightness/255})`;
  
  return (
    <View style={styles.container}>
      <Text style={styles.mainText}>
        {verses.map((verse: any, vIdx: number) => {
          const displayText = textStyle === 'indopak' ? (verse.textIndopak || verse.textArabic) : verse.textArabic;
          const words = displayText.replace(/۞/u, '').trim().split(' ');
          const vKey = `${verse.surahId}_${verse.verseNumber}`;
          const verseHighs = highlights?.[vKey]?.highlights || [];
          const isBookmarked = bookmarkedVerses?.includes(verse.verseNumber);
          const hasNote = !!notes?.[vKey];
          const isFlashing = flashingVerse === verse.verseNumber;
          
          return (
            <React.Fragment key={vIdx}>
              {isBookmarked && <Text style={styles.bookmarkIcon}>🔖 </Text>}
              {hasNote && <Text style={styles.noteIcon}>📝 </Text>}
              {words.map((word: string, wIdx: number) => {
                const h = verseHighs.find((hl: any) => hl.wordIndex === wIdx);
                return <Text key={wIdx} onPress={() => onWordPress(verse.verseNumber, wIdx)} onLongPress={() => onVerseLongPress(verse.verseNumber)} delayLongPress={300} style={[styles.arabicText, { fontSize: scaleFont(FONT_SIZES[fontSize]), color: textColor }, h && { borderBottomWidth: 3, borderBottomColor: h.color, backgroundColor: h.color + 'AA' }, isFlashing && { backgroundColor: 'rgba(255, 215, 0, 0.2)' }]}>{word} </Text>;
              })}
              <Text onPress={() => onVerseLongPress(verse.verseNumber)} onLongPress={() => onBookmarkToggle(verse.verseNumber)} style={styles.verseBadge}>{` ${verse.verseNumber} `}</Text>
              <Text>{' '}</Text>
              {showTranslation && <Text style={styles.translation}>{verse.textTranslation} </Text>}
            </React.Fragment>
          );
        })}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({ 
  container: { width: '100%', padding: 15, backgroundColor: 'transparent' }, 
  mainText: { textAlign: 'justify', lineHeight: 56, width: '100%' }, 
  arabicText: {}, 
  bookmarkIcon: { color: '#ffd700', fontSize: 16 },
  noteIcon: { color: '#ffd700', fontSize: 12 },
  verseBadge: { color: '#fff', fontWeight: 'bold', backgroundColor: '#1e1e1e', borderColor: '#00d4aa', borderWidth: 1, borderRadius: 12, overflow: 'hidden', fontSize: 12 }, 
  translation: { color: '#b0b0b0', fontStyle: 'italic' }
});

export default memo(FlowingText);
