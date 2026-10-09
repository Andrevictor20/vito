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
  placeholder,
  ...props
}) => {
  const { colors, tokens } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = Boolean(props.value && String(props.value).length > 0);
  const isFloating = isFocused || hasValue;

  const styles = useMemo(() => {
    let baseContainer: ViewStyle = {
      minHeight: 56, // Altura padrão Material Design 3
      borderRadius: tokens.radii.xs,
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
        paddingTop: label ? (isFloating ? 18 : 0) : 0,
        paddingBottom: label ? (isFloating ? 4 : 0) : 0,
        minHeight: 24,
      },
      label: {
        position: 'absolute',
        left: tokens.spacing.lg,
        top: isFloating ? 6 : 18,
        fontFamily: tokens.typography.family.medium,
        fontSize: isFloating ? tokens.typography.size.labelSmall : tokens.typography.size.bodyLarge,
        color: error ? colors.error : isFocused ? colors.primary : colors.onSurfaceVariant,
        zIndex: 1,
      },
      errorText: {
        fontFamily: tokens.typography.family.regular,
        fontSize: tokens.typography.size.bodySmall,
        color: colors.error,
        marginTop: tokens.spacing.xs,
        marginLeft: tokens.spacing.md,
      },
    });
  }, [variant, isFocused, isFloating, error, colors, tokens, label]);

  // Se houver label, o placeholder só é exibido quando o campo estiver focado ou preenchido,
  // eliminando 100% da sobreposição entre o label em repouso e o texto de dica
  const activePlaceholder = isFloating ? placeholder : undefined;

  return (
    <View style={containerStyle}>
      <View style={styles.container}>
        {label && (
          <Text style={styles.label} pointerEvents="none">
            {label}
          </Text>
        )}
        <RNTextInput
          style={[styles.input, style]}
          placeholder={activePlaceholder}
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
