import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { MainTabType } from '../../utils/pagerNavigation';

export interface HeaderProps {
  title?: string;
  subtitle?: string;
  showDivider?: boolean;
  contextualActions?: React.ReactNode;
  onPressTitle?: () => void;
  activeTab?: MainTabType;
  onPressHistory?: () => void;
  onPressNewChat?: () => void;
}

export interface HeaderIconButtonProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
}

export const HeaderIconButton: React.FC<HeaderIconButtonProps> = ({
  icon,
  onPress,
  accessibilityLabel,
  size = 18,
}) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.actionBtn,
        {
          backgroundColor: colors.surfaceContainerLow,
          borderColor: colors.outlineVariant,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={tokens.hitSlop.sm}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      <MaterialIcons name={icon} size={size} color={colors.onSurface} />
    </TouchableOpacity>
  );
};

const TAB_TITLES: Record<MainTabType, { title: string; subtitle: string }> = {
  chat: { title: 'Vito', subtitle: 'Assistente Executivo' },
  calendar: { title: 'Agenda', subtitle: 'Compromissos' },
  tasks: { title: 'Tarefas', subtitle: 'Tarefas e Pendências' },
  triggers: { title: 'Radares', subtitle: 'Radar do Vito' },
  booking: { title: 'Vito Booking', subtitle: 'Links de Agendamento' },
  profile: { title: 'Perfil', subtitle: 'Conta e ajustes' },
};

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showDivider = true,
  contextualActions,
  onPressTitle,
  activeTab,
  onPressHistory,
  onPressNewChat,
}) => {
  const { colors } = useTheme();

  const resolved = activeTab ? TAB_TITLES[activeTab] : undefined;
  const displayTitle = title ?? resolved?.title ?? 'Agenda';
  const displaySubtitle = subtitle ?? resolved?.subtitle;

  const isChat = activeTab === 'chat';

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: colors.surface,
          borderBottomColor: colors.outlineVariant,
          borderBottomWidth: showDivider ? 1 : 0,
        },
      ]}
      accessibilityRole="header"
    >
      <View style={styles.topRow}>
        {onPressTitle ? (
          <TouchableOpacity onPress={onPressTitle} activeOpacity={0.7} accessibilityRole="button">
            <Text style={[styles.title, { color: colors.onSurface }]} numberOfLines={1}>
              {displayTitle}
            </Text>
            {displaySubtitle ? (
              <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
                {displaySubtitle}
              </Text>
            ) : null}
          </TouchableOpacity>
        ) : (
          <View>
            <Text style={[styles.title, { color: colors.onSurface }]} numberOfLines={1}>
              {displayTitle}
            </Text>
            {displaySubtitle ? (
              <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
                {displaySubtitle}
              </Text>
            ) : null}
          </View>
        )}

        <View style={styles.actionsRow}>
          {isChat && (onPressNewChat || onPressHistory) ? (
            <View style={styles.chatActionsGroup}>
              {onPressNewChat && (
                <HeaderIconButton
                  icon="add"
                  onPress={onPressNewChat}
                  accessibilityLabel="Nova conversa"
                  size={20}
                />
              )}
              {onPressHistory && (
                <HeaderIconButton
                  icon="history"
                  onPress={onPressHistory}
                  accessibilityLabel="Mensagens anteriores e histórico"
                  size={20}
                />
              )}
            </View>
          ) : (
            contextualActions
          )}
        </View>
      </View>
    </View>
  );
};

export const TopAppBar = Header;

const styles = StyleSheet.create({
  header: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.1,
    marginTop: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  chatActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
