/**
 * FILE: src/tutorial/TutorialOverlay.tsx
 * ROLE: The visual layer — a 55% dim mask with a spotlight cut-out + accent ring around the
 *       step's target, and ONE stable bottom-sheet card (never clipped: buttons live outside
 *       the scroll area, the sheet always sits above the audio bar). Rendered ONCE by
 *       TutorialController at the app root.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, useWindowDimensions, StyleSheet, Animated, Easing, Platform, StatusBar } from 'react-native';
import TutorialHand from './TutorialHand';
import type { TutorialStep } from './tutorialSteps';
import type { TutorialAnchorRect } from './tutorialRuntime';
import { getTutorialContext } from './tutorialRuntime';

const DIM = 'rgba(0,0,0,0.55)';
const ACCENT = '#7BA7DB';
const TIP_X = 14;
const TIP_Y = 14;
// Bottom offset that clears the audio player bar on every screen the tutorial plays on.
const CARD_BOTTOM = 96;

const STATUSBAR_OFFSET = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;

interface Props {
  step: TutorialStep;
  stepIndex: number;
  total: number;
  anchorRect: TutorialAnchorRect | null;
  flash: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export default function TutorialOverlay({ step, stepIndex, total, anchorRect, flash, onNext, onBack, onSkip }: Props) {
  const { width: winW, height: winH } = useWindowDimensions();
  const fade = useRef(new Animated.Value(0)).current;

  // 150ms fade per step
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [stepIndex, fade]);

  const validAnchor = anchorRect
    && [anchorRect.x, anchorRect.y, anchorRect.w, anchorRect.h].every(Number.isFinite)
    && anchorRect.w > 0 && anchorRect.h > 0
    && anchorRect.x + anchorRect.w > 0 && anchorRect.y + anchorRect.h > 0
    && anchorRect.x < winW && anchorRect.y < winH
    ? anchorRect : null;

  const zone: TutorialAnchorRect | null = validAnchor
    ? {
        x: Math.max(4, validAnchor.x),
        y: Math.max(4, validAnchor.y + STATUSBAR_OFFSET),
        w: Math.max(24, Math.min(validAnchor.w, winW - 8 - Math.max(4, validAnchor.x))),
        h: Math.max(24, Math.min(validAnchor.h, winH - 8 - Math.max(4, validAnchor.y + STATUSBAR_OFFSET))),
      }
    : step.allowZone
      ? { x: step.allowZone.fx * winW, y: step.allowZone.fy * winH, w: step.allowZone.fw * winW, h: step.allowZone.fh * winH }
      : null;

  const isAction = step.kind === 'action';

  const resolveTokens = (t: string) => t.replace(/\{resumePage\}/g, getTutorialContext('resumePage') || 'the last page you viewed');
  const title = resolveTokens(step.title);
  const body = resolveTokens(step.body);
  const compare = step.compare ? {
    lTitle: resolveTokens(step.compare.lTitle), lBody: resolveTokens(step.compare.lBody),
    rTitle: resolveTokens(step.compare.rTitle), rBody: resolveTokens(step.compare.rBody),
  } : null;

  const handPos = zone
    ? { left: zone.x + zone.w / 2 - TIP_X, top: zone.y + zone.h / 2 - TIP_Y }
    : step.handPos
      ? { left: step.handPos.fx * winW - TIP_X, top: step.handPos.fy * winH - TIP_Y }
      : null;

  const dimRects = zone
    ? [
        { left: 0, top: 0, right: 0, height: Math.max(0, zone.y) },
        { left: 0, top: zone.y, width: Math.max(0, zone.x), height: zone.h },
        { left: zone.x + zone.w, top: zone.y, right: 0, height: zone.h },
        { left: 0, top: zone.y + zone.h, right: 0, height: Math.max(0, winH - zone.y - zone.h) },
      ]
    : [{ left: 0, top: 0, right: 0, height: winH }];

  return (
    <Animated.View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* dark mask (55% — target stays readable) */}
      <View style={StyleSheet.absoluteFill} pointerEvents={step.passThrough ? 'none' : 'auto'}>
        {dimRects.map((r, i) =>
          step.passThrough ? (
            <View key={i} style={[StyleSheet.absoluteFill, r, { backgroundColor: DIM }]} />
          ) : (
            <TouchableOpacity key={i} activeOpacity={1} onPress={() => {}} style={[StyleSheet.absoluteFill, r, { backgroundColor: DIM }]} />
          ),
        )}
        {/* accent ring around the target */}
        {zone ? <View pointerEvents="none" style={[styles.ring, { left: zone.x - 3, top: zone.y - 3, width: zone.w + 6, height: zone.h + 6 }]} /> : null}
      </View>

      {/* pointing hand */}
      {step.hand && handPos ? <TutorialHand left={handPos.left} top={handPos.top} /> : null}

      {/* card layer */}
      <Animated.View style={[styles.cardAnchor, { opacity: fade }]} pointerEvents="box-none">
        <View style={styles.card}>
          {/* header row: chapter label (left) + step counter + close button (right) */}
          <View style={styles.topRow}>
            <Text style={styles.chapter}>{step.chapter ? step.chapter.toUpperCase() : ''}</Text>
            <View style={styles.rightTop}>
              <Text style={styles.counter}>{`${stepIndex + 1} of ${total}`}</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={onSkip} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* progress bar */}
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${((stepIndex + 1) / total) * 100}%` }]} />
          </View>

          {/* scrollable text body */}
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>{title}</Text>
            {body ? <Text style={styles.body}>{body}</Text> : null}

            {/* comparison card */}
            {compare ? (
              <View style={styles.compareWrap}>
                <View style={[styles.compareCol, styles.compareColLeft]}>
                  <Text style={styles.compareTitle}>{compare.lTitle}</Text>
                  <Text style={styles.compareBody}>{compare.lBody}</Text>
                </View>
                <View style={styles.compareCol}>
                  <Text style={styles.compareTitle}>{compare.rTitle}</Text>
                  <Text style={styles.compareBody}>{compare.rBody}</Text>
                </View>
              </View>
            ) : null}
          </ScrollView>

          {/* action row */}
          <View style={styles.actions}>
            {/* action-step badge: ✓ flash when an action succeeds, else "Your turn" */}
            {isAction ? (
              <View style={[styles.actionBadge, flash && styles.actionBadgeFlash]}>
                <Text style={styles.actionBadgeText}>{flash ? '✓' : 'Your turn'}</Text>
              </View>
            ) : <View style={styles.actionBadgePlaceholder} />}

            {/* secondary buttons */}
            <View style={styles.btnRow}>
              {step.skipLabel ? (
                <TouchableOpacity style={styles.skipBtn} onPress={onNext}>
                  <Text style={styles.skipText}>{step.skipLabel}</Text>
                </TouchableOpacity>
              ) : null}

              {stepIndex > 0 ? (
                <TouchableOpacity style={styles.backBtn} onPress={onBack}>
                  <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
              ) : null}

              {!isAction ? (
                <TouchableOpacity style={styles.nextBtn} onPress={onNext}>
                  <Text style={styles.nextText}>{stepIndex + 1 === total ? 'Got it!' : 'Next'}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: ACCENT,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  cardAnchor: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: CARD_BOTTOM,
  },
  card: {
    backgroundColor: '#1C2234',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(123,167,219,0.3)',
    padding: 16,
    maxHeight: 280,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  chapter: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  rightTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  counter: {
    color: '#8E95A8',
    fontSize: 12,
    fontWeight: '600',
  },
  closeBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: '#8E95A8',
    fontSize: 11,
    fontWeight: '700',
  },
  track: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 1.5,
    overflow: 'hidden',
    marginBottom: 12,
  },
  fill: {
    height: '100%',
    backgroundColor: ACCENT,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16.5,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0.1,
  },
  body: {
    color: '#C7D2E8',
    fontSize: 13.5,
    lineHeight: 19.5,
  },
  compareWrap: {
    flexDirection: 'row',
    backgroundColor: '#141826',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginTop: 10,
    overflow: 'hidden',
  },
  compareCol: {
    flex: 1,
    padding: 10,
  },
  compareColLeft: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.06)',
  },
  compareTitle: {
    color: ACCENT,
    fontSize: 11.5,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  compareBody: {
    color: '#AAB8D4',
    fontSize: 12,
    lineHeight: 16.5,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  actionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(123,167,219,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(123,167,219,0.4)',
  },
  actionBadgeFlash: {
    backgroundColor: '#4CAF50',
    borderColor: '#66BB6A',
  },
  actionBadgeText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  actionBadgePlaceholder: {
    width: 60,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  skipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  skipText: {
    color: '#AAB8D4',
    fontSize: 12.5,
    fontWeight: '600',
  },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  backText: {
    color: '#C7D2E8',
    fontSize: 12.5,
    fontWeight: '600',
  },
  nextBtn: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#1C3D72',
  },
  nextText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
