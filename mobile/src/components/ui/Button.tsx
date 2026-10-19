import React, { useMemo } from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TouchableOpacityProps,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export type ButtonVariant = 'filled' | 'elevated' | 'tonal' | 'outlined' | 'text';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  variant = 'filled',
  size = 'md',
  icon,
  isLoading,
  disabled,
  style,
  ...props
}) => {
  const { colors, tokens } = useTheme();

  const styles = useMemo(() => {
    // Height & padding calibration by size
    const heightMap: Record<ButtonSize, number> = {
      sm: 36,
      md: 44, // WCAG AA ergonomic mobile standard
      lg: 50,
    };
    const paddingMap: Record<ButtonSize, number> = {
      sm: tokens.spacing.md,
      md: tokens.spacing.lg,
      lg: tokens.spacing.xl,
    };
    const fontSizeMap: Record<ButtonSize, number> = {
      sm: tokens.typography.size.labelMedium,
      md: tokens.typography.size.labelLarge,
      lg: tokens.typography.size.titleSmall,
    };
    const letterSpacingMap: Record<ButtonSize, number> = {
      sm: 0.2,
      md: 0.1,
      lg: -0.1,
    };

    // Base styles
    const baseContainer: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: heightMap[size],
      paddingHorizontal: paddingMap[size],
      borderRadius: tokens.radii.full, // M3 default for most buttons
      gap: tokens.spacing.sm,
    };

    const baseText: TextStyle = {
      fontFamily: tokens.typography.family.semibold,
      fontSize: fontSizeMap[size],
      lineHeight: fontSizeMap[size] + 6,
      letterSpacing: letterSpacingMap[size],
    };

    let containerStyle: ViewStyle = { ...baseContainer };
    let textStyle: TextStyle = { ...baseText };
    let indicatorColor = colors.onPrimary;

    const isDisabled = disabled || isLoading;

    if (isDisabled) {
      containerStyle.backgroundColor = colors.surfaceContainerHighest;
      containerStyle.borderWidth = 0;
      textStyle.color = colors.textMuted;
      indicatorColor = colors.textMuted;
      
      if (variant === 'outlined') {
        containerStyle.backgroundColor = 'transparent';
        containerStyle.borderColor = colors.surfaceContainerHighest;
        containerStyle.borderWidth = 1;
      }
      if (variant === 'text') {
        containerStyle.backgroundColor = 'transparent';
      }
      return StyleSheet.create({ container: containerStyle, text: textStyle, indicatorColor: { color: indicatorColor } });
    }

    switch (variant) {
      case 'filled':
        containerStyle.backgroundColor = colors.primary;
        textStyle.color = colors.onPrimary;
        indicatorColor = colors.onPrimary;
        break;
      case 'elevated':
        containerStyle.backgroundColor = colors.surfaceContainerLow;
        textStyle.color = colors.primary;
        indicatorColor = colors.primary;
        containerStyle = { ...containerStyle, ...tokens.shadows.level1 };
        break;
      case 'tonal':
        containerStyle.backgroundColor = colors.secondaryContainer;
        textStyle.color = colors.onSecondaryContainer;
        indicatorColor = colors.onSecondaryContainer;
        break;
      case 'outlined':
        containerStyle.backgroundColor = 'transparent';
        containerStyle.borderWidth = 1;
        containerStyle.borderColor = colors.outline;
        textStyle.color = colors.primary;
        indicatorColor = colors.primary;
        break;
      case 'text':
        containerStyle.backgroundColor = 'transparent';
        textStyle.color = colors.primary;
        indicatorColor = colors.primary;
        containerStyle.paddingHorizontal = tokens.spacing.md;
        break;
    }

    return StyleSheet.create({
      container: containerStyle,
      text: textStyle,
      indicatorColor: { color: indicatorColor },
    });
  }, [variant, disabled, isLoading, colors, tokens]);

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      disabled={disabled || isLoading}
      activeOpacity={0.8}
      hitSlop={tokens.hitSlop.sm}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator color={styles.indicatorColor.color} />
      ) : (
        <>
          {icon}
          <Text style={styles.text}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};
