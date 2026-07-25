import React, { memo, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, withDelay, Easing } from 'react-native-reanimated';
import { COLORS, SPACING, RADIUS, scaleFont, FONT_SIZES, getArabicFont, moderateScale } from '../../utils/theme';
const VerseDisplay = ({ verse, highlights, isBookmarked, isReadingMark, onWordPress, onBookmarkToggle, onVerseLongPress, showTranslation, fontSize, flashingVerse }: any) => {
  const textStyle = useSelector((s: any) => s.quran.textStyle);
  const nightMode = useSelector((s: any) => s.settings.nightMode);
  const textBrightness = useSelector((s: any) => s.settings.textBrightness);
  const displayText = textStyle === 'indopak' ? (verse.textIndopak || verse.textArabic) : verse.textArabic;
  const words = displayText.replace(/۞/u, '').trim().split(' ');
  const alpha = textBrightness / 255;
  const textColor = nightMode ? `rgba(255,255,255,${alpha})` : `rgba(26,26,26,${alpha})`;
  const isFlashing = flashingVerse === verse.verseNumber;
  const flashOpacity = useSharedValue(0);
  useEffect(() => { if (isFlashing) flashOpacity.value = withSequence(withTiming(0.35, { duration: 300, easing: Easing.out(Easing.ease) }), withDelay(1200, withTiming(0, { duration: 500 }))); }, [isFlashing]);
  const flashStyle = useAnimatedStyle(() => ({ backgroundColor: `rgba(255,215,0,${flashOpacity.value})` }));
  const arabicFont = getArabicFont(textStyle);
  const scaledFontSize = scaleFont(FONT_SIZES[fontSize as keyof typeof FONT_SIZES] || 24);
  const lineHeight = scaledFontSize * 2.1;
  const badgeBg = isReadingMark ? COLORS.blue : isBookmarked ? COLORS.gold : (nightMode ? COLORS.bgCardLight : '#e8e8e8');
  const badgeBorder = isReadingMark ? COLORS.blue : isBookmarked ? COLORS.gold : COLORS.primary;
  const badgeTextColor = isBookmarked && !isReadingMark ? '#000' : '#fff';
  return (
    <Animated.View style={[styles.container, flashStyle, { borderBottomColor: nightMode ? COLORS.borderDark : COLORS.borderLight }]}>
      <View style={styles.arabicRow}>
        {words.map((word: string, index: number) => {
          const h = highlights?.find((hl: any) => hl.wordIndex === index);
          return (
            <TouchableOpacity key={index} onPress={() => onWordPress(index)} activeOpacity={0.7} hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}>
              <Text style={[styles.arabicText, { fontSize: scaledFontSize, lineHeight, color: textColor, fontFamily: arabicFont }, h && { borderBottomWidth: 3, borderBottomColor: h.color, backgroundColor: h.color + '33' }]}>{word}{' '}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity onPress={() => onVerseLongPress(verse.verseNumber)} onLongPress={() => onBookmarkToggle(verse.verseNumber)} activeOpacity={0.7}>
          <View style={[styles.verseBadge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
            <Text style={[styles.verseBadgeText, { color: badgeTextColor }]}>{isReadingMark ? '📍' : verse.verseNumber}</Text>
          </View>
        </TouchableOpacity>
      </View>
      {showTranslation && verse.textTranslation ? (<Text style={[styles.translation, { color: nightMode ? COLORS.textSecondary : COLORS.textDarkSecondary, fontSize: moderateScale(15) }]}>{verse.textTranslation}</Text>) : null}
    </Animated.View>
  );
};
const styles = StyleSheet.create({
  container: { marginBottom: SPACING.xxl, paddingTop: SPACING.md, paddingBottom: SPACING.md, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.sm },
  arabicRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center' },
  arabicText: { textAlign: 'right' },
  verseBadge: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', marginLeft: SPACING.md, marginTop: SPACING.xs, borderWidth: 1.5 },
  verseBadgeText: { fontSize: scaleFont(13), fontWeight: '700' },
  translation: { marginTop: SPACING.md, fontStyle: 'italic', lineHeight: 24 },
});
export default memo(VerseDisplay);
