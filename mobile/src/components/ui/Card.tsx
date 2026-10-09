import React, { useMemo } from 'react';
import { View, StyleSheet, ViewStyle, ViewProps } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { MD3Shapes } from '../../theme/tokens';

export type CardVariant = 'elevated' | 'filled' | 'outlined';

export interface CardProps extends ViewProps {
  variant?: CardVariant;
  radius?: keyof typeof MD3Shapes;
}

export const Card: React.FC<CardProps> = ({
  variant = 'elevated',
  radius = 'largeIncreased',
  style,
  children,
  ...props
}) => {
  const { colors, tokens } = useTheme();

  const styles = useMemo(() => {
    const cornerRadius = MD3Shapes[radius] ?? MD3Shapes.largeIncreased;

    let baseContainer: ViewStyle = {
      borderRadius: cornerRadius,
      padding: tokens.spacing.md,
    };

    switch (variant) {
      case 'elevated':
        baseContainer = {
          ...baseContainer,
          backgroundColor: colors.surfaceContainerLow,
          ...tokens.shadows.level1,
        };
        break;
      case 'filled':
        baseContainer = {
          ...baseContainer,
          backgroundColor: colors.surfaceContainer,
          borderColor: colors.outlineVariant,
          borderWidth: 1,
        };
        break;
      case 'outlined':
        baseContainer = {
          ...baseContainer,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
        };
        break;
    }

    return StyleSheet.create({
      container: baseContainer,
    });
  }, [variant, radius, colors, tokens]);

  return (
    <View style={[styles.container, style]} {...props}>
      {children}
    </View>
  );
};
