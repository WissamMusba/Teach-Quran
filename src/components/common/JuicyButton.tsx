/**
 * FILE: src/components/common/JuicyButton.tsx
 * ROLE: A lightweight Pressable wrapper providing subtle tactile micro-scale animation
 *       and light haptic feedback on touch for maximum responsiveness and "juice".
 */
import React, { useRef, useCallback } from 'react';
import {
  Pressable,
  Animated,
  StyleProp,
  ViewStyle,
  GestureResponderEvent,
  PressableProps,
} from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { triggerAppHaptic } from '../../utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const DEFAULT_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

export interface JuicyButtonProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  activeOpacity?: number;
  scaleTo?: number;
  hapticFeedback?: boolean;
  hapticTrigger?: 'pressIn' | 'press';
  delayPressIn?: number;
  children?: React.ReactNode;
}

const JuicyButton: React.FC<JuicyButtonProps> = ({
  children,
  style,
  onPress,
  onPressIn,
  onPressOut,
  disabled,
  activeOpacity,
  scaleTo = 0.96,
  hapticFeedback = true,
  hapticTrigger = 'pressIn',
  delayPressIn = 0,
  hitSlop = DEFAULT_HIT_SLOP,
  ...rest
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const triggerHaptic = useCallback(() => {
    if (!hapticFeedback) return;
    triggerAppHaptic('impactLight');
  }, [hapticFeedback]);

  const handlePressIn = useCallback(
    (e: GestureResponderEvent) => {
      Animated.spring(scale, {
        toValue: scaleTo,
        speed: 50,
        bounciness: 0,
        useNativeDriver: true,
      }).start();
      if (hapticTrigger === 'pressIn') {
        triggerHaptic();
      }
      onPressIn?.(e);
    },
    [scale, scaleTo, hapticTrigger, triggerHaptic, onPressIn],
  );

  const handlePressOut = useCallback(
    (e: GestureResponderEvent) => {
      Animated.spring(scale, {
        toValue: 1.0,
        speed: 40,
        bounciness: 3,
        useNativeDriver: true,
      }).start();
      onPressOut?.(e);
    },
    [scale, onPressOut],
  );

  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      if (disabled) return;
      if (hapticTrigger === 'press') {
        triggerHaptic();
      }
      onPress?.(e);
    },
    [disabled, hapticTrigger, triggerHaptic, onPress],
  );

  const animatedStyle = {
    transform: [{ scale }],
    ...(activeOpacity !== undefined
      ? {
          opacity: scale.interpolate({
            inputRange: [scaleTo, 1],
            outputRange: [activeOpacity, 1],
            extrapolate: 'clamp' as const,
          }),
        }
      : {}),
  };

  return (
    <AnimatedPressable
      {...rest}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      unstable_pressDelay={delayPressIn}
      hitSlop={hitSlop}
      style={[style, animatedStyle as any]}
    >
      {children}
    </AnimatedPressable>
  );
};

export default React.memo(JuicyButton);
