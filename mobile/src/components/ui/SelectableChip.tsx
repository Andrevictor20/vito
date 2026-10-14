import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';

interface SelectableChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}

/** Chip único do Design System — ativo com fundo #111, inativo outline. */
export const SelectableChip: React.FC<SelectableChipProps> = ({
  label,
  selected,
  onPress,
  accessibilityLabel,
}) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        {
          borderColor: selected ? '#111111' : colors.outlineVariant,
          backgroundColor: selected ? '#111111' : 'transparent',
        },
      ]}
      onPress={() => {
        hapticFeedback.selection();
        onPress();
      }}
      activeOpacity={0.7}
      accessibilityLabel={accessibilityLabel || label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text
        style={[
          styles.text,
          { color: selected ? '#FFFFFF' : colors.onSurfaceVariant },
          selected && { fontWeight: '700' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
});
