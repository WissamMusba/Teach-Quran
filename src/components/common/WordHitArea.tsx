/**
 * FILE: src/components/common/WordHitArea.tsx
 * ROLE: Pressable wrapper that classifies a word tap as a "real" hit (center band) vs a "dead" tap (edges) using measured width, so margin taps don't toggle highlights.
 * DEPENDS ON: a `tapFraction` (default 0.5) and the word's rendered width (from onLayout); correctness requires the wrapped word to be laid out before taps.
 * USED BY: src/components/quran/MushafPageView.tsx (:5 import, :318-325); src/components/quran/FlowingText.tsx (:7, :41-44); src/components/quran/VerseDisplay.tsx (:7, :29-31)
 */
import React, { useCallback, useRef } from 'react';
import { Pressable, View, type PressableProps, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';

interface WordHitAreaProps extends Omit<PressableProps, 'onPress'> {
  tapFraction?: number;
  onWordPress?: () => void;
  onDeadTap?: () => void;
  onMeasured?: (width: number) => void;
}

/**
 * WordHitArea — tap-fraction hit math: converts the tap's window-X into a local X within the word.
 * PROPS: tapFraction (default 0.5 — only the center 50% counts as a word tap); onWordPress (center band);
 *        onDeadTap (outer margins); onLongPress (passed straight to Pressable); onMeasured(width) (fires from onLayout);
 *        style / children / ...rest → forwarded to Pressable.
 * FLOW: 1) handleLayout stores the word's rendered width (onLayout) and fires onMeasured(width).
 *       2) handlePress: if width not yet known (w <= 0) it OPTIMISTICALLY calls onWordPress — no dead-tap classification possible.
 *       3) Otherwise `ref.current.measureInWindow((x) => …)` reads the view's absolute window X.
 *       4) localX = e.nativeEvent.pageX − x; margin = (w * (1 − tapFraction)) / 2; localX inside [margin, w − margin]
 *          → onWordPress(), else onDeadTap().
 * CALLED BY: MushafPageView.tsx:318-321 → tapFraction=WORD_TAP_FRACTION; onWordPress toggles the mistake highlight;
 *            onLongPress opens the verse menu with pageY; onMeasured feeds handleWordMeasured (the fit-to-line measure dance).
 *            FlowingText.tsx:41 / VerseDisplay.tsx:29 → flowing/ayah modes, same tapFraction.
 * AFFECTS: Rendering behavior — determines whether a word highlight is toggled (QuranViewScreen handleWordFlow) or whether the tap is swallowed (dead).
 * NOTES/GOTCHAS:
 *   - onDeadTap is invoked with NO arguments. QuranViewScreen's old handleDeadTap (which required pageY and filtered by
 *     EDGE_ZONE) was DELETED; parents now pass toggleHeader (takes no args) — dead taps DO toggle the header in every
 *     mode, including page mode (which also has dedicated edge-strip Pressables).
 *   - onMeasured contract (CRITICAL for MushafPageView's measure dance): handleWordMeasured accumulates each word's
 *     onLayout width per line, computes an overflow scale (lineW−12)/content (clamped ≥0.65), stores it in scaleRef, and
 *     calls setLineScale — applied via scaleForLine; when every line of the page has reported it persists widths to SQLite
 *     via savePageLayoutCache. onMeasured must fire reliably on EVERY layout — the reader resets caches when
 *     pageNum/headerVisible/textStyle/pageWidth/fixNonce change.
 *   - measureInWindow is async; pageX is the finger position, not the word's origin — hence the margin math.
 */
const WordHitArea = ({ tapFraction = 0.5, onWordPress, onDeadTap, onLongPress, onMeasured, style, children, ...rest }: WordHitAreaProps) => {
  const ref = useRef<View | null>(null);
  const widthRef = useRef(0);

  // Capture the word's rendered width on every layout; also feeds the parent's onMeasured pipeline (MushafPageView's fit-to-line scaling + cache save).
  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
    onMeasured?.(e.nativeEvent.layout.width);
  }, [onMeasured]);

  // Classify the tap: center tapFraction band → onWordPress; outer margins → onDeadTap (no args); unmeasured word → optimistic onWordPress.
  const handlePress = useCallback((e: GestureResponderEvent) => {
    const w = widthRef.current;
    if (w <= 0) { onWordPress?.(); return; }
    ref.current?.measureInWindow((x) => {
      const localX = e.nativeEvent.pageX - x;
      const margin = (w * (1 - tapFraction)) / 2;
      if (localX >= margin && localX <= w - margin) onWordPress?.();
      else onDeadTap?.();
    });
  }, [tapFraction, onWordPress, onDeadTap]);

  return (
    <Pressable ref={ref} onLayout={handleLayout} onPress={handlePress} onLongPress={onLongPress} style={style} {...rest}>
      {children}
    </Pressable>
  );
};

export default WordHitArea;
