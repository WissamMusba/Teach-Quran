/**
 * FILE: src/components/quran/OrnamentalFrame.tsx
 * ROLE: Decorative mushaf border — the classic Quranic blue frame: an outer thin rule, a
 *       repeating geometric pattern band (square tile with an X → interlocking braid), and
 *       four elaborate corner nodes (nested diamonds/knots) covering the band joints.
 *       Colors follow the classic mushaf palette: Quranic blue #1C3D72 lines on white,
 *       band background #F8F9FA (night mode swaps in a lighter steel blue + dark band/corner
 *       fills so the frame stays readable on dark pages).
 * DEPENDS ON: react-native-svg (Svg/Defs/Pattern/Rect/Line/Polygon/G/Use); color/bg/nightMode props
 * USED BY: src/components/quran/MushafPageView.tsx (inside overlayLayer — rendered on EVERY page,
 *          both normal and fallback paths)
 *
 * GEOMETRY (parametric, scales from a 1000×1400 design canvas to the measured container):
 *   paddingOuter = W×0.010   (design: 10px offset of the outer thin border)
 *   gapOuter     = W×0.006   (design: 6px white gap between thin border and main frame)
 *   bandWidth    = W×0.040   (design: 40px decorative pattern band)
 *   gapInner     = W×0.004   (design: 4px gap between pattern band and the text box)
 *   tile         = bandWidth/2          → perfect 2× repetition across the band (20px on 40px)
 *   stroke       = max(0.75, W×0.0015)  → 1.5px hairline scaled to the actual page width
 *   Layers outside→inside: outer thin rect (po) → gap (go) → main frame outer rect (po+go) →
 *   pattern band (po+go .. po+go+band) → main frame inner rect (po+go+band) → gap (gi) →
 *   inner text bounding box (po+go+band+gi). The four bands are drawn as separate rects filled
 *   with the repeating pattern (NO continuous band through the corners), then four corner-node
 *   squares are placed exactly over the band intersections. <Use> carries x/y ONLY (no extra
 *   transform — RN-SVG x/y already translate, adding both would double-offset every node).
 *   The text continuation box inset is exposed via frameInsetFor(W) so MushafPageView can pad
 *   the mushaf text container to keep every glyph strictly inside the light text zone.
 *
 * FIT NOTES:
 *  - Container-measured geometry via onLayout, NOT window Dimensions: MushafPageView renders the
 *    frame on half-width pages in split mode and on tablets, so window-size math would
 *    overflow/clip.
 *  - viewBox == measured pixel size → 1:1 mapping, strokes never distort.
 *  - The pattern's origin follows the SVG user space (0,0) — the tile grid is continuous, so
 *    band placement never shows seams.
 */
import React, { memo, useEffect, useRef, useState } from 'react';
import { Dimensions, View, StyleSheet } from 'react-native';
import Svg, { Defs, Pattern, Rect, Line, Polygon, G, Use } from 'react-native-svg';
import { getFrameBox, saveFrameBox } from '../../database/localDB';

interface OrnamentalFrameProps {
  color: string;        // kept for call-site compat; palette below wins
  bg?: string;
  nightMode?: boolean;  // night swaps blue for a lighter steel blue and dark band/corner fills
}

// Classic Quranic frame palette. Night mode: lighter steel blue so the frame reads on dark
// pages; band/corner fill backgrounds darken to match the page.
const BLUE = '#1C3D72';
const BLUE_NIGHT = '#7BA7DB';
const BAND_BG = '#F8F9FA';
const BAND_BG_NIGHT = '#1E2532';
const CORNER_BG = '#FFFFFF';
const CORNER_BG_NIGHT = '#232A38';

/**
 * WHAT: Exposes the frame's inner text-box inset for a given page width — the distance from
 *       the page edge to the innermost (text continuation) bounding box. MushafPageView uses
 *       this to pad its text container so no glyph ever crosses the frame's inner border.
 * CALLS: none. AFFECTS: none (pure).
 */
export const frameInsetFor = (W: number) => {
  const po = Math.max(2, W * 0.010);
  const go = Math.max(1, W * 0.006);
  const band = Math.max(6, W * 0.040);
  const gi = Math.max(6, W * 0.034);
  return po + go + band + gi;
};

const SETTLE_MS = 150;
let SESSION_BOX: { w: number; h: number } | null = null;   // session-wide instant first paint
const initialBox = (): { w: number; h: number } => {
  if (SESSION_BOX) return SESSION_BOX;
  const { width, height } = Dimensions.get('window');
  return { w: Math.round(width), h: Math.round(height) };
};

