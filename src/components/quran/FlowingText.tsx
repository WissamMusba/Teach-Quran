/**
 * FILE: src/components/quran/FlowingText.tsx
 * ROLE: Continuous reading mode: a scroll of verse blocks, each a wrapped RTL row of tappable
 *       words with bookmark/note/reading-mark glyphs and translation below.
 * DEPENDS ON: src/utils/constants.ts (FONT_SIZES, WORD_TAP_FRACTION, MISTAKE_HIGHLIGHT,
 *             cleanQuranWord), src/utils/responsive.ts (scaleFont), src/utils/theme.ts
 *             (getArabicFont), ../common/WordHitArea, react-redux (settings/quran slices)
 * USED BY: QuranViewScreen.tsx — continuous-mode ScrollView
 */

import React, { memo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSelector } from 'react-redux';
import { FONT_SIZES, WORD_TAP_FRACTION, MISTAKE_HIGHLIGHT, cleanQuranWord } from '../../utils/constants';
import { scaleFont } from '../../utils/responsive';
import { getArabicFont } from '../../utils/theme';
import WordHitArea from '../common/WordHitArea';

/**
 * FlowingText — continuous reading mode: maps verses to blocks; each block splits the verse text
 * into words (indopak selection identical to VerseDisplay), wraps words in WordHitArea, prepends
 * state glyphs, and appends the translation.
 * Props: verses, highlights (map "surah_verse" → {highlights:[{wordIndex}]}),
 *        onWordPress(verseNum, wIdx) — DIRECT (parent passes handleWordFlow, not curried),
 *        onVerseLongPress(verseNum, pageY), onBookmarkToggle — accepted but NEVER CALLED (dead
 *        prop; bookmarking in continuous mode goes through the long-press menu), showTranslation,
 *        fontSize, bookmarks, notes, flashingVerse, readingMarkVerse, onDeadTap.
 * FLOW:
 *   1. Size math identical to VerseDisplay: baseSize + per-font boost (saleem +2, alqalam +4,
 *      lateef +4); lineHeight = size * 2.6.
 *   2. Per verse: vKey "surahId_verseNumber"; verseHighs from the highlights map; word split is
 *      plain whitespace + cleanQuranWord (no pageData/location wordPos in this mode).
 *   3. Block Pressable → onDeadTap(pageY); bookmark/note/reading-mark glyphs prepended when their
 *      flags are set; word tap → onWordPress(verse.verseNumber, wIdx) only when the word is
 *      non-empty; long-press → onVerseLongPress(verse.verseNumber, pageY); word Text gets
 *      MISTAKE_HIGHLIGHT when highlighted and a gold bg while flashing.
 *   4. Translation Text below the block when showTranslation. maxFontSizeMultiplier={1} — the app
 *      owns font scaling.
 * CALLED BY: QuranViewScreen.tsx — continuous-mode ScrollView (~530-546).
 * NOTES:
 *   - onBookmarkToggle is dead in this component (unused prop) — continuous-mode bookmarking
 *     relies on the long-press menu, not a badge.
 *   - The flashing gold applies TWICE (block-level bg AND word-level bg) — the block-level one is
 *     what's visible.
 *   - memo() effective: verses come from the redux verses array (stable identities).
 */
const FlowingText = ({ verses, highlights, onWordPress, onVerseLongPress, onBookmarkToggle, showTranslation, fontSize, bookmarks, notes, flashingVerse, readingMarkVerse, onDeadTap }: any) => {
  const textStyle = useSelector((s: any) => s.quran.textStyle);
  const nightMode = useSelector((s: any) => s.settings.nightMode);
  const textBrightness = useSelector((s: any) => s.settings.textBrightness);
  const textColor = nightMode ? `rgba(255,255,255,${textBrightness / 255})` : `rgba(0,0,0,${textBrightness / 255})`;
  const fontFamily = getArabicFont(textStyle);
  // Font sizing: device-scaled base (scaleFont over FONT_SIZES) + per-font boost; lineHeight =
  // size * 2.6 — same math as VerseDisplay. yAdj stays empty — the translateY transform branch
  // below is dead code.
  const baseSize = scaleFont(FONT_SIZES[fontSize]);
  const sizeBoost: Record<string, number> = { saleem: 2, alqalam: 4, lateef: 4 };
  const yAdj: Record<string, number> = {};
  const size = baseSize + (sizeBoost[textStyle] || 0);
  const lineH = size * 2.6;
  return (
    <View style={styles.container}>
      {verses.map((verse: any) => {
        // Indopak orthography for indopak-derived text styles (same selection as VerseDisplay);
        // word split is plain whitespace + cleanQuranWord (strips U+06DD/U+06DE/U+FD3E/U+FD3F
        // ayah-marker chars) — no location/wordPos granularity in this mode.
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
                // Per-word: highlight lookup by word index (wordIndex === wIdx); tap →
                // onWordPress(verseNum, wIdx) only for non-empty words; long-press →
                // onVerseLongPress with the tap pageY.
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
// memo export — effective: verses come from the redux verses array (stable identities).
export default memo(FlowingText);
