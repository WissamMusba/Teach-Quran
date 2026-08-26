/**
 * FILE: src/tutorial/TutorialOverlay.tsx
 * ROLE: The visual layer — dim mask with a spotlight "hole" over the anchored element,
 *       tooltip card (title/body/Next/Skip/step dots), comparison cards, and the animated
 *       pointing hand. Rendered ONCE by TutorialController at the app root.
 * DEPENDS ON: TutorialHand, tutorialRuntime (types), react-native-svg-free (plain views).
 * USED BY: TutorialController.tsx only.
 * NOTES:
 *   - Blocking steps (info/spotlight/compare): four dim rects cover everything EXCEPT the
 *     hole; each rect is a touchable with an empty handler so taps cannot leak to the app.
 *   - passThrough steps (actions): the whole layer is pointerEvents='none' — the user must
 *     reach the real UI; only the tooltip card re-enables touches for its own buttons.
 *   - The hand's fingertip is at local (14,14) of its 64px box (see TutorialHand).
 */
import React from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions, StyleSheet } from 'react-native';
import TutorialHand from './TutorialHand';
import type { TutorialStep } from './tutorialSteps';
import type { TutorialAnchorRect } from './tutorialRuntime';

const DIM = 'rgba(0,0,0,0.74)';
const ACCENT = '#7BA7DB';
const TIP_X = 14;
const TIP_Y = 14;

interface Props {
  step: TutorialStep;
  stepIndex: number;
  total: number;
  anchorRect: TutorialAnchorRect | null;
  onNext: () => void;
  onSkip: () => void;
}

