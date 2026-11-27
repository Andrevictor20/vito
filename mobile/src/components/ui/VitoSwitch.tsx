import React, { useEffect } from 'react';
import {
  TouchableWithoutFeedback,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';

export interface VitoSwitchProps {
  value: boolean;
  onValueChange: (val: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Switch customizado (.sw) de 46x28px na UI thread (Reanimated 4).
 * - Desligado: background var(--line), thumb em x=3
 * - Ligado: background var(--ink), thumb em x=21
 */
export const VitoSwitch: React.FC<VitoSwitchProps> = ({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
  style,
}) => {
  const { colors } = useTheme();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, {
      duration: 200,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
    });
  }, [value, progress]);

  const offColor = colors.line;
  const onColor = colors.ink;

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [offColor, onColor]),
  }), [offColor, onColor]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [3, 21], Extrapolation.CLAMP) },
    ],
  }));

  const toggle = () => {
    if (disabled) return;
    onValueChange(!value);
  };

  return (
    <TouchableWithoutFeedback
      onPress={toggle}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}
    >
      <Animated.View
        style={[
          styles.track,
          { opacity: disabled ? 0.4 : 1 },
          trackStyle,
          style,
        ]}
      >
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  track: {
    width: 46,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    padding: 0,
  },
  thumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.28,
    shadowRadius: 2.5,
    elevation: 2,
  },
});
