/**
 * FILE: src/components/quran/FlowingText.tsx
 * ROLE: Continuous reading mode: ALL loaded verses render as ONE flowing mushaf-like column —
 *       words wrap continuously across verse boundaries (row-reverse flexWrap) with an inline
 *       verse-number badge (small circle) after each verse; translations drop in below the badge.
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
 * FlowingText — continuous reading mode: one continuous RTL flow of every loaded verse's words
 * (lineHeight tighter than the per-verse blocks, so it reads like a scrollable mushaf column),
 * with an inline verse-number badge after each verse (verse 1 = Bismillah gets NO badge),
 * bookmark/note glyphs beside the badge, and the reading-mark rendered inside the badge.
 * Props: verses, highlights (map "surah_verse" → {highlights:[{wordIndex}]}),
 *        onWordPress(verseNum, wIdx) — DIRECT (parent passes handleWordFlow),
 *        onVerseLongPress(verseNum, pageY), showTranslation, fontSize, bookmarks, notes,
 *        flashingVerse, readingMarkVerse, onDeadTap.
 * FLOW:
 *   1. Size math identical to VerseDisplay: baseSize + per-font boost (saleem +2, alqalam +4,
 *      lateef +4); lineHeight = size * 1.9 (tight column, not airy ayah blocks).
 *   2. Per verse: vKey "surahId_verseNumber"; verseHighs from the highlights map; word split is
 *      plain whitespace + cleanQuranWord (no pageData/location wordPos in this mode).
 *   3. All words of all verses go into ONE row-reverse flexWrap container — verses flow
 *      continuously, line after line, like a page you scroll. Word tap → onWordPress(verseNum,
 *      wIdx) for non-empty words; long-press → onVerseLongPress(verseNum, pageY); MISTAKE_HIGHLIGHT
 *      per highlighted word; gold bg per word while the verse flashes.
 *   4. After each verse's last word: the inline badge (number in a teal circle, gold when
 *      bookmarked, blue with 📍 when it's the reading mark) + note glyph. Verse 1 (Bismillah)
 *      renders no badge.
 *   5. Translation Text below the verse's badge when showTranslation. maxFontSizeMultiplier={1}.
 * CALLED BY: QuranViewScreen.tsx — continuous-mode ScrollView.
 * NOTES:
 *   - The container Pressable handles dead taps (onDeadTap with pageY); WordHitArea children keep
 *     their own tap/long-press handling (nested pressables resolve to the inner one).
 *   - memo() effective: verses come from the redux verses array (stable identities).
 */
