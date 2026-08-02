import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export default function StaticDrawingOverlay({ paths }: any) {
  if (!paths || paths.length === 0) return null;

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

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'transparent' },
  svg: { flex: 1, width: '100%', height: '100%', backgroundColor: 'transparent' }
});
