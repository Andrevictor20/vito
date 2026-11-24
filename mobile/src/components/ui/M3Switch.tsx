import React, { useEffect } from 'react';
import {
  TouchableWithoutFeedback,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { ProtoUiIcon } from '../../icons/ProtoUiIcons';
import { useTheme } from '../../context/ThemeContext';

export interface M3SwitchProps {
  value: boolean;
  onValueChange: (val: boolean) => void;
  disabled?: boolean;
  style?: ViewStyle;
}

/** Switch M3 na UI thread (Reanimated 4, spring com mass: 1). */
export const M3Switch: React.FC<M3SwitchProps> = ({
  value,
  onValueChange,
  disabled = false,
  style,
}) => {
  const { colors, isDark } = useTheme();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, {
      damping: 18,
      stiffness: 260,
      mass: 1,
    });
  }, [value, progress]);

  const toggle = () => {
    if (disabled) return;
    onValueChange(!value);
  };

  const trackOff = colors.surfaceContainerHighest;
  const trackOn = isDark ? '#FFFFFF' : '#18181B';
  const outlineCol = colors.outline;
  const thumbOn = isDark ? '#09090B' : '#FFFFFF';

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [trackOff, trackOn]),
    borderColor: interpolateColor(progress.value, [0, 1], [outlineCol, 'rgba(0,0,0,0)']),
  }), [trackOff, trackOn, outlineCol]);

  const thumbStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 1], [16 / 24, 1], Extrapolation.CLAMP);
    const tx = interpolate(progress.value, [0, 1], [2, 22], Extrapolation.CLAMP);
    return {
      backgroundColor: interpolateColor(progress.value, [0, 1], [outlineCol, thumbOn]),
      transform: [{ translateX: tx }, { scale }],
    };
  }, [outlineCol, thumbOn]);

  return (
    <TouchableWithoutFeedback
      onPress={toggle}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <Animated.View
        style={[
          styles.track,
          { opacity: disabled ? 0.38 : 1 },
          trackStyle,
          style,
        ]}
      >
        <Animated.View style={[styles.thumb, thumbStyle]}>
          {value && (
            <ProtoUiIcon
              name="check"
              size={12}
              color={isDark ? '#09090B' : '#18181B'}
            />
          )}
        </Animated.View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  track: {
    width: 52,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
