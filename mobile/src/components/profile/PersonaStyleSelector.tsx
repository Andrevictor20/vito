import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { tokens } from '../../theme/tokens';

export interface PersonaStyleOption {
  id: string;
  label: string;
  sub: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}

export const PERSONA_STYLES: PersonaStyleOption[] = [
  { id: 'balanced', label: 'Equilibrado', sub: 'Claro, cordial e objetivo (padrão)', icon: 'balance' },
  { id: 'direct', label: 'Direto', sub: 'Respostas concisas sem saudações redundantes', icon: 'bolt' },
  { id: 'warm', label: 'Caloroso', sub: 'Empático, acolhedor e atencioso', icon: 'favorite' },
  { id: 'professional', label: 'Profissional', sub: 'Formal, executivo e estruturado', icon: 'business-center' },
  { id: 'relaxed', label: 'Descontraído', sub: 'Casual, bem-humorado e flexível', icon: 'sentiment-satisfied' },
];

interface PersonaStyleSelectorProps {
  value: string;
  onChange: (styleId: string) => void;
}

export const PersonaStyleSelector: React.FC<PersonaStyleSelectorProps> = ({ value, onChange }) => {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: colors.onSurfaceVariant }]}>
        ESTILO CONVERSACIONAL
      </Text>
      <View style={styles.list}>
        {PERSONA_STYLES.map((style) => {
          const isSelected = value === style.id;
          return (
            <TouchableOpacity
              key={style.id}
              style={[
                styles.card,
                {
                  backgroundColor: colors.surfaceContainer,
                  borderColor: isSelected ? colors.primary : colors.outlineVariant,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}
              onPress={() => onChange(style.id)}
              activeOpacity={0.7}
            >
              <View style={styles.row}>
                <View
                  style={[
                    styles.iconBox,
                    {
                      backgroundColor: isSelected ? colors.primary + '18' : colors.surfaceContainerHigh,
                    },
                  ]}
                >
                  <MaterialIcons
                    name={style.icon}
                    size={20}
                    color={isSelected ? colors.primary : colors.onSurfaceVariant}
                  />
                </View>
                <View style={styles.textContainer}>
                  <Text style={[styles.title, { color: colors.onSurface }]}>{style.label}</Text>
                  <Text style={[styles.sub, { color: colors.onSurfaceVariant }]}>{style.sub}</Text>
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
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: tokens.spacing['2xs'],
  },
  list: {
    gap: tokens.spacing.xs,
  },
  card: {
    padding: tokens.spacing.sm,
    borderRadius: tokens.shapes.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: tokens.typography.titleSmall.fontSize,
    fontWeight: '600',
  },
  sub: {
    fontSize: 11,
    marginTop: 2,
  },
});
