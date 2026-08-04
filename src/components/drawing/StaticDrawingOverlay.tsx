/**
 * FILE: src/components/drawing/StaticDrawingOverlay.tsx
 * ROLE: Read-only, pointer-events-none SVG renderer of saved drawing paths — composites drawings INTO the share screenshot without the interactive canvas.
 * DEPENDS ON: paths prop only (array of stroke objects: points/color/width/opacity/style) — pure presentational, no Redux.
 * USED BY: src/screens/QuranViewScreen.tsx:600 — {isCapturing && capturePaths?.length > 0 && (<StaticDrawingOverlay paths={capturePaths} />)} inside the viewShotRef subtree; capturePaths comes from composeSpreadPaths() (:440-443).
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * StaticDrawingOverlay — renders each saved stroke as an SVG Path mirroring DrawingCanvas's visual rules.
 * FLOW: 1) empty paths -> null; 2) map paths -> <Path> with stroke/width/opacity + round caps; 3) style 'double' adds a half-width duplicate translated +3px.
 * CALLED BY: QuranViewScreen.tsx:600 during the handleSharePage capture flow (header hidden, isCapturing=true, 500ms settle, captureRef -> jpg -> Share.open).
 * AFFECTS: share screenshot composition only.
 * NOTES: appears ONLY while isCapturing — the live canvas is hidden then (visible={isDrawing && !isCapturing}); laser strokes never persist, so capturePaths never contains them (implicitly excluded).
 */
export default function StaticDrawingOverlay({ paths }: any) {
  if (!paths || paths.length === 0) return null;

  /**
   * generatePathD — LOCAL copy, duplicated verbatim from DrawingCanvas.tsx:255 (no shared module).
   * NOTES: divergence risk — the wavy zigzag bug and any future path-format change must be fixed in BOTH files.
   */
  const generatePathD = (points: string[], style?: string) => {
    if (!points || points.length === 0) return '';
    if (style === 'wavy') {
      let d = `M ${points[0]}`;
      for (let i = 1; i < points.length; i++) {
        const p = points[i]; const prevP = points[i-1];
        const off = i % 2 === 0 ? 5 : -5; 
        d += ` Q ${prevP.split(',')[0]},${parseInt(prevP.split(',')[1]) + off} ${p}`;
      }
      return d;
    }
    return `M ${points[0]}` + points.slice(1).map(p => ` L ${p}`).join('');
  };

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Svg style={styles.svg}>
        {paths.map((p: any, i: number) => (
          <React.Fragment key={i}>
            <Path d={generatePathD(p.points, p.style)} stroke={p.color} strokeWidth={p.width} strokeOpacity={p.opacity} fill="none" strokeLinecap="round" />
            {p.style === 'double' && <Path d={generatePathD(p.points)} stroke={p.color} strokeWidth={p.width / 2} strokeOpacity={p.opacity} fill="none" strokeLinecap="round" transform="translate(0, 3)" />}
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
}

// Overlay container — absolute fill, pointer-events disabled so the reader UI stays fully interactive beneath it.
const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'transparent' },
  svg: { flex: 1, width: '100%', height: '100%', backgroundColor: 'transparent' }
});