export default function TutorialOverlay({ step, stepIndex, total, anchorRect, onNext, onSkip }: Props) {
  const { width: winW, height: winH } = useWindowDimensions();
  const night = true; // tutorial always renders on the dark scrim
  const cardBg = '#16233B';
  const cardBorder = 'rgba(123,167,219,0.35)';

  // Hole rect clamped to the screen; centered card when there is no anchor.
  const hole = anchorRect
    ? {
        x: Math.max(4, Math.min(anchorRect.x, winW - anchorRect.w - 4)),
        y: Math.max(4, Math.min(anchorRect.y, winH - anchorRect.h - 4)),
        w: Math.max(24, Math.min(anchorRect.w, winW - 8)),
        h: Math.max(24, Math.min(anchorRect.h, winH - 8)),
      }
    : null;

  const showHand = !!step.hand;
  const handLeft = hole ? hole.x + hole.w / 2 - TIP_X : (step.handPos ? step.handPos.fx * winW - TIP_X : 0);
  const handTop = hole ? hole.y + hole.h / 2 - TIP_Y : (step.handPos ? step.handPos.fy * winH - TIP_Y : 0);

  // Tooltip placement: below the hole when there's room, else above; centered when no hole.
  const above = !!hole && hole.y > winH * 0.5;
  const cardPos: any = hole
    ? above
      ? { position: 'absolute', left: 16, right: 16, bottom: winH - hole.y + 14 }
      : { position: 'absolute', left: 16, right: 16, top: hole.y + hole.h + 14 }
    : { position: 'absolute', left: 24, right: 24, top: '38%' as any };

  const isAction = step.kind === 'action';
  const blocking = !step.passThrough;

  const dimRects = hole
    ? [
        { left: 0, top: 0, right: 0, height: hole.y },
        { left: 0, top: hole.y, width: hole.x, height: hole.h },
        { left: hole.x + hole.w, top: hole.y, right: 0, height: hole.h },
        { left: 0, top: hole.y + hole.h, right: 0, height: winH - hole.y - hole.h },
      ]
    : [{ left: 0, top: 0, right: 0, height: winH }];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={step.passThrough ? 'none' : 'auto'}>
      {/* dim mask — touchable when blocking so taps can never leak through */}
      {dimRects.map((r, i) =>
        blocking ? (
          <TouchableOpacity key={i} activeOpacity={1} onPress={() => {}} style={[StyleSheet.absoluteFill, r, { backgroundColor: DIM }]} />
        ) : (
          <View key={i} style={[StyleSheet.absoluteFill, r, { backgroundColor: DIM }]} />
        ),
      )}

      {/* hand (never intercepts) */}
      {showHand && (
        <View style={{ position: 'absolute', left: handLeft, top: handTop }} pointerEvents="none">
          <TutorialHand />
        </View>
      )}

      {/* tooltip layer — box-none so passThrough steps still reach the app except the card */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* always-available exit pill */}
        <TouchableOpacity onPress={onSkip} style={styles.skipPill}>
          <Text style={styles.skipPillText}>Skip tutorial ✕</Text>
        </TouchableOpacity>

        <View style={[styles.card, cardPos, { backgroundColor: cardBg, borderColor: cardBorder }]} pointerEvents="auto">
          <Text style={styles.stepCount}>Step {stepIndex + 1} / {total}</Text>
          <Text style={styles.title}>{step.title}</Text>

          {step.kind === 'compare' && step.compare ? (
            <View style={{ flexDirection: 'row', marginTop: 8 }}>
              <View style={[styles.compareHalf, { borderColor: 'rgba(123,167,219,0.3)' }]}>
                <Text style={styles.compareTitle}>{step.compare.lTitle}</Text>
                <Text style={styles.compareBody}>{step.compare.lBody}</Text>
              </View>
              <View style={[styles.compareHalf, { marginLeft: 8, borderColor: 'rgba(123,167,219,0.3)' }]}>
                <Text style={styles.compareTitle}>{step.compare.rTitle}</Text>
                <Text style={styles.compareBody}>{step.compare.rBody}</Text>
              </View>
            </View>
          ) : null}

          <Text style={styles.body}>{step.body}</Text>

          <View style={styles.footer}>
            <View style={styles.dots}>
              {Array.from({ length: total }).map((_, i) => (
                <View key={i} style={[styles.dot, i === stepIndex && styles.dotActive]} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {isAction && step.skipLabel ? (
                <TouchableOpacity onPress={onNext} style={styles.skipStepBtn}>
                  <Text style={styles.skipStepText}>{step.skipLabel}</Text>
                </TouchableOpacity>
              ) : null}
              {!isAction ? (
                <TouchableOpacity onPress={onNext} style={styles.nextBtn}>
                  <Text style={styles.nextText}>{stepIndex + 1 >= total ? 'Finish' : 'Next'}</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.waitingText}>do it now…</Text>
              )}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skipPill: { position: 'absolute', top: 14, right: 14, backgroundColor: 'rgba(22,35,59,0.92)', borderColor: 'rgba(123,167,219,0.4)', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  skipPillText: { color: '#CFCFCF', fontSize: 12, fontWeight: '600' },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, elevation: 12, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, maxHeight: '46%' },
  stepCount: { color: '#8a90a0', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginTop: 4 },
  body: { color: '#C9D2E3', fontSize: 13.5, lineHeight: 19, marginTop: 6 },
  compareHalf: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 10, backgroundColor: 'rgba(123,167,219,0.08)' },
  compareTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  compareBody: { color: '#C9D2E3', fontSize: 11.5, lineHeight: 16, marginTop: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  dots: { flexDirection: 'row', flexWrap: 'wrap', maxWidth: 150 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', marginRight: 4, marginBottom: 4 },
  dotActive: { backgroundColor: ACCENT, width: 8, height: 8, borderRadius: 4 },
  nextBtn: { backgroundColor: ACCENT, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 9, marginLeft: 6 },
  nextText: { color: '#0E1626', fontWeight: '800', fontSize: 14 },
  skipStepBtn: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  skipStepText: { color: '#CFCFCF', fontWeight: '600', fontSize: 13 },
  waitingText: { color: '#8a90a0', fontSize: 12, fontStyle: 'italic' },
});
