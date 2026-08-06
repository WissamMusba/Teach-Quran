/**
 * FILE: src/hooks/useHeaderSwipe.ts
 * ROLE: PanResponder that toggles header visibility from vertical swipes near the top/bottom screen edges (edge-zone 80px, min swipe 40px, needs dy > 1.5x dx).
 * DEPENDS ON: a `setHeaderVisible` callback (kept in a ref so the PanResponder is created once).
 * USED BY: NOTHING — DEAD FILE. Never imported anywhere in src/ (grep finds only its own definition).
 * NOTES:
 * - Header toggling actually lives in QuranViewScreen's inline PanGestureHandler + onSwipe (QuranViewScreen.tsx:417-433): vertical swipes in the top half show on swipe-down / hide on swipe-up, inverted in the bottom half; horizontal swipes change surah in non-page modes. That PanGestureHandler is only mounted when readingMode !== 'page'.
 * - Header toggling is ALSO covered in page mode via `toggleHeader` (any dead tap) and two transparent edge-strip Pressables (24px phone / 50px tablet).
 * - Rebuild decision: delete this file; keep the inline PanGestureHandler implementation.
 */
import { useRef } from 'react';
import { PanResponder, Dimensions } from 'react-native';

// EDGE = 80: edge-zone in px — a swipe must start within 80px of the top/bottom screen edge to be claimed.
const EDGE = 80;
// MIN_DY = 40: minimum vertical swipe distance; also requires |dy| > 1.5x |dx|.
const MIN_DY = 40;

// DEAD HOOK — see file header. Creates the PanResponder once (callback kept in a ref):
// claims the responder only for near-edge vertical swipes, then shows the header (top-edge swipe down / bottom-edge swipe up) or hides it (opposite directions).
export const useHeaderSwipe = (setHeaderVisible: (v: boolean) => void) => {
  const cb = useRef(setHeaderVisible);
  cb.current = setHeaderVisible;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gs) => {
        const H = Dimensions.get('window').height;
        const nearEdge = gs.y0 < EDGE || gs.y0 > H - EDGE;
        const vertical = Math.abs(gs.dy) > MIN_DY && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5;
        return nearEdge && vertical;
      },
      onPanResponderRelease: (_evt, gs) => {
        const H = Dimensions.get('window').height;
        const fromTop = gs.y0 < EDGE;
        const fromBottom = gs.y0 > H - EDGE;

        if (fromTop) {
          if (gs.dy > 0) cb.current(true);
          else if (gs.dy < 0) cb.current(false);
        } else if (fromBottom) {
          if (gs.dy < 0) cb.current(true);
          else if (gs.dy > 0) cb.current(false);
        }
      },
    }),
  ).current;

  return panResponder.panHandlers;
};
