/**
 * FILE: src/components/quran/OrnamentalFrame.tsx
 * ROLE: Decorative mushaf border — teal interlace chain (chain-link knotwork) + diamond accents + thin gold edge rules + corner knots.
 *       No filled background band: the chain floats directly on the page. Gold = edge rules/corner brackets; teal = chain/diamonds/inner rule.
 * DEPENDS ON: react-native-svg (Svg/Defs/Path/G/Use/Rect); color/bg/nightMode props
 * USED BY: src/components/quran/MushafPageView.tsx (inside overlayLayer — rendered on EVERY page, both normal and fallback paths)
 *
 * FIT NOTES (fixed vs original draft):
 *  - Container-measured geometry via onLayout, NOT window Dimensions: MushafPageView renders the frame
 *    on half-width pages in split mode and on tablets, so window-size math would overflow/clip.
 *  - <Use> carries transform ONLY (no x/y) — x/y + translate would double-offset every link.
 *  - viewBox == measured pixel size → 1:1 mapping, strokes never distort.
 *  - Inner rule is teal per the palette above (the `color` prop from MushafPageView is a faint gray
 *    frameC and would grey-out the inner rule; kept in the interface for call-site compat).
 */
import React, { memo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, Path, G, Use, Rect } from 'react-native-svg';

interface OrnamentalFrameProps {
  color: string;        // kept for call-site compat; palette below wins
  bg?: string;
  nightMode?: boolean;
}

// Teal chain (#00d4aa) + shiny-gold edges. Night mode deepens the gold so it doesn't glare.
const TEAL = '#00d4aa';
const TEAL_DEEP = '#0a8f73';
const GOLD_EDGE = '#C9A227';       // light: bright gold rule
const GOLD_EDGE_NIGHT = '#8C7320'; // night: muted gold rule

/**
 * One reusable interlace LINK: a pointed-oval (vesica) ring centered at (0,0).
 * Two strokes (dark under-strand + bright teal over-strand) so adjacent links read as woven.
 */
const LinkDef = ({ hw, hh }: { hw: number; hh: number }) => (
  <G id="link">
    <Path d={`M ${-hw} 0 Q 0 ${-hh} ${hw} 0 Q 0 ${hh} ${-hw} 0 Z`}
      fill="none" stroke={TEAL_DEEP} strokeWidth={2.4} strokeLinejoin="round" />
    <Path d={`M ${-hw} 0 Q 0 ${-hh} ${hw} 0 Q 0 ${hh} ${-hw} 0 Z`}
      fill="none" stroke={TEAL} strokeWidth={1.3} strokeLinejoin="round" />
  </G>
);

/** Small teal diamond accent that sits in the gap between two links. */
const DiamondDef = ({ s, edge }: { s: number; edge: string }) => (
  <Path id="diamond" d={`M 0 ${-s} L ${s} 0 L 0 ${s} L ${-s} 0 Z`}
    fill={TEAL} stroke={edge} strokeWidth={0.4} />
);

