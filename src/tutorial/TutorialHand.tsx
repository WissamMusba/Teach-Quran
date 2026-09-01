/**
 * FILE: src/tutorial/TutorialHand.tsx
 * ROLE: The animated pointing hand — a drawn SVG hand cursor with a soft pulsing ring,
 *       looping until the step advances. Pure Animated API + react-native-svg (no new libs).
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

const SIZE = 64;
const TIP = { x: 14, y: 14 };

export default function TutorialHand({ left, top }: { left?: number; top?: number }) {
  const press = useRef(new Animated.Value(0)).current;
  const ripple = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(press, { toValue: 1, duration: 550, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(ripple, { toValue: 1, duration: 550, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.timing(press, { toValue: 0, duration: 450, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(ripple, { toValue: 0, duration: 200, useNativeDriver: false }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [press, ripple]);

  const ringScale = ripple.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1.15] });
  const ringOpacity = ripple.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.55, 0.25, 0] });
  const pressScale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.88] });
  const nudge = press.interpolate({ inputRange: [0, 1], outputRange: [0, 3] });

  return (
    <Animated.View style={[styles.wrap, { left, top, transform: [{ translateX: nudge }, { translateY: nudge }] }]} pointerEvents="none">
      {/* pulsing ring centered on the fingertip */}
      <Animated.View
        style={{
          position: 'absolute', left: TIP.x - 40, top: TIP.y - 40,
          width: 80, height: 80, borderRadius: 40, borderWidth: 2.5, borderColor: '#7BA7DB',
          transform: [{ scale: ringScale }],
          opacity: ringOpacity as any,
        }}
      />
      <Animated.View style={{ transform: [{ scale: pressScale }] }}>
        <Svg width={SIZE} height={SIZE} viewBox="0 0 64 64">
          <Path
            d="M16 16 C14 12 17 8 21 9 C24 10 25 13 25 16 L25 30 C31 28 40 28 45 31 C50 34 51 40 49 45 C47 51 41 55 34 54 C26 53 21 48 20 41 L18 26 Z"
            fill="#FFFFFF"
            stroke="#1C3D72"
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          <Circle cx={21} cy={15} r={3.2} fill="#7BA7DB" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', width: SIZE, height: SIZE },
});
