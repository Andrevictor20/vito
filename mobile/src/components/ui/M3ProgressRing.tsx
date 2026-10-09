import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { tokens } from '../../theme/tokens';

export interface M3ProgressRingProps {
  progress: number; // 0 a 1
  size?: number;
  strokeWidth?: number;
  centerText?: string;
  subtitle?: string;
  color?: string;
  trackColor?: string;
}

export const M3ProgressRing: React.FC<M3ProgressRingProps> = ({
  progress,
  size = 64,
  strokeWidth = 6,
  centerText,
  subtitle,
  color,
  trackColor,
}) => {
  const { colors } = useTheme();

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const strokeDashoffset = circumference - clampedProgress * circumference;

  const activeColor = color || colors.primary;
  const inactiveTrackColor = trackColor || colors.surfaceContainerHighest;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.svg}>
        {/* Track de fundo */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={inactiveTrackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Arco de progresso */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={activeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      {(centerText || subtitle) && (
        <View style={styles.textContainer}>
          {centerText && (
            <Text
              style={[
                styles.centerText,
                {
                  color: colors.onSurface,
                  fontSize: size >= 80 ? tokens.typography.size.titleLarge : tokens.typography.size.labelLarge,
                },
              ]}
            >
              {centerText}
            </Text>
          )}
          {subtitle && (
            <Text
              style={[
                styles.subtitle,
                {
                  color: colors.onSurfaceVariant,
                  fontSize: tokens.typography.size.labelSmall,
                },
              ]}
            >
              {subtitle}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  svg: {
    position: 'absolute',
  },
  textContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontWeight: '500',
    marginTop: -2,
  },
});
