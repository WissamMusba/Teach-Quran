/**
 * FILE: src/tutorial/TutorialOverlay.tsx
 * ROLE: The visual layer — a 55% dim mask with a spotlight cut-out + accent ring around the
 *       step's target, and ONE stable bottom-sheet card (never clipped: buttons live outside
 *       the scroll area, the sheet always sits above the audio bar). Rendered ONCE by
 *       TutorialController at the app root.
 * DEPENDS ON: TutorialHand, tutorialSteps (types), tutorialRuntime (types).
 * USED BY: TutorialController.tsx only.
 * TOUCH MODEL:
 *   - Dark mask = FOUR rects around the interactive region (anchor hole or allowZone); each
 *     rect is a touchable with an empty handler on blocking steps, a plain View otherwise.
 *   - The interactive region itself is uncovered → touches reach the real UI.
 *   - The tooltip layer is a SIBLING with pointerEvents='box-none' → Skip/Back/Next work on
 *     every step regardless of the mask's mode.
 *   - The card is a FIXED bottom sheet (bottom offset clears the audio bar) — no jumping.
 * PACING: 150ms fade on every step change; ✓ flash badge (flash prop) confirms "your turn"
 *   actions before the controller advances.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, useWindowDimensions, StyleSheet, Animated, Easing } from 'react-native';
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

  // 150ms fade per step (review: short transitions, no long crossfades).
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [stepIndex, fade]);

  // Interactive region: anchored element, else the step's allowZone, else nothing (full dim).
  // Defense-in-depth: a rect that is non-finite or fully off-window is treated as missing —
  // the runtime guard already rejects those, but a bad rect must NEVER clamp into a
  // misleading top-left spotlight.
  const validAnchor = anchorRect
    && [anchorRect.x, anchorRect.y, anchorRect.w, anchorRect.h].every(Number.isFinite)
    && anchorRect.w > 0 && anchorRect.h > 0
    && anchorRect.x + anchorRect.w > 0 && anchorRect.y + anchorRect.h > 0
    && anchorRect.x < winW && anchorRect.y < winH
    ? anchorRect : null;
  const zone: TutorialAnchorRect | null = validAnchor
    ? {
        x: Math.max(4, validAnchor.x),
        y: Math.max(4, validAnchor.y),
        w: Math.max(24, Math.min(validAnchor.w, winW - 8 - Math.max(4, validAnchor.x))),
        h: Math.max(24, Math.min(validAnchor.h, winH - 8 - Math.max(4, validAnchor.y))),
      }
    : step.allowZone
      ? { x: step.allowZone.fx * winW, y: step.allowZone.fy * winH, w: step.allowZone.fw * winW, h: step.allowZone.fh * winH }
      : null;

  const isAction = step.kind === 'action';

  // Dynamic text tokens — {resumePage} is filled from the tutorial context (StudentHub sets
  // it when the student's resume page resolves); generic wording until it lands.
  const resolveTokens = (t: string) => t.replace(/\{resumePage\}/g, getTutorialContext('resumePage') || 'the last page you viewed');
  const title = resolveTokens(step.title);
  const body = resolveTokens(step.body);
  const compare = step.compare ? {
    lTitle: resolveTokens(step.compare.lTitle), lBody: resolveTokens(step.compare.lBody),
    rTitle: resolveTokens(step.compare.rTitle), rBody: resolveTokens(step.compare.rBody),
  } : null;

  // Hand: zone center, or the handPos fraction; hidden entirely when neither resolved.
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

      {/* pointing hand — never intercepts; hidden when no target resolved */}
      {step.hand && handPos && (
        <View style={{ position: 'absolute', left: handPos.left, top: handPos.top }} pointerEvents="none">
          <TutorialHand />
        </View>
      )}

      {/* ✓ success flash — confirms the tutorial registered the action before advancing */}
      {flash ? (
        <View pointerEvents="none" style={styles.flashWrap}>
          <View style={styles.flashBadge}>
            <Text style={styles.flashText}>✓ Nicely done</Text>
          </View>
        </View>
      ) : null}

      {/* tooltip layer — box-none: only the pill and card take touches */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* bottom sheet — ONE stable position on every step; buttons live OUTSIDE the scroll */}
        <Animated.View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder, bottom: CARD_BOTTOM, opacity: fade }]}>
          {/* skip pill rides the card's top edge — never over header controls or sync status */}
          <TouchableOpacity onPress={onSkip} style={styles.skipPill}>
            <Text style={styles.skipPillText}>Skip tutorial ✕</Text>
          </TouchableOpacity>

          <View style={styles.progressRow} pointerEvents="none">
            <Text style={styles.chapter}>{step.chapter ? step.chapter.toUpperCase() : ''}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(((stepIndex + 1) / total) * 100)}%` } as any]} />
            </View>
            <Text style={styles.stepCount}>{stepIndex + 1}/{total}</Text>
          </View>

          <ScrollView style={styles.bodyScroll} bounces={false}>
            <Text style={styles.title}>{title}</Text>

            {step.kind === 'compare' && compare ? (
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <View style={styles.compareHalf}>
                  <Text style={styles.compareTitle}>{compare.lTitle}</Text>
                  <Text style={styles.compareBody}>{compare.lBody}</Text>
                </View>
                <View style={[styles.compareHalf, { marginLeft: 8 }]}>
                  <Text style={styles.compareTitle}>{compare.rTitle}</Text>
                  <Text style={styles.compareBody}>{compare.rBody}</Text>
                </View>
              </View>
            ) : null}

            <Text style={styles.body}>{body}</Text>
          </ScrollView>

          <View style={styles.footer}>
            {stepIndex > 0 ? (
              <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.backText}>‹ Back</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.backBtn} />
            )}
            {isAction && step.skipLabel ? (
              <TouchableOpacity onPress={onNext} style={styles.skipStepBtn}>
                <Text style={styles.skipStepText}>{step.skipLabel}</Text>
              </TouchableOpacity>
            ) : null}
            {!isAction ? (
              <TouchableOpacity onPress={onNext} style={styles.nextBtn}>
                <Text style={styles.nextText}>{stepIndex + 1 >= total ? 'Finish' : 'Next ›'}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.waitingText}>your turn — try it now</Text>
            )}
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const cardBg = '#16233B';
const cardBorder = 'rgba(123,167,219,0.35)';

const styles = StyleSheet.create({
  ring: { position: 'absolute', borderRadius: 12, borderWidth: 2.5, borderColor: ACCENT },
  flashWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  flashBadge: { backgroundColor: 'rgba(22,35,59,0.95)', borderColor: ACCENT, borderWidth: 2, borderRadius: 14, paddingHorizontal: 22, paddingVertical: 14, elevation: 14 },
  flashText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  card: { position: 'absolute', left: 12, right: 12, borderRadius: 16, borderWidth: 1, padding: 14, elevation: 12, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  skipPill: { position: 'absolute', top: -18, right: 10, backgroundColor: 'rgba(22,35,59,0.97)', borderColor: 'rgba(123,167,219,0.5)', borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, elevation: 10 },
  skipPillText: { color: '#E6ECF5', fontSize: 13, fontWeight: '700' },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  chapter: { color: '#8a90a0', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, maxWidth: '42%' },
  progressTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 8 },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: ACCENT },
  stepCount: { color: '#8a90a0', fontSize: 10.5, fontWeight: '700' },
  bodyScroll: { maxHeight: 220 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginTop: 2 },
  body: { color: '#C9D2E3', fontSize: 13.5, lineHeight: 19, marginTop: 6 },
  compareHalf: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(123,167,219,0.3)', padding: 10, backgroundColor: 'rgba(123,167,219,0.08)' },
  compareTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  compareBody: { color: '#C9D2E3', fontSize: 11.5, lineHeight: 16, marginTop: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  backBtn: { minWidth: 52 },
  backText: { color: '#C9D2E3', fontSize: 14, fontWeight: '700', paddingVertical: 8 },
  nextBtn: { backgroundColor: ACCENT, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10, marginLeft: 6 },
  nextText: { color: '#0E1626', fontWeight: '800', fontSize: 14 },
  skipStepBtn: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  skipStepText: { color: '#E6ECF5', fontWeight: '700', fontSize: 13 },
  waitingText: { color: '#8a90a0', fontSize: 12, fontStyle: 'italic' },
});
