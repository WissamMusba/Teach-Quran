/**
 * FILE: src/hooks/useHeaderSwipe.ts
 * ROLE: PanResponder that toggles header visibility from vertical swipes near the top/bottom screen edges (edge-zone 80px, min swipe 40px, needs dy > 1.5x dx).
 * DEPENDS ON: a `setHeaderVisible` callback (kept in a ref so the PanResponder is created once).
 * USED BY: NOTHING — DEAD FILE. Never imported anywhere in src/ (grep finds only its own definition).
 * NOTES:
 * - Header toggling actually lives in QuranViewScreen's inline PanGestureHandler + onSwipe (QuranViewScreen.tsx:846-855, mounted at :1075): vertical swipes in the top half show on swipe-down / hide on swipe-up, inverted in the bottom half; horizontal swipes change surah in non-page modes. That PanGestureHandler is only mounted when readingMode !== 'page'.
 * - Header toggling is ALSO covered in page mode via `toggleHeader` (any dead tap) and two transparent edge-strip Pressables (24px phone / 50px tablet).
 * - Rebuild decision: delete this file; keep the inline PanGestureHandler implementation.
 * - FIX LOG (2026-08-06 audit):
 *   1. OFF-BY-ONE: the claim and release handlers duplicated the bottom-zone boundary
 *      (`gs.y0 > H - EDGE`) with no shared definition — any drift between them swallows a
 *      claimed swipe without toggling (responder taken, release ignores it). The zone is
 *      now one shared `inEdgeZone()` used by BOTH claim and release, inclusive at both edges.
 *   2. Stale window height: Dimensions.get('window') measured mid-gesture was replaced by
 *      useWindowDimensions fed into a ref, so rotation/split-screen height changes stay live
 *      without recreating the once-created responder closure.
 *   3. Fights the mushaf scroll: onPanResponderTerminationRequest is now false — with the
 *      default true, a parent ScrollView (continuous-mode mushaf) can steal a claimed edge
 *      swipe mid-gesture, onPanResponderRelease never fires, and the toggle is silently
 *      dropped. Non-edge gestures are still never claimed (mushaf scroll and drawing
 *      gestures are untouched: onStartShouldSetPanResponder stays false, the claim still
 *      requires start-in-edge-zone + vertical-only > 40px with dy > 1.5x dx).
 *   4. No leaks: PanResponder.create attaches no global listeners, so there is nothing to
 *      clean up; the responder and the callback ref are created once.
 */
import { useRef, useEffect } from 'react';
import { PanResponder, useWindowDimensions } from 'react-native';

// EDGE = 80: edge-zone in px — a swipe must start within 80px of the top/bottom screen edge to be claimed.
const EDGE = 80;
// MIN_DY = 40: minimum vertical swipe distance; also requires |dy| > 1.5x |dx|.
const MIN_DY = 40;

// DEAD HOOK — see file header. Creates the PanResponder once (callback kept in a ref):
// claims the responder only for near-edge vertical swipes, then shows the header (top-edge swipe down / bottom-edge swipe up) or hides it (opposite directions).
export const useHeaderSwipe = (setHeaderVisible: (v: boolean) => void) => {
  const cb = useRef(setHeaderVisible);
  cb.current = setHeaderVisible;

  // Live window height in a ref: the responder closure is created once, so reading a
  // hook value directly would freeze the first render's height; the ref is always current.
  const { height } = useWindowDimensions();
  const HRef = useRef(height);
  useEffect(() => { HRef.current = height; }, [height]);

  // Single source of truth for the edge zone — shared by claim and release so the
  // boundaries can never diverge (zone = [0, EDGE) top, [H - EDGE, H) bottom).
  const inEdgeZone = (y0: number) => y0 < EDGE || y0 >= HRef.current - EDGE;
  const isVerticalSwipe = (gs: any) => Math.abs(gs.dy) > MIN_DY && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gs) => inEdgeZone(gs.y0) && isVerticalSwipe(gs),
      // Once claimed, do not surrender to a parent ScrollView mid-swipe — with the
      // default true, onPanResponderTerminate replaces release and the toggle is dropped.
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_evt, gs) => {
        if (!inEdgeZone(gs.y0)) return;
        if (gs.y0 < EDGE) {
          if (gs.dy > 0) cb.current(true);
          else if (gs.dy < 0) cb.current(false);
        } else {
          if (gs.dy < 0) cb.current(true);
          else if (gs.dy > 0) cb.current(false);
        }
      },
    }),
  ).current;

  // No cleanup required: PanResponder.create attaches no global listeners.
  return panResponder.panHandlers;
};
