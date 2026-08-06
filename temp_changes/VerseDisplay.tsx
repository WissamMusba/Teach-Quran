/**
 * FILE: src/components/quran/VerseDisplay.tsx
 * ROLE: One ayah as a wrapped RTL row of tappable words, with optional reading-mark glyph and
 *       italic translation below — the 'ayah' reading-mode row.
 * DEPENDS ON: src/utils/constants.ts (FONT_SIZES, WORD_TAP_FRACTION, MISTAKE_HIGHLIGHT,
 *             cleanQuranWord), src/utils/responsive.ts (scaleFont), src/utils/theme.ts
 *             (getArabicFont), ../common/WordHitArea, react-redux (settings/quran slices)
 * USED BY: QuranViewScreen.tsx — ayah-mode FlatList renderItem
 */

import React, { memo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSelector } from 'react-redux';
import { FONT_SIZES, WORD_TAP_FRACTION, MISTAKE_HIGHLIGHT, cleanQuranWord } from '../../utils/constants';
import { scaleFont } from '../../utils/responsive';
import { getArabicFont } from '../../utils/theme';
import WordHitArea from '../common/WordHitArea';

/**
 * VerseDisplay — a single verse row for ayah reading mode.
 * Props: verse, highlights (array for THIS verse), isBookmarked, isReadingMark,
 *        onWordPress(index) — index is the bare word index; the parent curries the verse number
 *        (QuranViewScreen handleWordFlow), onBookmarkToggle(), onVerseLongPress,
 *        showTranslation, fontSize, flashingVerse, onDeadTap.
 * FLOW:
 *   1. Indopak orthography picked when textStyle is an indopak-derived family
 *      (saleem/indopak/alqalam/lateef/harmattan), else textArabic.
 *   2. words = whitespace split + cleanQuranWord (strips U+06DD/U+06DE/U+FD3E/U+FD3F ayah-marker
 *      chars) — no location/wordPos here (no pageData), unlike MushafPageView. The word array is
 *      NOT filtered: stored highlight wordIndex values index into this exact array, so filtering
 *      would silently misalign every stored highlight.
 *   3. size = scaleFont(FONT_SIZES[fontSize]) + per-font boost; lineHeight = size * 2.6.
 *   4. WordHitArea per word: tap → onWordPress(index) only when the word is non-empty;
 *      MISTAKE_HIGHLIGHT style when highlights contains wordIndex === index; the reading-mark
 *      glyph after the words when isReadingMark; gold container bg while flashingVerse;
 *      translation Text below when showTranslation. maxFontSizeMultiplier={1} — the app owns
 *      font scaling.
 * CALLED BY: QuranViewScreen.tsx — ayah-mode FlatList renderItem (props wired ~520-523).
 * NOTES:
 *   - yAdj is an empty object — the translateY transform branch is dead code here.
 *   - No bookmark badge in this component; ayah-mode bookmarks live in the parent's header row.
 *   - Malformed-verse guards: a null verse (or one missing verseNumber) returns null, and a
 *     missing Arabic text renders an empty row — the list cannot crash on bad DB rows.
 *   - memo() is only as good as prop identities: QuranViewScreen curries onWordPress/
 *     onBookmarkToggle inline in the FlatList renderItem, so every parent re-render rebuilds
 *     those props and re-renders every row — the parent should memoize the renderItem/handlers.
 */
const VerseDisplay = ({ verse, highlights, isBookmarked, isReadingMark, onWordPress, onBookmarkToggle, onVerseLongPress, showTranslation, fontSize, flashingVerse, onDeadTap }: any) => {
  const textStyle = useSelector((s: any) => s.quran.textStyle);
  const nightMode = useSelector((s: any) => s.settings.nightMode);
  const textBrightness = useSelector((s: any) => s.settings.textBrightness);
  if (!verse || !verse.verseNumber) return null;
  // Indopak-derived text styles render the Indopak orthography when the verse carries it.
  const isIndopakStyle = textStyle === 'saleem' || textStyle === 'indopak' || textStyle === 'alqalam' || textStyle === 'lateef' || textStyle === 'harmattan';
  const displayText = (isIndopakStyle ? (verse.textIndopak || verse.textArabic) : verse.textArabic) || '';
  // Word split: plain whitespace + cleanQuranWord — no pageData/location wordPos in this mode.
  const words = displayText.trim().split(' ').map(cleanQuranWord);
  const textColor = nightMode ? `rgba(255,255,255,${textBrightness / 255})` : `rgba(0,0,0,${textBrightness / 255})`;
  const isFlashing = flashingVerse === verse.verseNumber;
  const fontFamily = getArabicFont(textStyle);
  // Font sizing: device-scaled base (scaleFont over FONT_SIZES) + per-font boost (saleem +2,
  // alqalam +4, lateef +4); lineHeight = size * 2.6. yAdj is an empty map — the translateY
  // transform branch below is dead code. FONT_SIZES[fontSize] falls back to 'medium' so a
  // corrupted/undefined fontSize tier cannot produce a NaN size.
  const baseSize = scaleFont(FONT_SIZES[fontSize] || FONT_SIZES.medium);
  const sizeBoost: Record<string, number> = { saleem: 2, alqalam: 4, lateef: 4 };
  const yAdj: Record<string, number> = {};
  const size = baseSize + (sizeBoost[textStyle] || 0);
  return (
    <View style={[styles.container, { backgroundColor: isFlashing ? 'rgba(255,215,0,0.15)' : 'transparent', borderBottomColor: nightMode ? '#1e1e1e' : '#e0e0e0' }]}>
      <Pressable style={styles.arabicRow} onPress={(e: any) => onDeadTap?.(e?.nativeEvent?.pageY)}>
        {words.map((word: string, index: number) => {
          // Per-word highlight lookup by bare word index (wordIndex === index); tap fires only
          // for non-empty words (empty tokens come from ayah-marker stripping).
          const h = highlights?.find((hl: any) => hl.wordIndex === index);
          return (
            <WordHitArea key={index} tapFraction={WORD_TAP_FRACTION} onWordPress={() => word && onWordPress(index)} onDeadTap={onDeadTap}>
              <Text style={[styles.arabicText, { fontSize: size, color: textColor, fontFamily, lineHeight: size * 2.6, transform: yAdj[textStyle] ? [{ translateY: yAdj[textStyle] }] : undefined }, h && MISTAKE_HIGHLIGHT]} maxFontSizeMultiplier={1}>{word}{word ? ' ' : ''}</Text>
            </WordHitArea>
          );
        })}
        {isReadingMark && <Text style={styles.readingMarkIcon}>📍</Text>}
      </Pressable>
      {showTranslation && <Text style={styles.translation}>{verse.textTranslation}</Text>}
    </View>
  );
};
// memo export — see NOTES: only effective when the parent passes stable callback identities.
export default memo(VerseDisplay);
const styles = StyleSheet.create({
  container: { marginBottom: 28, paddingTop: 8, paddingBottom: 8, borderBottomWidth: 1 },
  arabicRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' },
  arabicText: {},
  readingMarkIcon: { color: '#4a90d9', fontSize: 12, marginLeft: 6, marginTop: 4 },
  translation: { marginTop: 10, color: '#b0b0b0', fontSize: 16, fontStyle: 'italic', lineHeight: 24, textAlign: 'center' },
});
