import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

export default function MushafPageView({ pageData, highlights, onWordPress, onVerseLongPress, bookmarks, flashingVerseKey, notes }: any) {
  if (!pageData || !pageData.lines) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      {pageData.lines.map((line: any, lineIdx: number) => {
        if (line.type === 'surah-header') {
          return (
            <View key={lineIdx} style={styles.headerLine}>
              <Text style={styles.headerText}>{line.text}</Text>
            </View>
          );
        }

        if (line.type === 'basmala') {
          return (
            <View key={lineIdx} style={styles.headerLine}>
              <Text style={styles.headerText}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
            </View>
          );
        }

        return (
          <View key={lineIdx} style={styles.line}>
            {line.words?.map((word: any, wordIdx: number) => {
              const parts = word.location ? word.location.split(':') : [];
              const surahId = parts[0] || '0';
              const verseNum = parts.length > 1 ? parseInt(parts[1], 10) : 0;
              const wordPos = parts.length > 2 ? parseInt(parts[2], 10) : 0;

              const vKey = `${surahId}_${verseNum}`;
              const h = highlights?.[vKey]?.highlights?.find((hl: any) => hl.wordIndex === wordPos - 1);
              const isBookmarked = !!bookmarks?.[vKey];
              const isFlashing = flashingVerseKey === vKey;
              const hasNote = !!notes?.[vKey];
              
              const nextWord = line.words[wordIdx + 1];
              const hasNextWordOnLine = !!nextWord;
              const isVerseBoundary = hasNextWordOnLine && (nextWord.location && nextWord.location.split(':')[1] !== String(verseNum));

              return (
                <React.Fragment key={wordIdx}>
                  <Text
                    style={[
                      styles.text,
                      h && { borderBottomWidth: 3, borderBottomColor: h.color, backgroundColor: h.color + '80' },
                      isFlashing && { backgroundColor: '#FFD70040' }
                    ]}
                    onPress={() => verseNum > 0 && onWordPress(verseNum, wordPos - 1)}
                    onLongPress={() => verseNum > 0 && onVerseLongPress(verseNum)}
                    delayLongPress={300}
                  >
                    {word.word}{' '}
                  </Text>
                  {isVerseBoundary && (
                    <Text style={styles.ayahGap}>
                      {isBookmarked && '🔖'}
                      {hasNote && '📝'}
                    </Text>
                  )}
                </React.Fragment>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 15, paddingVertical: 10, justifyContent: 'space-around', backgroundColor: 'transparent' },
  line: { flexDirection: 'row-reverse', alignItems: 'center', flex: 1, width: '100%', overflow: 'hidden', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  headerLine: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flex: 1, width: '100%', borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  text: { color: '#fff', fontSize: 20, textAlign: 'center', flexShrink: 1 },
  headerText: { color: '#fff', fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
  ayahGap: { color: '#555', fontSize: 14, marginHorizontal: 6 }
});
