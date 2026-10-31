import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { tokens } from '../../theme/tokens';
import {
  VOICE_OPTIONS,
  normalizeVoiceChoice,
  VoiceOption,
} from '../../services/voice/voiceSelectorHelpers';

export { VOICE_OPTIONS, VoiceOption };

interface VoiceSelectorProps {
  value?: string;
  onChange: (voiceId: 'puck' | 'kore') => void;
  disabled?: boolean;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  value = 'puck',
  onChange,
  disabled = false,
}) => {
  const { colors } = useTheme();
  const normalizedValue = normalizeVoiceChoice(value);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: colors.onSurfaceVariant }]}>
          VOZ DO ASSISTENTE
        </Text>
        <View style={[styles.neuralBadge, { backgroundColor: colors.primary + '18' }]}>
          <Text style={[styles.neuralBadgeText, { color: colors.primary }]}>
            Google Gemini 2.5
          </Text>
        </View>
      </View>

      <View style={styles.list}>
        {VOICE_OPTIONS.map((opt) => {
          const isSelected = normalizedValue === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.card,
                {
                  backgroundColor: colors.surfaceContainer,
                  borderColor: isSelected ? colors.primary : colors.outlineVariant,
                  borderWidth: isSelected ? 2 : 1,
                  opacity: disabled ? 0.6 : 1,
                },
              ]}
              onPress={() => !disabled && onChange(opt.id)}
              activeOpacity={0.7}
              disabled={disabled}
              accessibilityLabel={`${opt.label}: ${opt.sub}`}
            >
              <View style={styles.row}>
                <View
                  style={[
                    styles.iconBox,
                    {
                      backgroundColor: isSelected ? colors.primary + '20' : colors.surfaceContainerHigh,
                    },
                  ]}
                >
                  <MaterialIcons
                    name={opt.id === 'kore' ? 'face-3' : 'face'}
                    size={22}
                    color={isSelected ? colors.primary : colors.onSurfaceVariant}
                  />
                </View>
                <View style={styles.textContainer}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.title, { color: colors.onSurface }]}>
                      {opt.label}
                    </Text>
                    <Text style={[styles.subBadge, { color: colors.primary }]}>
                      {opt.badge}
                    </Text>
                  </View>
                  <Text style={[styles.sub, { color: colors.onSurfaceVariant }]}>
                    {opt.sub}
                  </Text>
                </View>
                <MaterialIcons
                  name={isSelected ? 'radio-button-checked' : 'radio-button-unchecked'}
                  size={20}
                  color={isSelected ? colors.primary : colors.outline}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: tokens.spacing.md,
    gap: tokens.spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  neuralBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  neuralBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  list: {
    gap: tokens.spacing.xs,
  },
  card: {
    padding: tokens.spacing.sm,
    borderRadius: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  subBadge: {
    fontSize: 10,
    fontWeight: '700',
  },
  sub: {
    fontSize: 12,
    lineHeight: 16,
  },
});
