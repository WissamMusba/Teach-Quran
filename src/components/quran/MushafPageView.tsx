import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getMushafFontSize, getMushafLineHeight } from '../../utils/responsive';

const MushafPageView = ({ pageData, highlights, onWordPress, onVerseLongPress, bookmarks, flashingVerseKey, notes }: any) => {
  if (!pageData || !pageData.lines) return <View style={styles.container} />;
  const mushafFontSize = getMushafFontSize();
  const mushafLineHeight = getMushafLineHeight();

  return (
    <View style={styles.container}>
      {pageData.lines.map((line: any, lineIdx: number) => {
        if (line.type === 'surah-header' || line.type === 'basmala') {
          return <View key={lineIdx} style={styles.headerLine}><Text style={styles.headerText}>{line.type === 'basmala' ? 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ' : line.text}</Text></View>;
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
              const nextWord = line.words[wordIdx + 1];
              const isVerseBoundary = !!nextWord && (nextWord.location && nextWord.location.split(':')[1] !== String(verseNum));

              return (
                <React.Fragment key={wordIdx}>
                  <Text style={[styles.text, { fontSize: mushafFontSize, lineHeight: mushafLineHeight }, h && { borderBottomWidth: 3, borderBottomColor: h.color, backgroundColor: h.color + 'AA' }, isFlashing && { backgroundColor: '#FFD70040' }]}
                    onPress={() => verseNum > 0 && onWordPress(verseNum, wordPos - 1)} onLongPress={() => verseNum > 0 && onVerseLongPress(verseNum)} delayLongPress={300}>
                    {word.word}{' '}
                  </Text>
                  {isVerseBoundary && (
                    <View style={styles.verseBadgeContainer}>
                      <View style={[styles.verseBadge, isBookmarked && styles.bookmarkedBadge]}>
                        <Text style={[styles.verseBadgeText, isBookmarked && styles.bookmarkedBadgeText]}>{verseNum}</Text>
                      </View>
                    </View>
                  )}
                </React.Fragment>
              );
            })}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 15, paddingVertical: 10, justifyContent: 'space-around', backgroundColor: 'transparent' },
  line: { flexDirection: 'row-reverse', alignItems: 'center', flex: 1, width: '100%', overflow: 'hidden', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  headerLine: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flex: 1, width: '100%', borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  text: { color: '#fff', textAlign: 'center', flexShrink: 1 },
  headerText: { color: '#00d4aa', fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  verseBadgeContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 6 },
  verseBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1e1e1e', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#00d4aa' },
  bookmarkedBadge: { backgroundColor: '#ffd700', borderColor: '#ffd700' },
  verseBadgeText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  bookmarkedBadgeText: { color: '#000000' }
});

export default memo(MushafPageView);
