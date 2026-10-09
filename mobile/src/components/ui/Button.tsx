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

export interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: ButtonVariant;
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  variant = 'filled',
  icon,
  isLoading,
  disabled,
  style,
  ...props
}) => {
  const { colors, tokens } = useTheme();

  const styles = useMemo(() => {
    // Base styles
    const baseContainer: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 40,
      paddingHorizontal: tokens.spacing.xl,
      borderRadius: tokens.radii.full, // M3 default for most buttons
      gap: tokens.spacing.sm,
    };

    const baseText: TextStyle = {
      fontFamily: tokens.typography.family.medium,
      fontSize: tokens.typography.size.labelLarge,
      lineHeight: tokens.typography.lineHeight.labelLarge,
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
