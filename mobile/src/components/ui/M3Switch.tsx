import React, { useEffect, useRef } from 'react';
import {
  TouchableWithoutFeedback,
  Animated,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

export interface M3SwitchProps {
  value: boolean;
  onValueChange: (val: boolean) => void;
  disabled?: boolean;
  style?: ViewStyle;
}

export const M3Switch: React.FC<M3SwitchProps> = ({
  value,
  onValueChange,
  disabled = false,
  style,
}) => {
  const { colors, isDark } = useTheme();
  const animValue = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(animValue, {
      toValue: value ? 1 : 0,
      useNativeDriver: false,
      bounciness: 4,
      speed: 18,
    }).start();
  }, [value]);

  const toggle = () => {
    if (disabled) return;
    onValueChange(!value);
  };

  // M3 Canonical Switch Specs:
  // Track: 52dp x 32dp (radius 16dp)
  // Inactive thumb: 16dp diameter, centered at left (margin 8dp)
  // Active thumb: 24dp diameter, shifted to right
  const trackColor = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [
      colors.surfaceContainerHighest,
      isDark ? '#FFFFFF' : '#18181B',
    ],
  });

  const borderColor = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.outline, 'transparent'],
  });

  const thumbColor = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [
      colors.outline,
      isDark ? '#09090B' : '#FFFFFF',
    ],
  });

  const thumbSize = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 24],
  });

  const thumbTranslateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 24],
  });

  return (
    <TouchableWithoutFeedback onPress={toggle} disabled={disabled} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      <Animated.View
        style={[
          styles.track,
          {
            backgroundColor: trackColor,
            borderColor: borderColor,
            opacity: disabled ? 0.38 : 1,
          },
          style,
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              backgroundColor: thumbColor,
              width: thumbSize,
              height: thumbSize,
              borderRadius: 12,
              transform: [{ translateX: thumbTranslateX }],
            },
          ]}
        >
          {value && (
            <MaterialIcons
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
    alignItems: 'center',
    justifyContent: 'center',
  },
});
