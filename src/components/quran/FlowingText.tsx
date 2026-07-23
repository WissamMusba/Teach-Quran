import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { FONT_SIZES } from '../../utils/constants';

const FlowingText = ({ verses, highlights, onWordPress, onVerseLongPress, showTranslation, fontSize, bookmarkedVerses, notes }: any) => {
  const textStyle = useSelector((s: any) => s.quran.textStyle);
  return (
    <View style={styles.container}>
      <Text style={styles.mainText}>
        {verses.map((verse: any, vIdx: number) => {
          const displayText = textStyle === 'indopak' ? (verse.textIndopak || verse.textArabic) : verse.textArabic;
          const cleanText = displayText.replace(/۞/u, '').trim();
          const words = cleanText.split(' ');
          const vKey = `${verse.surahId}_${verse.verseNumber}`;
          const verseHighs = highlights?.[vKey]?.highlights || [];
          const isBookmarked = bookmarkedVerses?.includes(verse.verseNumber);
          const hasNote = !!notes?.[vKey];
          
          return (
            <React.Fragment key={vIdx}>
              {isBookmarked && <Text style={styles.bookmarkIcon}>🔖 </Text>}
              {hasNote && <Text style={styles.noteIcon}>📝 </Text>}
              
              {words.map((word: string, wIdx: number) => {
                const h = verseHighs.find((hl: any) => hl.wordIndex === wIdx);
                return <Text key={wIdx} onPress={() => onWordPress(verse.verseNumber, wIdx)} onLongPress={() => onVerseLongPress(verse.verseNumber)} delayLongPress={300} style={[styles.arabicText, { fontSize: FONT_SIZES[fontSize] }, h && { borderBottomWidth: 3, borderBottomColor: h.color, backgroundColor: h.color + 'AA' }]}>{word} </Text>;
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
  mainText: { textAlign: 'justify', color: '#fff', lineHeight: 40, width: '100%' }, 
  arabicText: { color: '#fff' }, 
  bookmarkIcon: { color: '#0066FF', fontSize: 16 },
  verseBadge: { color: '#0066FF', fontWeight: 'bold' }, 
  translation: { color: '#aaa', fontStyle: 'italic' },
  noteIcon: { fontSize: 12, color: '#FFD700' }
});

export default React.memo(FlowingText);
