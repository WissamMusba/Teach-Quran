/**
 * FILE: src/tutorial/TutorialAnchor.tsx
 * ROLE: Invisible measuring wrapper — registers a child's on-screen rectangle into the
 *       tutorial anchor registry so TutorialOverlay can cut a spotlight hole around it.
 * DEPENDS ON: tutorialRuntime (setTutorialAnchor).
 * USED BY: DashboardScreen (FAB, first card), StudentHubScreen (RESUME row),
 *          AnimatedHeader (SHARE / MISTAKES / NOTES / surah-list buttons).
 * NOTES: Pure passthrough — adds one View + onLayout measure; zero behavior change.
 */
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { setTutorialAnchor, onTutorialMeasureTick } from './tutorialRuntime';

export default function TutorialAnchor({ id, children, style, active = true }: { id: string; children?: any; style?: any; active?: boolean }) {
  const ref = useRef<View | null>(null);
  const measure = () => {
    if (!active) return;
    try {
      ref.current?.measure((_x, _y, w, h, pageX, pageY) => {
        if (w > 0 && h > 0 && Number.isFinite(pageX) && Number.isFinite(pageY)) {
          setTutorialAnchor(id, { x: pageX, y: pageY, w, h });
        } else {
          ref.current?.measureInWindow((x, y, winW, winH) => {
            if (winW > 0 && winH > 0) setTutorialAnchor(id, { x, y, w: winW, h: winH });
          });
        }
      });
    } catch {}
  };
  // While the tutorial runs, re-measure on the shared runtime tick: the page FlatList
  // translates pages without re-firing onLayout, so a swiped-in page's anchor would
  // otherwise keep a stale rect (offscreen results are rejected by the runtime guard).
  // `active` gates registration: the FlatList keeps neighbour pages mounted, so if every
  // mounted page registered the same id their offscreen/mid-layout measures would race the
  // current page's and the spotlight would flash between rects. An inactive anchor still
  // renders its wrapper View (layout preserved) — it just never writes to the registry.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!active) return;
    measure();
    return onTutorialMeasureTick(measure);
  }, [id, active]);
  return (
    <View ref={ref} style={style} onLayout={measure} collapsable={false}>
      {children}
    </View>
  );
}
