import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { FONT_SIZES } from '../../utils/constants';
import { scaleFont } from '../../utils/responsive';

const FlowingText = ({ verses, highlights, onWordPress, onVerseLongPress, showTranslation, fontSize, bookmarkedVerses }: any) => {
  const textStyle = useSelector((s: any) => s.quran.textStyle);
  
  return (
    <View style={styles.container}>
      <Text style={styles.mainText}>
        {verses.map((verse: any, vIdx: number) => {
          const displayText = textStyle === 'indopak' ? (verse.textIndopak || verse.textArabic) : verse.textArabic;
          const words = displayText.replace(/۞/u, '').trim().split(' ');
          const vKey = `${verse.surahId}_${verse.verseNumber}`;
          const verseHighs = highlights?.[vKey]?.highlights || [];
          
          return (
            <React.Fragment key={vIdx}>
              {bookmarkedVerses?.includes(verse.verseNumber) && <Text style={styles.bookmarkIcon}>🔖 </Text>}
              {words.map((word: string, wIdx: number) => {
                const h = verseHighs.find((hl: any) => hl.wordIndex === wIdx);
                return <Text key={wIdx} onPress={() => onWordPress(verse.verseNumber, wIdx)} onLongPress={() => onVerseLongPress(verse.verseNumber)} delayLongPress={300} style={[styles.arabicText, { fontSize: scaleFont(FONT_SIZES[fontSize]) }, h && { borderBottomWidth: 3, borderBottomColor: h.color, backgroundColor: h.color + 'AA' }]}>{word} </Text>;
              })}
              <Text onPress={() => onVerseLongPress(verse.verseNumber)} style={styles.verseBadge}>{` ${verse.verseNumber} `}</Text>
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
  mainText: { textAlign: 'justify', color: '#fff', lineHeight: 56, width: '100%' }, 
  arabicText: { color: '#fff' }, 
  bookmarkIcon: { color: '#ffd700', fontSize: 16 },
  verseBadge: { color: '#fff', fontWeight: 'bold', backgroundColor: '#1e1e1e', borderColor: '#00d4aa', borderWidth: 1, borderRadius: 12, overflow: 'hidden', fontSize: 12 }, 
  translation: { color: '#b0b0b0', fontStyle: 'italic' }
});

export default memo(FlowingText);
