import React, { useState, useMemo } from 'react';
import {
  View,
  TextInput as RNTextInput,
  Text,
  StyleSheet,
  TextInputProps as RNTextInputProps,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export type TextInputVariant = 'filled' | 'outlined';

export interface TextInputProps extends RNTextInputProps {
  label?: string;
  error?: string;
  variant?: TextInputVariant;
  containerStyle?: ViewStyle;
}

export const TextInput: React.FC<TextInputProps> = ({
  label,
  error,
  variant = 'outlined',
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...props
}) => {
  const { colors, tokens } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const styles = useMemo(() => {
    let baseContainer: ViewStyle = {
      minHeight: 56, // M3 default height for text fields
      borderRadius: tokens.radii.xs, // M3 defined radius (4dp for filled, usually outlined too)
      paddingHorizontal: tokens.spacing.lg,
      justifyContent: 'center',
    };

    let borderColor = isFocused ? colors.primary : colors.outline;
    if (error) borderColor = colors.error;

    if (variant === 'outlined') {
      baseContainer = {
        ...baseContainer,
        borderWidth: isFocused ? 2 : 1,
        borderColor,
        backgroundColor: 'transparent',
      };
    } else {
      // filled
      baseContainer = {
        ...baseContainer,
        backgroundColor: colors.surfaceContainerHighest,
        borderBottomWidth: isFocused ? 2 : 1,
        borderBottomColor: borderColor,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
      };
    }

    return StyleSheet.create({
      container: baseContainer,
      input: {
        fontFamily: tokens.typography.family.regular,
        fontSize: tokens.typography.size.bodyLarge,
        color: colors.onSurface,
        paddingTop: label ? tokens.spacing.md : 0,
        paddingBottom: tokens.spacing.xs,
        minHeight: 24,
      },
      label: {
        position: 'absolute',
        left: tokens.spacing.lg,
        top: isFocused || props.value ? tokens.spacing.xs : 18,
        fontFamily: tokens.typography.family.medium,
        fontSize: isFocused || props.value ? tokens.typography.size.labelSmall : tokens.typography.size.bodyLarge,
        color: error ? colors.error : isFocused ? colors.primary : colors.onSurfaceVariant,
      },
      errorText: {
        fontFamily: tokens.typography.family.regular,
        fontSize: tokens.typography.size.bodySmall,
        color: colors.error,
        marginTop: tokens.spacing.xs,
        marginLeft: tokens.spacing.md,
      },
    });
  }, [variant, isFocused, error, colors, tokens, props.value, label]);

  return (
    <View style={containerStyle}>
      <View style={styles.container}>
        {label && <Text style={styles.label}>{label}</Text>}
        <RNTextInput
          style={[styles.input, style]}
          placeholderTextColor={colors.onSurfaceVariant}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};
