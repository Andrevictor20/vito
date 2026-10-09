import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { tokens, MD3Shapes } from '../../theme/tokens';

export type M3BadgeVariant = 'pill' | 'scalloped' | 'dot';

export interface M3BadgeProps {
  label?: string | number;
  variant?: M3BadgeVariant;
  color?: string;
  textColor?: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

export const M3Badge: React.FC<M3BadgeProps> = ({
  label,
  variant = 'pill',
  color,
  textColor,
  icon,
  size = 'md',
  style,
}) => {
  const { colors, isDark } = useTheme();

  const badgeColor = color || (isDark ? colors.surfaceContainerHighest : colors.primaryContainer);
  const badgeTextColor = textColor || (isDark ? colors.onSurface : colors.onPrimaryContainer);

  if (variant === 'dot') {
    const dotSize = size === 'sm' ? 6 : size === 'lg' ? 10 : 8;
    return (
      <View
        style={[
          styles.dot,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: badgeColor,
          },
          style,
        ]}
      />
    );
  }

  if (variant === 'scalloped') {
    // Estrela/Flor orgânica de 8 lóbulos (Material You Android 12-14 widget badge - Imagem 3)
    const dim = size === 'sm' ? 24 : size === 'lg' ? 40 : 32;
    return (
      <View style={[styles.scallopedContainer, { width: dim, height: dim }, style]}>
        <Svg width={dim} height={dim} viewBox="0 0 100 100">
          <Path
            d="M 50,0 C 60,10 65,15 75,10 C 85,5 95,15 90,25 C 85,35 90,40 100,50 C 90,60 85,65 90,75 C 95,85 85,95 75,90 C 65,85 60,90 50,100 C 40,90 35,85 25,90 C 15,95 5,85 10,75 C 15,65 10,60 0,50 C 10,40 15,35 10,25 C 5,15 15,5 25,10 C 35,15 40,10 50,0 Z"
            fill={badgeColor}
          />
        </Svg>
        <View style={styles.scallopedContent}>
          {icon}
          {label !== undefined && (
            <Text
              style={[
                styles.scallopedText,
                {
                  color: badgeTextColor,
                  fontSize: size === 'sm' ? 10 : size === 'lg' ? 14 : 11,
                },
              ]}
            >
              {label}
            </Text>
          )}
        </View>
      </View>
    );
  }

  // Pílula padrão M3 (Pill)
  const paddingH = size === 'sm' ? 6 : size === 'lg' ? 12 : 8;
  const paddingV = size === 'sm' ? 2 : size === 'lg' ? 6 : 4;
  const fontSize = size === 'sm' ? 11 : size === 'lg' ? 14 : 12;

  return (
    <View
      style={[
        styles.pillContainer,
        {
          backgroundColor: badgeColor,
          paddingHorizontal: paddingH,
          paddingVertical: paddingV,
          borderRadius: MD3Shapes.full,
        },
        style,
      ]}
    >
      {icon && <View style={styles.iconWrapper}>{icon}</View>}
      {label !== undefined && (
        <Text
          style={[
            styles.pillText,
            {
              color: badgeTextColor,
              fontSize,
            },
          ]}
        >
          {label}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  dot: {
    marginHorizontal: 2,
  },
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  pillText: {
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  iconWrapper: {
    marginRight: 2,
  },
  scallopedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  scallopedContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scallopedText: {
    fontWeight: '700',
  },
});
