/**
 * FILE: src/components/quran/OrnamentalFrame.tsx
 * ROLE: Decorative mushaf border — three nested rounded rectangles plus four SVG corner scrolls and top/bottom diamond ornaments.
 * DEPENDS ON: react-native-svg (Svg/Path/Circle); color/bg/nightMode props
 * USED BY: src/components/quran/MushafPageView.tsx:377 (inside overlayLayer — rendered on EVERY page, both normal and fallback paths)
 */
import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

interface OrnamentalFrameProps {
  color: string;
  bg?: string;
  nightMode?: boolean;
}

/**
 * OrnamentalFrame — absolute-fill decorative frame. NOTE: only `color` is destructured/used — `bg` and `nightMode` are
 * accepted but ignored (declared in the props interface above): dead surface area, but MUST stay in the interface —
 * MushafPageView.tsx:377 passes all three; dropping them would be a TS excess-prop error.
 * FLOW: 1) Absolute-fill wrapper with pointerEvents="none" (whole subtree excluded from hit-testing — taps pass through
 *        to the mushaf words below). 2) Three nested border Views (borderWidth 1.5/0.8/0.5, borderRadius 20/16/12,
 *        offsets 5/12/18). 3) Four corner SVGs (arc + diamond paths + two dots each, fixed 44x44 viewBox).
 *        4) Top/bottom center SVGs (diamond + side lines, 36x24 viewBox).
 * CALLS: none — pure presentational.
 * CALLED BY: MushafPageView.tsx:377 (overlay layer of every page).
 * AFFECTS: visuals only.
 * NOTES: Memoized but re-renders anyway since `color` changes with nightMode/brightness; SVG paths are hand-drawn and
 *        absolutely positioned — fragile to redesign but cheap. No crashes on weird sizes: RN clamps negative
 *        inner-view dimensions (top/bottom 18 on tiny containers) to zero, and viewBoxes are fixed.
 */
const OrnamentalFrame = ({ color }: OrnamentalFrameProps) => {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Nested rounded-rect border: outer / mid / inner (offsets 5 / 12 / 18) */}
      <View style={[styles.frameOuter, { borderColor: color }]} />
      <View style={[styles.frameMid, { borderColor: color }]} />
      <View style={[styles.frameInner, { borderColor: color }]} />

      {/* Four corner scrolls: arc + diamond + two dots each (fixed 44x44 viewBox) */}
      <Svg style={styles.cornerTL} viewBox="0 0 44 44">
        <Path d="M 25 5 A 20 20 0 0 1 5 25 M 20 5 A 15 15 0 0 1 5 20" fill="none" stroke={color} strokeWidth={1} />
        <Path d="M 28.5 5 L 25 8.5 L 21.5 5 L 25 1.5 Z" fill="none" stroke={color} strokeWidth={1} />
        <Path d="M 5 28.5 L 8.5 25 L 5 21.5 L 1.5 25 Z" fill="none" stroke={color} strokeWidth={1} />
        <Circle cx={18} cy={12.5} r={1.2} fill={color} />
        <Circle cx={12.5} cy={18} r={1.2} fill={color} />
      </Svg>

      <Svg style={styles.cornerTR} viewBox="0 0 44 44">
        <Path d="M 19 5 A 20 20 0 0 0 39 25 M 24 5 A 15 15 0 0 0 39 20" fill="none" stroke={color} strokeWidth={1} />
        <Path d="M 15.5 5 L 19 8.5 L 22.5 5 L 19 1.5 Z" fill="none" stroke={color} strokeWidth={1} />
        <Path d="M 39 28.5 L 42.5 25 L 39 21.5 L 35.5 25 Z" fill="none" stroke={color} strokeWidth={1} />
        <Circle cx={26} cy={12.5} r={1.2} fill={color} />
        <Circle cx={31.5} cy={18} r={1.2} fill={color} />
      </Svg>

      <Svg style={styles.cornerBL} viewBox="0 0 44 44">
        <Path d="M 25 39 A 20 20 0 0 0 5 19 M 20 39 A 15 15 0 0 0 5 24" fill="none" stroke={color} strokeWidth={1} />
        <Path d="M 28.5 39 L 25 42.5 L 21.5 39 L 25 35.5 Z" fill="none" stroke={color} strokeWidth={1} />
        <Path d="M 5 35.5 L 8.5 39 L 5 42.5 L 1.5 39 Z" fill="none" stroke={color} strokeWidth={1} />
        <Circle cx={18} cy={31.5} r={1.2} fill={color} />
        <Circle cx={12.5} cy={26} r={1.2} fill={color} />
      </Svg>

      <Svg style={styles.cornerBR} viewBox="0 0 44 44">
        <Path d="M 19 39 A 20 20 0 0 1 39 19 M 24 39 A 15 15 0 0 1 39 24" fill="none" stroke={color} strokeWidth={1} />
        <Path d="M 15.5 39 L 19 42.5 L 22.5 39 L 19 35.5 Z" fill="none" stroke={color} strokeWidth={1} />
        <Path d="M 39 35.5 L 42.5 39 L 39 42.5 L 35.5 39 Z" fill="none" stroke={color} strokeWidth={1} />
        <Circle cx={26} cy={31.5} r={1.2} fill={color} />
        <Circle cx={31.5} cy={26} r={1.2} fill={color} />
      </Svg>

      {/* Top/bottom center ornaments: diamond + side lines (36x24 viewBox) */}
      <Svg style={styles.medTop} viewBox="0 0 36 24">
        <Path d="M 18 2 L 22 4.5 L 18 7 L 14 4.5 Z" fill="none" stroke={color} strokeWidth={1} />
        <Path d="M 2 4.5 H 12 M 24 4.5 H 34" fill="none" stroke={color} strokeWidth={1} />
        <Circle cx={18} cy={4.5} r={1.2} fill={color} />
      </Svg>

      <Svg style={styles.medBottom} viewBox="0 0 36 24">
        <Path d="M 18 17 L 22 19.5 L 18 22 L 14 19.5 Z" fill="none" stroke={color} strokeWidth={1} />
        <Path d="M 2 19.5 H 12 M 24 19.5 H 34" fill="none" stroke={color} strokeWidth={1} />
        <Circle cx={18} cy={19.5} r={1.2} fill={color} />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  frameOuter: { position: 'absolute', top: 5, bottom: 5, left: 5, right: 5, borderWidth: 1.5, borderRadius: 20 },
  frameMid: { position: 'absolute', top: 12, bottom: 12, left: 12, right: 12, borderWidth: 0.8, borderRadius: 16 },
  frameInner: { position: 'absolute', top: 18, bottom: 18, left: 18, right: 18, borderWidth: 0.5, borderRadius: 12 },
  cornerTL: { position: 'absolute', top: 0, left: 0, width: 44, height: 44 },
  cornerTR: { position: 'absolute', top: 0, right: 0, width: 44, height: 44 },
  cornerBL: { position: 'absolute', bottom: 0, left: 0, width: 44, height: 44 },
  cornerBR: { position: 'absolute', bottom: 0, right: 0, width: 44, height: 44 },
  medTop: { position: 'absolute', top: 8, left: '50%', marginLeft: -18, width: 36, height: 24 },
  medBottom: { position: 'absolute', bottom: 8, left: '50%', marginLeft: -18, width: 36, height: 24 }
});

export default memo(OrnamentalFrame);
