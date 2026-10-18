import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { TriggerTemplate, TriggerCategory, TRIGGER_CATEGORIES } from '../../types';

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
    colorLight: '#6B7280',
    colorDark: '#9CA3AF',
    bgLight: '#F3F4F6',
    bgDark: '#1F2937',
    placeholder: '',
  };

  const scheduleText =
    template.frequency === 'immediate'
      ? 'Em tempo real'
      : template.scheduled_time
      ? `Diário às ${template.scheduled_time}`
      : template.frequency === 'daily_evening'
      ? 'Diário ao entardecer (18:00)'
      : 'Diário pela manhã (08:30)';

  const getConnectorStyle = (connector: string) => {
    switch (connector.toLowerCase()) {
      case 'gmail':
        return {
          icon: 'mail-outline' as const,
          label: 'Gmail',
          color: '#EF4444',
          bg: isDark ? 'rgba(239, 68, 68, 0.18)' : '#FEE2E2',
          border: isDark ? 'rgba(239, 68, 68, 0.35)' : '#FECACA',
        };
      case 'calendar':
        return {
          icon: 'event' as const,
          label: 'Agenda',
          color: '#3B82F6',
          bg: isDark ? 'rgba(59, 130, 246, 0.18)' : '#DBEAFE',
          border: isDark ? 'rgba(59, 130, 246, 0.35)' : '#BFDBFE',
        };
      case 'web':
        return {
          icon: 'language' as const,
          label: 'Web Search',
          color: '#10B981',
          bg: isDark ? 'rgba(168, 85, 247, 0.18)' : '#D1FAE5',
          border: isDark ? 'rgba(16, 185, 129, 0.35)' : '#A7F3D0',
        };
      case 'profile':
        return {
          icon: 'person-outline' as const,
          label: 'Perfil',
          color: '#A855F7',
          bg: isDark ? 'rgba(168, 85, 247, 0.18)' : '#F3E8FF',
          border: isDark ? 'rgba(168, 85, 247, 0.35)' : '#E9D5FF',
        };
      default:
        return {
          icon: 'link' as const,
          label: connector,
          color: colors.onSurfaceVariant,
          bg: isDark ? colors.surfaceContainerHighest : '#F4F4F5',
          border: colors.outlineVariant,
        };
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surfaceContainer,
          borderColor: colors.outlineVariant,
        },
      ]}
    >
      <View style={styles.cardHeaderRow}>
        <View
          style={[
            styles.categoryBadge,
            { backgroundColor: isDark ? catMeta.bgDark : catMeta.bgLight },
          ]}
        >
          <MaterialIcons
            name={catMeta.icon}
            size={13}
            color={isDark ? catMeta.colorDark : catMeta.colorLight}
          />
          <Text
            style={[
              styles.categoryBadgeText,
              { color: isDark ? catMeta.colorDark : catMeta.colorLight },
            ]}
          >
            {catMeta.label}
          </Text>
        </View>

        <View style={styles.scheduleRow}>
          <MaterialIcons name="schedule" size={13} color={colors.onSurfaceVariant} />
          <Text style={[styles.scheduleText, { color: colors.onSurfaceVariant }]}>
            {scheduleText}
          </Text>
        </View>
      </View>

      <Text style={[styles.cardTitle, { color: colors.onSurface }]}>{template.title}</Text>
      <Text style={[styles.cardDescription, { color: colors.onSurfaceVariant }]}>
        {template.description}
      </Text>

      <View style={styles.connectorsSection}>
        <Text style={[styles.connectorsLabel, { color: colors.onSurfaceVariant }]}>
          Fontes cruzadas:
        </Text>
        <View style={styles.connectorsRow}>
          {template.connectors.map((connector) => {
            const conf = getConnectorStyle(connector);
            return (
              <View
                key={connector}
                style={[
                  styles.connectorBadge,
                  { backgroundColor: conf.bg, borderColor: conf.border },
                ]}
              >
                <MaterialIcons name={conf.icon} size={12} color={conf.color} />
                <Text style={[styles.connectorBadgeText, { color: conf.color }]}>
                  {conf.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.activateButton,
          { backgroundColor: colors.primary },
          isActivating && { opacity: 0.7 },
        ]}
        onPress={() => onActivate(template)}
        disabled={isActivating}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Ativar vigília ${template.title}`}
      >
        {isActivating ? (
          <>
            <ActivityIndicator size="small" color={colors.onPrimary} />
            <Text style={[styles.activateButtonText, { color: colors.onPrimary }]}>
              Ativando vigília...
            </Text>
          </>
        ) : (
          <>
            <MaterialIcons name="bolt" size={18} color={colors.onPrimary} />
            <Text style={[styles.activateButtonText, { color: colors.onPrimary }]}>
              Ativar com 1 Toque
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: MD3Shapes.small,
    gap: 4,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scheduleText: {
    fontSize: 11,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  connectorsSection: {
    marginTop: 2,
    gap: 6,
  },
  connectorsLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  connectorsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  connectorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: MD3Shapes.small,
    borderWidth: 1,
    gap: 4,
  },
  connectorBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  activateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: MD3Shapes.medium,
    marginTop: 4,
    gap: 6,
  },
  activateButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
