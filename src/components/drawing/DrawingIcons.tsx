import React from 'react';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';

const S = 24;
const C = '#fff';
const W = 1.5;

export const PenIcon = ({ size = 24, color = C }: any) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Line x1="5" y1="19" x2="17" y2="7" stroke={color} strokeWidth={W} strokeLinecap="round" />
    <Circle cx="18" cy="6" r="1.5" fill={color} />
  </Svg>
);

export const LaserIcon = ({ size = 24, color = C }: any) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="4" stroke={color} strokeWidth={W} />
    <Circle cx="12" cy="12" r="1.5" fill={color} />
    <Line x1="12" y1="3" x2="12" y2="7" stroke={color} strokeWidth="1" strokeLinecap="round" />
    <Line x1="12" y1="17" x2="12" y2="21" stroke={color} strokeWidth="1" strokeLinecap="round" />
    <Line x1="3" y1="12" x2="7" y2="12" stroke={color} strokeWidth="1" strokeLinecap="round" />
    <Line x1="17" y1="12" x2="21" y2="12" stroke={color} strokeWidth="1" strokeLinecap="round" />
  </Svg>
);

export const UnderlineIcon = ({ size = 24, color = C }: any) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Line x1="7" y1="5" x2="7" y2="13" stroke={color} strokeWidth={W} strokeLinecap="round" />
    <Line x1="17" y1="5" x2="17" y2="13" stroke={color} strokeWidth={W} strokeLinecap="round" />
    <Line x1="7" y1="13" x2="17" y2="13" stroke={color} strokeWidth={W} strokeLinecap="round" />
    <Line x1="4" y1="19" x2="20" y2="19" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

export const UndoIcon = ({ size = 24, color = C }: any) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M7 9L4 12L7 15" stroke={color} strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M4 12H16C18.2 12 20 13.8 20 16C20 18.2 18.2 20 16 20" stroke={color} strokeWidth={W} strokeLinecap="round" />
  </Svg>
);

export const TrashIcon = ({ size = 24, color = C }: any) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="5" y="8" width="14" height="13" rx="1" stroke={color} strokeWidth={W} />
    <Line x1="3" y1="6" x2="21" y2="6" stroke={color} strokeWidth={W} strokeLinecap="round" />
    <Line x1="9" y1="3" x2="15" y2="3" stroke={color} strokeWidth={W} strokeLinecap="round" />
    <Line x1="10" y1="11" x2="10" y2="17" stroke={color} strokeWidth="1" strokeLinecap="round" />
    <Line x1="14" y1="11" x2="14" y2="17" stroke={color} strokeWidth="1" strokeLinecap="round" />
  </Svg>
);

export const CollapseIcon = ({ size = 24, color = '#aaa' }: any) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M8 10L12 14L16 10" stroke={color} strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const CirclePenIcon = ({ size = 44 }: any) => (
  <Svg width={size} height={size} viewBox="0 0 44 44" fill="none">
    <Circle cx="22" cy="22" r="20" stroke="#fff" strokeWidth="1.5" fill="rgba(0,0,0,0.45)" />
    <Line x1="14" y1="30" x2="28" y2="16" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    <Circle cx="29" cy="15" r="2" fill="#fff" />
  </Svg>
);