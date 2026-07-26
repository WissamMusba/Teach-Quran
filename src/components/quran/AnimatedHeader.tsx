import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Animated, View, StyleSheet, LayoutChangeEvent } from 'react-native';

const DURATION = 200;

interface AnimatedHeaderProps {
  visible: boolean;
  children: React.ReactNode;
}

const AnimatedHeader: React.FC<AnimatedHeaderProps> = ({ visible, children }) => {
  const [measured, setMeasured] = useState(0);
  const [slotOpen, setSlotOpen] = useState(visible);
  const anim = useRef(new Animated.Value(visible ? 1 : 0)).current;

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setMeasured(h);
  }, []);

  useEffect(() => {
    anim.stopAnimation();
    if (visible) {
      setSlotOpen(true);
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: DURATION, useNativeDriver: true }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: DURATION, useNativeDriver: true })
        .start(({ finished }) => { if (finished) setSlotOpen(false); });
    }
  }, [visible, anim]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-measured, 0],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={[styles.slot, { height: slotOpen ? undefined : 0 }]}
      pointerEvents={slotOpen ? 'auto' : 'none'}
    >
      <Animated.View onLayout={onLayout} style={{ transform: [{ translateY }] }}>
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  slot: { overflow: 'hidden' },
});

export default AnimatedHeader;
