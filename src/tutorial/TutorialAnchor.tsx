/**
 * FILE: src/tutorial/TutorialAnchor.tsx
 * ROLE: Invisible measuring wrapper — registers a child's on-screen rectangle into the
 *       tutorial anchor registry so TutorialOverlay can cut a spotlight hole around it.
 * DEPENDS ON: tutorialRuntime (setTutorialAnchor).
 * USED BY: DashboardScreen (FAB, first card), StudentHubScreen (RESUME row),
 *          AnimatedHeader (SHARE / MISTAKES / NOTES / surah-list buttons).
 * NOTES: Pure passthrough — adds one View + onLayout measure; zero behavior change.
 */
import React, { useRef } from 'react';
import { View } from 'react-native';
import { setTutorialAnchor } from './tutorialRuntime';

export default function TutorialAnchor({ id, children, style }: { id: string; children?: any; style?: any }) {
  const ref = useRef<View | null>(null);
  const measure = () => {
    try {
      ref.current?.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) setTutorialAnchor(id, { x, y, w, h });
      });
    } catch {}
  };
  return (
    <View ref={ref} style={style} onLayout={measure} collapsable={false}>
      {children}
    </View>
  );
}
