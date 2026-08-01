import React, { useCallback, useRef } from 'react';
import { Pressable, View, type PressableProps, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';

interface WordHitAreaProps extends Omit<PressableProps, 'onPress'> {
  tapFraction?: number;
  onWordPress?: () => void;
  onDeadTap?: () => void;
  onMeasured?: (width: number) => void;
}

const WordHitArea = ({ tapFraction = 0.5, onWordPress, onDeadTap, onLongPress, onMeasured, style, children, ...rest }: WordHitAreaProps) => {
  const ref = useRef<View | null>(null);
  const widthRef = useRef(0);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
    onMeasured?.(e.nativeEvent.layout.width);
  }, [onMeasured]);

  const handlePress = useCallback((e: GestureResponderEvent) => {
    const w = widthRef.current;
    if (w <= 0) { onWordPress?.(); return; }
    ref.current?.measureInWindow((x) => {
      const localX = e.nativeEvent.pageX - x;
      const margin = (w * (1 - tapFraction)) / 2;
      if (localX >= margin && localX <= w - margin) onWordPress?.();
      else onDeadTap?.();
    });
  }, [tapFraction, onWordPress, onDeadTap]);

  return (
    <Pressable ref={ref} onLayout={handleLayout} onPress={handlePress} onLongPress={onLongPress} style={style} {...rest}>
      {children}
    </Pressable>
  );
};

export default WordHitArea;
