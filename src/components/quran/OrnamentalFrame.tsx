/**
 * FILE: src/components/quran/OrnamentalFrame.tsx
 * ROLE: Decorative mushaf border with dynamic themes (Classic Royal Navy, Madinah Emerald, OLED Obsidian).
 */
import React, { memo, useEffect, useRef, useState } from 'react';
import { Dimensions, View, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import Svg, { Defs, Pattern, Rect, Line, Polygon, G, Use } from 'react-native-svg';
import { getFrameBox, saveFrameBox } from '../../database/localDB';

interface OrnamentalFrameProps {
  color?: string;
  bg?: string;
  nightMode?: boolean;
}

const frameBandFor = (W: number) => Math.max(4, W * 0.027);
const frameBandVFor = (W: number) => Math.max(5, W * 0.036);

export const frameInsetFor = (W: number) => {
  const po = Math.max(2, W * 0.010);
  const go = Math.max(1, W * 0.006);
  const band = frameBandFor(W);
  const gi = Math.max(1.5, W * 0.002);
  return po + go + band + gi;
};

export const frameInsetVFor = (W: number) => {
  const po = Math.max(2, W * 0.010);
  const go = Math.max(1, W * 0.006);
  const bandV = frameBandVFor(W);
  const gi = Math.max(1.5, W * 0.002);
  return po + go + bandV + gi;
};

const SETTLE_MS = 150;
let SESSION_BOX: { w: number; h: number } | null = null;
const initialBox = (): { w: number; h: number } => {
  if (SESSION_BOX) return SESSION_BOX;
  const { width, height } = Dimensions.get('window');
  return { w: Math.round(width), h: Math.round(height) };
};

const OrnamentalFrame = ({ nightMode = false }: OrnamentalFrameProps) => {
  const colorTheme = useSelector((s: any) => s.settings?.colorTheme || 'classic');

  let strokeColor = nightMode ? '#7BA7DB' : '#1C3D72';
  let bandBg = nightMode ? '#1E2532' : '#F5F2E9';
  let cornerBg = nightMode ? '#232A38' : '#FAF7EE';

  if (colorTheme === 'emerald') {
    strokeColor = nightMode ? '#52B788' : '#0F4C3A';
    bandBg = nightMode ? '#142821' : '#EAF2EC';
    cornerBg = nightMode ? '#183027' : '#F5F8F5';
  } else if (colorTheme === 'obsidian') {
    strokeColor = nightMode ? '#8FA4C4' : '#20242D';
    bandBg = nightMode ? '#111114' : '#E8E4DC';
    cornerBg = nightMode ? '#17181F' : '#F2EFE9';
  }

  const [box, setBox] = useState<{ w: number; h: number }>(initialBox);
  const boxRef = useRef(box);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheKeyFor = (w: number) => `frame_v2_${w}`;
  const W = box.w;
  const H = box.h;

  useEffect(() => {
    let mounted = true;
    getFrameBox(cacheKeyFor(initialBox().w)).then((c) => {
      if (!mounted || !c) return;
      if (c.w !== boxRef.current.w || c.h !== boxRef.current.h) { boxRef.current = c; setBox(c); }
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);
  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current); }, []);

  const winW = Dimensions.get('window').width;
  const geoRef = winW >= 600 ? Math.min(W, 430) : W;
  const po = Math.max(2, geoRef * 0.010);
  const band = frameBandFor(geoRef);
  const bandV = frameBandVFor(geoRef);
  const sw = Math.max(0.75, geoRef * 0.0015);
  const outSw = Math.max(1.5, geoRef * 0.0035);
  const tile = Math.max(3, band / 2);
  const vScale = bandV / band;

  const x0 = 0;
  const x1 = band;
  const mainW = Math.max(0, W - 2 * x0);
  const innerW = Math.max(0, W - 2 * x1);

  const onLayout = (e: any) => {
    const w = Math.round(e.nativeEvent.layout.width);
    const h = Math.round(e.nativeEvent.layout.height);
    if (w <= 0 || h <= 0) return;
    if (w === boxRef.current.w && h === boxRef.current.h) return;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null;
      const next = { w, h };
      boxRef.current = next;
      SESSION_BOX = next;
      setBox(next);
      saveFrameBox(cacheKeyFor(w), w, h).catch(() => {});
    }, SETTLE_MS);
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      {W > 0 && H > 0 && (
        <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <Defs>
            <Pattern id="framePattern" width={tile} height={tile} patternUnits="userSpaceOnUse">
              <Rect x={0} y={0} width={tile} height={tile} fill={bandBg} stroke={strokeColor} strokeWidth={sw} />
              <Line x1={0} y1={0} x2={tile} y2={tile} stroke={strokeColor} strokeWidth={sw} />
              <Line x1={tile} y1={0} x2={0} y2={tile} stroke={strokeColor} strokeWidth={sw} />
            </Pattern>

            <G id="cornerNode">
              <Rect x={0} y={0} width={band} height={band} fill={cornerBg} stroke={strokeColor} strokeWidth={sw} />
              <Polygon points={`${band / 2},0 ${band},${band / 2} ${band / 2},${band} 0,${band / 2}`} fill="none" stroke={strokeColor} strokeWidth={sw} />
              <Polygon points={`${band / 2},${band * 0.175} ${band * 0.825},${band / 2} ${band / 2},${band * 0.825} ${band * 0.175},${band / 2}`} fill="none" stroke={strokeColor} strokeWidth={sw} />
              <Polygon points={`${band / 2},${band * 0.3} ${band * 0.7},${band / 2} ${band / 2},${band * 0.7} ${band * 0.3},${band / 2}`} fill="none" stroke={strokeColor} strokeWidth={sw} />
            </G>
          </Defs>

          {/* Layer 1: outer thin border */}
          <Rect x={po} y={po} width={W - 2 * po} height={H - 2 * po} fill="none" stroke={strokeColor} strokeWidth={outSw} />

          {/* Layer 3: main frame outer border */}
          <Rect x={x0} y={x0} width={mainW} height={H - 2 * x0} fill="none" stroke={strokeColor} strokeWidth={outSw} />

          {/* Layer 5: main frame inner border */}
          <Rect x={x1} y={bandV} width={innerW} height={Math.max(0, H - 2 * bandV)} fill="none" stroke={strokeColor} strokeWidth={sw} />

          {/* Layer 4: the four pattern bands */}
          <Rect x={x0} y={x0} width={mainW} height={bandV} fill="url(#framePattern)" />
          <Rect x={x0} y={H - x0 - bandV} width={mainW} height={bandV} fill="url(#framePattern)" />
          <Rect x={x0} y={bandV} width={band} height={Math.max(0, H - 2 * bandV)} fill="url(#framePattern)" />
          <Rect x={W - x0 - band} y={bandV} width={band} height={Math.max(0, H - 2 * bandV)} fill="url(#framePattern)" />

          {/* Layer 7: inner text area bounding box */}
          <Rect x={x1} y={bandV} width={innerW} height={Math.max(0, H - 2 * bandV)} fill="none" stroke={strokeColor} strokeWidth={sw} />

          {/* Corner nodes */}
          <G transform={`translate(${x0} ${x0}) scale(1 ${vScale})`}><Use href="#cornerNode" x={0} y={0} /></G>
          <G transform={`translate(${W - x0 - band} ${x0}) scale(1 ${vScale})`}><Use href="#cornerNode" x={0} y={0} /></G>
          <G transform={`translate(${x0} ${H - x0 - bandV}) scale(1 ${vScale})`}><Use href="#cornerNode" x={0} y={0} /></G>
          <G transform={`translate(${W - x0 - band} ${H - x0 - bandV}) scale(1 ${vScale})`}><Use href="#cornerNode" x={0} y={0} /></G>
        </Svg>
      )}
    </View>
  );
};

export default memo(OrnamentalFrame);