const FlowingText = ({ verses, highlights, onWordPress, onVerseLongPress, showTranslation, fontSize, bookmarks, notes, flashingVerse, readingMarkVerse, onDeadTap }: any) => {
  const textStyle = useSelector((s: any) => s.quran.textStyle);
  const nightMode = useSelector((s: any) => s.settings.nightMode);
  const textBrightness = useSelector((s: any) => s.settings.textBrightness);
  const textColor = nightMode ? `rgba(255,255,255,${textBrightness / 255})` : `rgba(0,0,0,${textBrightness / 255})`;
  const fontFamily = getArabicFont(textStyle);
  // Font sizing: device-scaled base (scaleFont over FONT_SIZES) + per-font boost; lineHeight =
  // size * 1.9 — a tight continuous column (the old 2.6 made each verse an airy block).
  const baseSize = scaleFont(FONT_SIZES[fontSize]);
  const sizeBoost: Record<string, number> = { saleem: 2, alqalam: 4, lateef: 4 };
  const size = baseSize + (sizeBoost[textStyle] || 0) + (fontSize === 'small' ? 4 : 0);
  const lineH = size * 1.9;
  const isIndopakStyle = textStyle === 'saleem' || textStyle === 'indopak' || textStyle === 'alqalam' || textStyle === 'lateef' || textStyle === 'harmattan';

  const flow: any[] = [];
  verses.forEach((verse: any) => {
    const displayText = isIndopakStyle ? (verse.textIndopak || verse.textArabic) : verse.textArabic;
    const words = displayText.trim().split(' ').map(cleanQuranWord);
    const isBasmala = verse.verseNumber === 1 && verse.surahId !== 1 && verse.surahId !== 9;
    const verseWords = isBasmala && words.length >= 4 ? words.slice(4) : words;
    const vKey = `${verse.surahId}_${verse.verseNumber}`;
    const verseHighs = highlights?.[vKey]?.highlights || [];
    const isBookmarked = !!bookmarks?.[vKey];
    const hasNote = !!notes?.[vKey];
    const isFlashing = flashingVerse === verse.verseNumber;
    const isReadingMark = readingMarkVerse === verse.verseNumber;

    if (isBasmala) flow.push(<Text key={`${vKey}_bsm`} style={[styles(nightMode).basmala, { fontSize: size, color: textColor, fontFamily, lineHeight: lineH }]} maxFontSizeMultiplier={1}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>);

    verseWords.forEach((word: string, wIdx: number) => {
      const h = verseHighs.find((hl: any) => hl.wordIndex === wIdx);
      flow.push(
        <WordHitArea key={`${vKey}_w${wIdx}`} tapFraction={WORD_TAP_FRACTION}
          onWordPress={() => word && onWordPress(verse.verseNumber, wIdx)} onDeadTap={onDeadTap}
          onLongPress={(e: any) => onVerseLongPress(verse.verseNumber, e?.nativeEvent?.pageY)}>
          <Text style={[styles(nightMode).arabicText, { fontSize: size, color: textColor, fontFamily, lineHeight: lineH }, h && MISTAKE_HIGHLIGHT, isFlashing && { backgroundColor: 'rgba(255,215,0,0.2)' }]} maxFontSizeMultiplier={1}>{word}{word ? ' ' : ''}</Text>
        </WordHitArea>
      );
    });

    flow.push(
      <View key={`${vKey}_bdg`} style={styles(nightMode).badgeWrap}>
        <View style={[styles(nightMode).verseBadge, { backgroundColor: nightMode ? '#1e1e1e' : '#e8e8e8' }, isBookmarked && styles(nightMode).bookmarkedBadge, isReadingMark && styles(nightMode).readingMarkBadge]}>
          <Text style={[styles(nightMode).verseBadgeText, { color: nightMode ? '#fff' : '#121212' }, isBookmarked && styles(nightMode).bookmarkedBadgeText]}>{isReadingMark ? '📍' : verse.verseNumber}</Text>
        </View>
        {hasNote && <Text style={styles(nightMode).noteIcon}>📝</Text>}
      </View>
    );

    if (showTranslation) flow.push(<Text key={`${vKey}_tr`} style={styles(nightMode).translation}>{verse.textTranslation}</Text>);
  });

  return (
    <Pressable style={styles(nightMode).container} onPress={(e: any) => onDeadTap?.(e?.nativeEvent?.pageY)}>
      {flow}
    </Pressable>
  );
};
const styles = (nightMode: boolean) => StyleSheet.create({
  container: { width: '100%', paddingVertical: 12, paddingHorizontal: 4, backgroundColor: 'transparent', flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' },
  arabicText: {},
  basmala: { width: '100%', textAlign: 'center', marginTop: 8, marginBottom: 2 },
  badgeWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 3, minWidth: 18 },
  verseBadge: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: (nightMode ? '#7BA7DB' : '#1C3D72'), marginHorizontal: 1 },
  bookmarkedBadge: { backgroundColor: '#ffd700', borderColor: '#ffd700' },
  readingMarkBadge: { backgroundColor: '#4a90d9', borderColor: '#4a90d9' },
  verseBadgeText: { fontSize: 10, fontWeight: '700', fontFamily: 'normal' },
  bookmarkedBadgeText: { color: '#000000' },
  noteIcon: { color: '#ffd700', fontSize: 10, marginLeft: 2 },
  translation: { color: '#b0b0b0', fontStyle: 'italic', fontSize: 14, textAlign: 'center', marginTop: 4, marginBottom: 4, width: '100%' },
});
// memo export — effective: verses come from the redux verses array (stable identities).
export default memo(FlowingText);
