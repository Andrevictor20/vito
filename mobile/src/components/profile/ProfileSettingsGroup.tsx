import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import type { AutonomyMode } from '../../types';
interface ProfileSettingsGroupProps {
  onOpenCalendarSync?: () => void;
  onOpenAISettings?: () => void;
  onOpenContactsSync?: () => void;
  onOpenIntegrations?: () => void;
  /** Modo de autonomia atual (para o status da linha). */
  autonomyMode?: AutonomyMode;
  /** Nº de calendários conectados (null = desconhecido). */
  calendarsActive?: number | null;
  /** Nº de integrações ativas (WhatsApp, Gmail, etc.) */
  integrationsActiveCount?: number;
}

const StatusValue: React.FC<{ label: string }> = ({ label }) => {
  const { colors } = useTheme();
  return (
    <Text style={[styles.statusText, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
      {label}
    </Text>
  );
};

const RowChevron: React.FC = () => {
  const { colors } = useTheme();
  return <MaterialIcons name="chevron-right" size={20} color={colors.outline} />;
};

export const ProfileSettingsGroup: React.FC<ProfileSettingsGroupProps> = ({
  onOpenCalendarSync,
  onOpenAISettings,
  onOpenContactsSync,
  onOpenIntegrations,
  autonomyMode = 'assisted',
  calendarsActive = null,
  integrationsActiveCount = 0,
}) => {
  const { colors, isDark, toggleTheme } = useTheme();
  const proactive = autonomyMode === 'proactive';

  return (
    <View style={[styles.groupCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
      {/* Tema da Interface: toque alterna claro/escuro */}
      <TouchableOpacity
        style={styles.groupItem}
        onPress={toggleTheme}
        activeOpacity={0.7}
        accessibilityLabel="Alternar tema da interface"
        accessibilityRole="button"
      >
        <View style={styles.itemLeft}>
          <View style={[styles.itemIconBox, { backgroundColor: colors.surfaceContainerHigh }]}>
            <MaterialIcons
              name={isDark ? 'dark-mode' : 'light-mode'}
              size={18}
              color={colors.primary}
            />
          </View>
          <Text style={[styles.itemTitle, { color: colors.onSurface }]}>Tema da Interface</Text>
        </View>
        <View style={styles.itemRight}>
          <StatusValue label={isDark ? 'Escuro' : 'Claro'} />
          <RowChevron />
        </View>
      </TouchableOpacity>

      <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

      {/* Autonomia do Vito */}
      <TouchableOpacity
        style={styles.groupItem}
        onPress={onOpenAISettings}
        activeOpacity={0.7}
        accessibilityLabel="Abrir autonomia do Vito"
        accessibilityRole="button"
      >
        <View style={styles.itemLeft}>
          <View style={[styles.itemIconBox, { backgroundColor: colors.surfaceContainerHigh }]}>
            <MaterialIcons name="tune" size={18} color={colors.primary} />
          </View>
          <Text style={[styles.itemTitle, { color: colors.onSurface }]}>Autonomia do Vito</Text>
        </View>
        <View style={styles.itemRight}>
          <StatusValue label={proactive ? 'Nível Alto' : 'Assistido'} />
          <RowChevron />
        </View>
      </TouchableOpacity>

      <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

      {/* Sincronização de Calendários */}
      <TouchableOpacity
        style={styles.groupItem}
        onPress={onOpenCalendarSync}
        activeOpacity={0.7}
        accessibilityLabel="Abrir sincronização de calendários"
        accessibilityRole="button"
      >
        <View style={styles.itemLeft}>
          <View style={[styles.itemIconBox, { backgroundColor: colors.surfaceContainerHigh }]}>
            <MaterialIcons name="calendar-today" size={18} color={colors.primary} />
          </View>
          <Text style={[styles.itemTitle, { color: colors.onSurface }]} numberOfLines={1}>
            Sincronização de Calendários
          </Text>
        </View>
        <View style={styles.itemRight}>
          <StatusValue
            label={
              calendarsActive === null
                ? '—'
                : calendarsActive === 0
                ? 'Off'
                : `${calendarsActive} ativo${calendarsActive === 1 ? '' : 's'}`
            }
          />
          <RowChevron />
        </View>
      </TouchableOpacity>

      <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

      {/* Sincronização de Contatos da Agenda (P2P) */}
      <TouchableOpacity
        style={styles.groupItem}
        onPress={onOpenContactsSync}
        activeOpacity={0.7}
        accessibilityLabel="Abrir agenda de contatos para agendamento mútuo"
        accessibilityRole="button"
      >
        <View style={styles.itemLeft}>
          <View style={[styles.itemIconBox, { backgroundColor: colors.surfaceContainerHigh }]}>
            <MaterialIcons name="contacts" size={18} color={colors.primary} />
          </View>
          <Text style={[styles.itemTitle, { color: colors.onSurface }]}>Agenda de Contatos</Text>
        </View>
        <View style={styles.itemRight}>
          <RowChevron />
        </View>
      </TouchableOpacity>

      <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

      {/* Integrações (WhatsApp, Gmail, etc.) */}
      <TouchableOpacity
        style={styles.groupItem}
        onPress={onOpenIntegrations}
        activeOpacity={0.7}
        accessibilityLabel="Abrir integrações externas"
        accessibilityRole="button"
      >
        <View style={styles.itemLeft}>
          <View style={[styles.itemIconBox, { backgroundColor: colors.surfaceContainerHigh }]}>
            <MaterialIcons name="extension" size={18} color={colors.primary} />
          </View>
          <Text style={[styles.itemTitle, { color: colors.onSurface }]}>Integrações</Text>
        </View>
        <View style={styles.itemRight}>
          <StatusValue
            label={
              integrationsActiveCount > 0
                ? `${integrationsActiveCount} ativa${integrationsActiveCount === 1 ? '' : 's'}`
                : 'Conectar'
            }
          />
          <RowChevron />
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  groupCard: {
    backgroundColor: tokens.colors.surfaceContainer,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
    overflow: 'hidden',
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacing.md,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    flex: 1,
  },
  itemIconBox: {
    width: 32,
    height: 32,
    borderRadius: tokens.radii.sm,
    backgroundColor: tokens.colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTextCol: {
    flex: 1,
  },
  itemTitle: {
    color: tokens.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  itemSub: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.size.xs,
    marginTop: 1,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: tokens.colors.outlineVariant,
    marginHorizontal: tokens.spacing.md,
  },
});
