/**
 * FILE: src/utils/haptics.ts
 * ROLE: Global tactile haptic feedback trigger that respects the user's
 *       disableHaptics preference from Redux settings.
 */
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { Vibration, Platform } from 'react-native';
import { store } from '../store';

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: true,
};

export const triggerAppHaptic = (type: string = 'impactLight'): void => {
  try {
    const state = store.getState();
    const disabled = (state?.settings as any)?.disableHaptics === true;
    if (disabled) return;

    if (Platform.OS === 'android') {
      try {
        Vibration.vibrate(14);
      } catch {}
    }
    try {
      ReactNativeHapticFeedback.trigger(type as any, hapticOptions);
    } catch {}
  } catch {}
};

