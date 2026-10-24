import React, { useEffect, useRef } from 'react';
import {
  TouchableWithoutFeedback,
  Animated,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export interface VitoSwitchProps {
  value: boolean;
  onValueChange: (val: boolean) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Switch customizado (.sw) de 46x28px idêntico a vito-telas.html.
 * - Desligado: background var(--line), thumb em x=3
 * - Ligado: background var(--ink), thumb em x=21
 * - Thumb: 22x22px círculo branco com leve sombra
 */
export const VitoSwitch: React.FC<VitoSwitchProps> = ({
  value,
  onValueChange,
  disabled = false,
  style,
}) => {
  const { colors } = useTheme();
  const animValue = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: value ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [value]);

  const toggle = () => {
    if (disabled) return;
    onValueChange(!value);
  };

  const backgroundColor = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.line, colors.ink],
  });

  const translateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [3, 21],
  });

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
          {
            backgroundColor,
            opacity: disabled ? 0.4 : 1,
          },
          style,
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              transform: [{ translateX }],
            },
          ]}
        />
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
