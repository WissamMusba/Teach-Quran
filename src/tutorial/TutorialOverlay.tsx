/**
 * FILE: src/tutorial/TutorialOverlay.tsx
 * ROLE: The visual layer — dark mask with ONE interactive region (the anchored element or
 *       the step's allowZone), tooltip card (title/body/Back/Next/Skip), comparison cards,
 *       and the animated pointing hand. Rendered ONCE by TutorialController at the app root.
 * DEPENDS ON: TutorialHand, tutorialSteps (types), tutorialRuntime (types).
 * USED BY: TutorialController.tsx only.
 * TOUCH MODEL (the important part):
 *   - The dark mask is built from FOUR rects around the interactive region. Each rect is a
 *     TouchableOpacity with an empty handler → taps there are swallowed (app unresponsive).
 *   - The interactive region itself is NOT covered → taps fall through to the real UI.
 *   - The tooltip layer is a SIBLING with pointerEvents='box-none', so Skip/Back/Next work on
 *     EVERY step (the old single-root structure made them dead on passThrough steps).
 *   - The hand layer never intercepts. If no target rect resolved, the hand is hidden
 *     (never parked at a corner).
 */
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, useWindowDimensions, StyleSheet } from 'react-native';
import TutorialHand from './TutorialHand';
import type { TutorialStep } from './tutorialSteps';
import type { TutorialAnchorRect } from './tutorialRuntime';

const DIM = 'rgba(0,0,0,0.78)';
const ACCENT = '#7BA7DB';
const TIP_X = 14;
const TIP_Y = 14;

interface Props {
  step: TutorialStep;
  stepIndex: number;
  total: number;
  anchorRect: TutorialAnchorRect | null;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export default function TutorialOverlay({ step, stepIndex, total, anchorRect, onNext, onBack, onSkip }: Props) {
  const { width: winW, height: winH } = useWindowDimensions();
  const cardBg = '#16233B';
  const cardBorder = 'rgba(123,167,219,0.35)';

  // Interactive region: anchored element, else the step's allowZone, else nothing (full dim).
  const zone: TutorialAnchorRect | null = anchorRect
    ? {
        x: Math.max(4, anchorRect.x),
        y: Math.max(4, anchorRect.y),
        w: Math.max(24, Math.min(anchorRect.w, winW - 8 - Math.max(4, anchorRect.x) + 4)),
        h: Math.max(24, Math.min(anchorRect.h, winH - 8 - Math.max(4, anchorRect.y) + 4)),
      }
    : step.allowZone
      ? { x: step.allowZone.fx * winW, y: step.allowZone.fy * winH, w: step.allowZone.fw * winW, h: step.allowZone.fh * winH }
      : null;

  const isAction = step.kind === 'action';

  // Hand target: zone center, or the handPos fraction; hidden entirely when neither resolved.
  const handPos = zone
    ? { left: zone.x + zone.w / 2 - TIP_X, top: zone.y + zone.h / 2 - TIP_Y }
    : step.handPos
      ? { left: step.handPos.fx * winW - TIP_X, top: step.handPos.fy * winH - TIP_Y }
      : null;

  // Tooltip placement: above the zone when it sits in the lower half, below otherwise.
  const above = !!zone && zone.y + zone.h / 2 > winH * 0.5;
  const cardPos: any = zone
    ? above
      ? { position: 'absolute', left: 14, right: 14, bottom: winH - zone.y + 12 }
      : { position: 'absolute', left: 14, right: 14, top: zone.y + zone.h + 12 }
    : { position: 'absolute', left: 20, right: 20, top: '34%' as any };

  const dimRects = zone
    ? [
        { left: 0, top: 0, right: 0, height: Math.max(0, zone.y) },
        { left: 0, top: zone.y, width: Math.max(0, zone.x), height: zone.h },
        { left: zone.x + zone.w, top: zone.y, right: 0, height: zone.h },
        { left: 0, top: zone.y + zone.h, right: 0, height: Math.max(0, winH - zone.y - zone.h) },
      ]
    : [{ left: 0, top: 0, right: 0, height: winH }];

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* dark mask — every rect swallows taps; the interactive region is simply uncovered */}
      {dimRects.map((r, i) =>
        step.passThrough ? (
          <View key={i} style={[StyleSheet.absoluteFill, r, { backgroundColor: DIM }]} />
        ) : (
          <TouchableOpacity key={i} activeOpacity={1} onPress={() => {}} style={[StyleSheet.absoluteFill, r, { backgroundColor: DIM }]} />
        ),
      )}

      {/* pointing hand — never intercepts; hidden when no target resolved */}
      {step.hand && handPos && (
        <View style={{ position: 'absolute', left: handPos.left, top: handPos.top }} pointerEvents="none">
          <TutorialHand />
        </View>
      )}

      {/* tooltip layer — box-none: only the pill and card take touches */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <TouchableOpacity onPress={onSkip} style={styles.skipPill}>
          <Text style={styles.skipPillText}>Skip tutorial ✕</Text>
        </TouchableOpacity>

        <View style={[styles.card, cardPos, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <ScrollView style={{ maxHeight: 260 }} bounces={false}>
            <Text style={styles.stepCount}>Step {stepIndex + 1} of {total}</Text>
            <Text style={styles.title}>{step.title}</Text>

            {step.kind === 'compare' && step.compare ? (
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <View style={styles.compareHalf}>
                  <Text style={styles.compareTitle}>{step.compare.lTitle}</Text>
                  <Text style={styles.compareBody}>{step.compare.lBody}</Text>
                </View>
                <View style={[styles.compareHalf, { marginLeft: 8 }]}>
                  <Text style={styles.compareTitle}>{step.compare.rTitle}</Text>
                  <Text style={styles.compareBody}>{step.compare.rBody}</Text>
                </View>
              </View>
            ) : null}

            <Text style={styles.body}>{step.body}</Text>
          </ScrollView>

          <View style={styles.footer}>
            {stepIndex > 0 ? (
              <TouchableOpacity onPress={onBack} style={styles.backBtn}>
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
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skipPill: { position: 'absolute', top: 14, right: 14, backgroundColor: 'rgba(22,35,59,0.95)', borderColor: 'rgba(123,167,219,0.45)', borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, elevation: 8 },
  skipPillText: { color: '#E6ECF5', fontSize: 13, fontWeight: '700' },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, elevation: 12, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  stepCount: { color: '#8a90a0', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginTop: 4 },
  body: { color: '#C9D2E3', fontSize: 13.5, lineHeight: 19, marginTop: 6 },
  compareHalf: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(123,167,219,0.3)', padding: 10, backgroundColor: 'rgba(123,167,219,0.08)' },
  compareTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  compareBody: { color: '#C9D2E3', fontSize: 11.5, lineHeight: 16, marginTop: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  backBtn: { minWidth: 56 },
  backText: { color: '#C9D2E3', fontSize: 14, fontWeight: '700', paddingVertical: 8 },
  nextBtn: { backgroundColor: ACCENT, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10, marginLeft: 6 },
  nextText: { color: '#0E1626', fontWeight: '800', fontSize: 14 },
  skipStepBtn: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  skipStepText: { color: '#E6ECF5', fontWeight: '700', fontSize: 13 },
  waitingText: { color: '#8a90a0', fontSize: 12, fontStyle: 'italic' },
});
