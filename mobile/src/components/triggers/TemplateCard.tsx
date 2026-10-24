import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { TriggerTemplate, TRIGGER_CATEGORIES } from '../../types';

interface TemplateCardProps {
  template: TriggerTemplate;
  isActivating: boolean;
  onActivate: (template: TriggerTemplate) => void;
}

export const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  isActivating,
  onActivate,
}) => {
  const { colors, isDark } = useTheme();

  const catMeta = TRIGGER_CATEGORIES.find((c) => c.id === template.category) || {
    id: template.category,
    label: template.category,
    icon: 'auto-awesome' as const,
    colorLight: colors.blue,
    colorDark: colors.blue,
    bgLight: colors.blueBg,
    bgDark: 'rgba(43, 127, 212, 0.18)',
    placeholder: '',
  };

  const categoryColor = isDark ? catMeta.colorDark : catMeta.colorLight;
  const categoryBg = isDark ? catMeta.bgDark : catMeta.bgLight;

  return (
    <TouchableOpacity
      style={[
        styles.tile,
        {
          backgroundColor: colors.bg,
          borderColor: colors.line,
        },
      ]}
      onPress={() => onActivate(template)}
      activeOpacity={0.7}
      disabled={isActivating}
      accessibilityRole="button"
      accessibilityLabel={`Ativar vigília ${template.title}: ${template.description}`}
    >
      <View style={[styles.chip, { backgroundColor: categoryBg }]}>
        <MaterialIcons name={catMeta.icon} size={20} color={categoryColor} />
      </View>

      <View style={styles.content}>
        <Text
          style={[
            styles.title,
            {
              color: colors.ink,
              fontFamily: tokens.typography.family.semibold,
            },
          ]}
          numberOfLines={2}
        >
          {template.title}
        </Text>
        <Text
          style={[
            styles.description,
            {
              color: colors.muted,
              fontFamily: tokens.typography.family.regular,
            },
          ]}
          numberOfLines={2}
        >
          {template.description}
        </Text>
      </View>

      {isActivating && (
        <View style={styles.activatingOverlay}>
          <ActivityIndicator size="small" color={categoryColor} />
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    minHeight: 140,
    justifyContent: 'space-between',
    margin: 5,
    shadowColor: 'rgba(20,25,22,0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 1,
  },
  chip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    marginTop: 10,
    gap: 3,
  },
  title: {
    fontSize: 14.5,
    lineHeight: 18,
  },
  description: {
    fontSize: 12.5,
    lineHeight: 16,
  },
  activatingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