const OrnamentalFrame = ({ nightMode = false }: OrnamentalFrameProps) => {
  const edge = nightMode ? GOLD_EDGE_NIGHT : GOLD_EDGE;

  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const W = box?.w || 0;
  const H = box?.h || 0;

  // Chain geometry scales gently with the actual page size (phones, tablets AND split mode).
  // The band hugs the page edge (chain band ≈ margin ± hh) so it never covers the text
  // (text starts at hPadFor: 13px on phones, 8% of W on tablets).
  const margin = Math.max(4, Math.round(W * 0.012));    // chain center-line distance from the page edge
  const linkStep = Math.max(18, Math.round(W * 0.045)); // spacing between link centers
  const hw = linkStep * 0.55;                            // link half-width (slight overlap → woven look)
  const hh = linkStep * 0.18;                            // link half-height (thin band: hugs the edge)
  const diaS = Math.max(2, linkStep * 0.1);              // diamond accent half-size
  const edgeInset = Math.max(1.5, margin - hh - 1.5);    // gold edge rule — just outside the chain band
  const innerInset = margin + hh + 2;                    // teal inner rule — just inside the chain band

  const topY = margin;
  const bottomY = H - margin;
  const leftX = margin;
  const rightX = W - margin;

  // Stamp centers along each edge, inset by one step so corners stay clean.
  const hCount = Math.max(2, Math.floor((W - margin * 2) / linkStep));
  const vCount = Math.max(2, Math.floor((H - margin * 2) / linkStep));
  const hPos = Array.from({ length: hCount }, (_, i) => margin + ((W - margin * 2) / (hCount + 1)) * (i + 1));
  const vPos = Array.from({ length: vCount }, (_, i) => margin + ((H - margin * 2) / (vCount + 1)) * (i + 1));

  const place = (cx: number, cy: number) => `translate(${cx},${cy})`;
  const rot90 = (cx: number, cy: number) => `translate(${cx},${cy}) rotate(90)`;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={e => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {box && W > 0 && H > 0 && (
        <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <LinkDef hw={hw} hh={hh} />
          <DiamondDef s={diaS} edge={edge} />
        </Defs>

        {/* ---- Thin gold edge rule (outside the chain) + teal inner rule (inside the chain) ---- */}
        <Rect x={edgeInset} y={edgeInset} width={W - edgeInset * 2} height={H - edgeInset * 2}
          fill="none" stroke={edge} strokeWidth={1.4} />
        <Rect x={innerInset} y={innerInset} width={W - innerInset * 2} height={H - innerInset * 2}
          fill="none" stroke={TEAL} strokeWidth={0.7} opacity={0.75} />

        {/* ---- Horizontal teal interlace chain (top & bottom) ---- */}
        {hPos.map((x, i) => (
          <Use key={`lt${i}`} href="#link" transform={place(x, topY)} />
        ))}
        {hPos.map((x, i) => (
          <Use key={`lb${i}`} href="#link" transform={place(x, bottomY)} />
        ))}
        {/* diamond accents between horizontal links */}
        {hPos.slice(0, -1).map((x, i) => {
          const mx = (x + hPos[i + 1]) / 2;
          return <Use key={`dt${i}`} href="#diamond" transform={place(mx, topY)} />;
        })}
        {hPos.slice(0, -1).map((x, i) => {
          const mx = (x + hPos[i + 1]) / 2;
          return <Use key={`db${i}`} href="#diamond" transform={place(mx, bottomY)} />;
        })}

        {/* ---- Vertical teal interlace chain (left & right) — links rotated 90° ---- */}
        {vPos.map((y, i) => (
          <Use key={`ll${i}`} href="#link" transform={rot90(leftX, y)} />
        ))}
        {vPos.map((y, i) => (
          <Use key={`lr${i}`} href="#link" transform={rot90(rightX, y)} />
        ))}
        {/* diamond accents between vertical links */}
        {vPos.slice(0, -1).map((y, i) => {
          const my = (y + vPos[i + 1]) / 2;
          return <Use key={`dl${i}`} href="#diamond" transform={place(leftX, my)} />;
        })}
        {vPos.slice(0, -1).map((y, i) => {
          const my = (y + vPos[i + 1]) / 2;
          return <Use key={`dr${i}`} href="#diamond" transform={place(rightX, my)} />;
        })}

        {/* ---- Corner knots: a link at 45° tying the two chains together (mirrored: TL/BR face one way, TR/BL the other) ---- */}
        {[[leftX, topY, 45], [rightX, topY, -45], [leftX, bottomY, -45], [rightX, bottomY, 45]].map(([cx, cy, r], i) => (
          <Use key={`ck${i}`} href="#link" transform={`translate(${cx},${cy}) rotate(${r})`} />
        ))}
      </Svg>
      )}
    </View>
  );
};

export default memo(OrnamentalFrame);
