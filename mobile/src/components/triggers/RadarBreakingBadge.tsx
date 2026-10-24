import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Animated } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface RadarBreakingBadgeProps {
  label?: string;
}

export const RadarBreakingBadge: React.FC<RadarBreakingBadgeProps> = ({
  label = 'BREAKING',
}) => {
  const { colors } = useTheme();
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const redColor = colors.red || '#d6355a';
  const redBg = colors.redBg || 'rgba(214, 53, 90, 0.12)';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: redBg,
          borderColor: redColor,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Alerta urgente: ${label}`}
    >
      <Animated.View
        style={[
          styles.dot,
          {
            backgroundColor: redColor,
            opacity: pulseAnim,
          },
        ]}
      />
      <Text style={[styles.text, { color: redColor }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4.5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