const OrnamentalFrame = ({ nightMode = false }: OrnamentalFrameProps) => {
  const blue = nightMode ? BLUE_NIGHT : BLUE;
  const bandBg = nightMode ? BAND_BG_NIGHT : BAND_BG;
  const cornerBg = nightMode ? CORNER_BG_NIGHT : CORNER_BG;

  const [box, setBox] = useState<{ w: number; h: number }>(initialBox);
  const boxRef = useRef(box);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheKey = `frame_${Math.round(Dimensions.get('window').width)}`;
  const W = box.w;
  const H = box.h;

  // Cold start: adopt the persisted per-device box once (best-effort).
  useEffect(() => {
    let mounted = true;
    getFrameBox(cacheKey).then((c) => {
      if (!mounted || !c) return;
      if (c.w !== boxRef.current.w || c.h !== boxRef.current.h) { boxRef.current = c; setBox(c); }
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);
  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current); }, []);

  // --- parametric geometry (scaled from the 1000×1400 design canvas) -------------------------
  const po = Math.max(2, W * 0.010);        // layer 1: outer thin border offset
  const go = Math.max(1, W * 0.006);        // layer 2: first white gap
  const band = Math.max(6, W * 0.040);      // layer 4: decorative band width
  const gi = Math.max(6, W * 0.034);        // layer 6: second gap
  const sw = Math.max(0.75, W * 0.0015);    // stroke width (1.5px on the design canvas)
  const tile = Math.max(3, band / 2);       // pattern tile = half the band → 2× vertical repetition
  const inner = po + go + band + gi;        // layer 7: inner text box inset

  const x0 = po + go;                       // main frame outer edge
  const x1 = po + go + band;                // main frame inner edge
  const mainW = Math.max(0, W - 2 * x0);    // main frame outer rect size
  const innerW = Math.max(0, W - 2 * x1);   // main frame inner rect size
  const txtW = Math.max(0, W - 2 * inner);  // inner text bounding box size

  const onLayout = (e: any) => {
    const w = Math.round(e.nativeEvent.layout.width);
    const h = Math.round(e.nativeEvent.layout.height);
    if (w <= 0 || h <= 0) return;
    if (w === boxRef.current.w && h === boxRef.current.h) return;      // no-op frames
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null;
      const next = { w, h };
      boxRef.current = next;
      SESSION_BOX = next;
      setBox(next);                                                     // ONE re-render, after layout settles
      saveFrameBox(cacheKey, w, h).catch(() => {});
    }, SETTLE_MS);
  };

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={onLayout}
    >
      {W > 0 && H > 0 && (
        <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <Defs>
          {/* Repeating geometric tile: a square box with an X inside. Tiling it horizontally and
              vertically creates the interlocking braided look of classic mushaf frames. */}
          <Pattern id="framePattern" width={tile} height={tile} patternUnits="userSpaceOnUse">
            <Rect x={0} y={0} width={tile} height={tile} fill={bandBg} stroke={blue} strokeWidth={sw} />
            <Line x1={0} y1={0} x2={tile} y2={tile} stroke={blue} strokeWidth={sw} />
            <Line x1={tile} y1={0} x2={0} y2={tile} stroke={blue} strokeWidth={sw} />
          </Pattern>

          {/* Modular corner node (bandWidth × bandWidth): solid base covering the pattern joints,
              then three nested diamonds — the elaborate knot finish. Local coords 0..band. */}
          <G id="cornerNode">
            <Rect x={0} y={0} width={band} height={band} fill={cornerBg} stroke={blue} strokeWidth={sw} />
            <Polygon points={`${band / 2},0 ${band},${band / 2} ${band / 2},${band} 0,${band / 2}`}
              fill="none" stroke={blue} strokeWidth={sw} />
            <Polygon points={`${band / 2},${band * 0.175} ${band * 0.825},${band / 2} ${band / 2},${band * 0.825} ${band * 0.175},${band / 2}`}
              fill="none" stroke={blue} strokeWidth={sw} />
            <Polygon points={`${band / 2},${band * 0.3} ${band * 0.7},${band / 2} ${band / 2},${band * 0.7} ${band * 0.3},${band / 2}`}
              fill="none" stroke={blue} strokeWidth={sw} />
          </G>
        </Defs>

        {/* Layer 1: outer thin border */}
        <Rect x={po} y={po} width={W - 2 * po} height={H - 2 * po}
          fill="none" stroke={blue} strokeWidth={sw} />

        {/* Layer 3: main frame outer border (defines the pattern band's outer edge) */}
        <Rect x={x0} y={x0} width={mainW} height={H - 2 * x0}
          fill="none" stroke={blue} strokeWidth={sw} />

        {/* Layer 5: main frame inner border (closes the pattern band) */}
        <Rect x={x1} y={x1} width={innerW} height={H - 2 * x1}
          fill="none" stroke={blue} strokeWidth={sw} />

        {/* Layer 4: the four pattern bands (separate rects so corners stay clean) */}
        <Rect x={x0} y={x0} width={mainW} height={band} fill="url(#framePattern)" />
        <Rect x={x0} y={H - x0 - band} width={mainW} height={band} fill="url(#framePattern)" />
        <Rect x={x0} y={x1} width={band} height={Math.max(0, H - 2 * x1)} fill="url(#framePattern)" />
        <Rect x={W - x0 - band} y={x1} width={band} height={Math.max(0, H - 2 * x1)} fill="url(#framePattern)" />

        {/* Layer 7: inner text area bounding box — the mushaf text lives strictly inside */}
        <Rect x={inner} y={inner} width={txtW} height={H - 2 * inner}
          fill="none" stroke={blue} strokeWidth={sw} />

        {/* The four corner nodes — placed exactly over the band intersections */}
        <Use href="#cornerNode" x={x0} y={x0} />
        <Use href="#cornerNode" x={W - x0 - band} y={x0} />
        <Use href="#cornerNode" x={x0} y={H - x0 - band} />
        <Use href="#cornerNode" x={W - x0 - band} y={H - x0 - band} />
      </Svg>
      )}
    </View>
  );
};

export default memo(OrnamentalFrame);