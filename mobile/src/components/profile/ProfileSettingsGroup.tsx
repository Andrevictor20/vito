import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import type { AutonomyMode } from '../../types';

interface ProfileSettingsGroupProps {
  onOpenNotifications?: () => void;
  onOpenCalendarSync?: () => void;
  onOpenAISettings?: () => void;
  onOpenContactsSync?: () => void;
  onOpenWhatsAppConnect?: () => void;
  onOpenGmailConnect?: () => void;
  /** Modo de autonomia atual (para o status da linha). */
  autonomyMode?: AutonomyMode;
  /** Permissão de notificação concedida (null = desconhecido). */
  notifActive?: boolean | null;
  /** Nº de calendários conectados (null = desconhecido). */
  calendarsActive?: number | null;
  /** Status da integração WhatsApp via Evolution API v2 */
  whatsAppStatus?: 'disconnected' | 'connecting' | 'connected' | null;
  /** Status da integração Gmail */
  gmailStatus?: { connected: boolean; email?: string } | null;
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
  onOpenNotifications,
  onOpenCalendarSync,
  onOpenAISettings,
  onOpenContactsSync,
  onOpenWhatsAppConnect,
  onOpenGmailConnect,
  autonomyMode = 'assisted',
  notifActive = null,
  calendarsActive = null,
  whatsAppStatus = null,
  gmailStatus = null,
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
          <View style={styles.itemTextCol}>
            <Text style={[styles.itemTitle, { color: colors.onSurface }]}>Tema da Interface</Text>
            <Text style={[styles.itemSub, { color: colors.textSecondary }]} numberOfLines={1}>
              {isDark ? 'Modo Escuro (M3 Dark)' : 'Modo Claro (Editorial Clean)'}
            </Text>
          </View>
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
          <View style={styles.itemTextCol}>
            <Text style={[styles.itemTitle, { color: colors.onSurface }]}>Autonomia do Vito</Text>
            <Text style={[styles.itemSub, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
              {proactive ? 'Proativo em radares e sugestões' : 'Modo Assistido ou Proativo'}
            </Text>
          </View>
        </View>
        <View style={styles.itemRight}>
          <StatusValue label={proactive ? 'Nível Alto' : 'Assistido'} />
          <RowChevron />
        </View>
      </TouchableOpacity>

      <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

      {/* Notificações */}
      <TouchableOpacity
        style={styles.groupItem}
        onPress={onOpenNotifications}
        activeOpacity={0.7}
        accessibilityLabel="Abrir notificações"
        accessibilityRole="button"
      >
        <View style={styles.itemLeft}>
          <View style={[styles.itemIconBox, { backgroundColor: colors.surfaceContainerHigh }]}>
            <MaterialIcons name="notifications-none" size={18} color={colors.primary} />
          </View>
          <View style={styles.itemTextCol}>
            <Text style={[styles.itemTitle, { color: colors.onSurface }]}>Notificações</Text>
            <Text style={[styles.itemSub, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
              Resumos às 08:30 e alertas críticos
            </Text>
          </View>
        </View>
        <View style={styles.itemRight}>
          <StatusValue label={notifActive === null ? '—' : notifActive ? 'Ativas' : 'Off'} />
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
          <View style={styles.itemTextCol}>
            <Text style={[styles.itemTitle, { color: colors.onSurface }]} numberOfLines={1}>Sincronização de Calendários</Text>
            <Text style={[styles.itemSub, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
              Google Calendar e calendário local
            </Text>
          </View>
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

      {/* Sincronização de Contatos da Agenda (P2P) */}
      <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
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
          <View style={styles.itemTextCol}>
            <Text style={[styles.itemTitle, { color: colors.onSurface }]}>Agenda de Contatos</Text>
            <Text style={[styles.itemSub, { color: colors.onSurfaceVariant }]}>
              Encontrar colegas e amigos no Vito
            </Text>
          </View>
        </View>
        <View style={styles.itemRight}>
          <RowChevron />
        </View>
      </TouchableOpacity>

      {/* Integração WhatsApp (Evolution API v2) */}
      <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
      <TouchableOpacity
        style={styles.groupItem}
        onPress={onOpenWhatsAppConnect}
        activeOpacity={0.7}
        accessibilityLabel="Abrir conexão com WhatsApp"
        accessibilityRole="button"
      >
        <View style={styles.itemLeft}>
          <View style={[styles.itemIconBox, { backgroundColor: colors.surfaceContainerHigh }]}>
            <MaterialIcons name="chat" size={18} color="#25D366" />
          </View>
          <View style={styles.itemTextCol}>
            <Text style={[styles.itemTitle, { color: colors.onSurface }]}>WhatsApp</Text>
            <Text style={[styles.itemSub, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
              {whatsAppStatus === 'connected'
                ? 'Sessão ativa e pronto para receber @vito'
                : 'Conectar via Evolution API v2'}
            </Text>
          </View>
        </View>
        <View style={styles.itemRight}>
          <StatusValue
            label={
              whatsAppStatus === 'connected'
                ? 'Conectado'
                : whatsAppStatus === 'connecting'
                ? 'Conectando...'
                : 'Off'
            }
          />
          <RowChevron />
        </View>
      </TouchableOpacity>

      {/* Integração Gmail */}
      <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
      <TouchableOpacity
        style={styles.groupItem}
        onPress={onOpenGmailConnect}
        activeOpacity={0.7}
        accessibilityLabel="Abrir integração com Gmail"
        accessibilityRole="button"
      >
        <View style={styles.itemLeft}>
          <View style={[styles.itemIconBox, { backgroundColor: colors.surfaceContainerHigh }]}>
            <MaterialIcons name="mail" size={18} color="#EA4335" />
          </View>
          <View style={styles.itemTextCol}>
            <Text style={[styles.itemTitle, { color: colors.onSurface }]}>Gmail</Text>
            <Text style={[styles.itemSub, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
              {gmailStatus?.connected
                ? `Varredura ativa (${gmailStatus.email || 'Conectado'})`
                : 'Ler boletos e alertas de viagens'}
            </Text>
          </View>
        </View>
        <View style={styles.itemRight}>
          <StatusValue
            label={gmailStatus?.connected ? 'Conectado' : 'Off'}
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
