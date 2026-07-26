import { useRef } from 'react';
import { PanResponder, Dimensions } from 'react-native';

const EDGE = 80;
const MIN_DY = 40;

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
