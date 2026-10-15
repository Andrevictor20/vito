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
  onPressNewChat?: () => void;
  /** Abre a gaveta lateral (hamburger à esquerda). */
  onPressMenu?: () => void;
  /** Oculta título/subtítulo (visual clean, ex. chat). */
  hideTitle?: boolean;
  /** Alinhamento do título. Default 'center'. */
  align?: 'left' | 'center';
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
  chat: { title: 'Vito', subtitle: '' },
  calendar: { title: 'Agenda', subtitle: '' },
  tasks: { title: 'Tarefas', subtitle: '' },
  triggers: { title: 'Radares', subtitle: 'Monitoramento inteligente em tempo real' },
  booking: { title: 'Vito Booking', subtitle: 'Links públicos de agendamento' },
  profile: { title: 'Perfil', subtitle: '' },
};

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showDivider = false,
  contextualActions,
  onPressTitle,
  activeTab,
  onPressMenu,
  hideTitle = false,
  align = 'center',
  onPressNewChat,
}) => {
  const { colors } = useTheme();

  const resolved = activeTab ? TAB_TITLES[activeTab] : undefined;
  const displayTitle = hideTitle ? null : title ?? resolved?.title ?? 'Agenda';
  // Subtítulo editorial: prop tem prioridade, senão o padrão da aba.
  const displaySubtitle: string | null = hideTitle
    ? null
    : (subtitle ?? resolved?.subtitle ?? null) || null;

  const isChat = activeTab === 'chat';
  const centered = align === 'center';
  const hasLeft = !!onPressMenu;
  const hasRight = !!((isChat && onPressNewChat) || contextualActions);

  const titleBlock = displayTitle ? (
    onPressTitle ? (
      <TouchableOpacity onPress={onPressTitle} activeOpacity={0.7} accessibilityRole="button">
        <Text style={[styles.title, !centered && styles.titleLeft, { color: colors.onSurface }]} numberOfLines={1}>
          {displayTitle}
        </Text>
        {displaySubtitle ? (
          <Text style={[styles.subtitle, !centered && styles.subtitleLeft, { color: colors.textMuted }]} numberOfLines={2}>
            {displaySubtitle}
          </Text>
        ) : null}
      </TouchableOpacity>
    ) : (
      <View>
        <Text style={[styles.title, !centered && styles.titleLeft, { color: colors.onSurface }]} numberOfLines={1}>
          {displayTitle}
        </Text>
        {displaySubtitle ? (
          <Text style={[styles.subtitle, !centered && styles.subtitleLeft, { color: colors.textMuted }]} numberOfLines={2}>
            {displaySubtitle}
          </Text>
        ) : null}
      </View>
    )
  ) : null;

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
        {hasLeft || centered ? (
          <View style={styles.sideSlot}>
            {onPressMenu ? (
              <HeaderIconButton
                icon="menu"
                onPress={onPressMenu}
                accessibilityLabel="Abrir histórico de conversas"
                size={22}
              />
            ) : null}
          </View>
        ) : null}

        <View style={styles.titleSlot}>{titleBlock}</View>

        {hasRight || centered ? (
          <View style={[styles.actionsRow, styles.sideSlotRight]}>
            {isChat && onPressNewChat ? (
              <HeaderIconButton
                icon="add"
                onPress={onPressNewChat}
                accessibilityLabel="Nova conversa"
                size={20}
              />
            ) : (
              contextualActions
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
};

export const TopAppBar = Header;

/** Pill de ação do header editorial (sólida primária ou ghost discreta). */
export interface HeaderPillProps {
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
  variant?: 'solid' | 'ghost';
  icon?: keyof typeof MaterialIcons.glyphMap;
}

export const HeaderPill: React.FC<HeaderPillProps> = ({
  label,
  onPress,
  accessibilityLabel,
  variant = 'solid',
  icon = 'add',
}) => {
  const { colors } = useTheme();
  const ghost = variant === 'ghost';
  return (
    <TouchableOpacity
      style={[
        styles.pill,
        ghost
          ? { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant, borderWidth: 1 }
          : { backgroundColor: colors.primary },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      hitSlop={tokens.hitSlop.md}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      <MaterialIcons
        name={icon}
        size={16}
        color={ghost ? colors.onSurface : colors.onPrimary}
      />
      <Text
        style={[
          styles.pillText,
          { color: ghost ? colors.onSurface : colors.onPrimary },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  header: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingTop: 12,
    paddingBottom: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  sideSlot: {
    width: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  titleSlot: {
    flex: 1,
    justifyContent: 'center',
  },
  titleCenter: {
    textAlign: 'center',
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  titleLeft: {
    fontSize: 27,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
    letterSpacing: 0.1,
    marginTop: 0,
  },
  subtitleLeft: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
    letterSpacing: 0,
    marginTop: 2,
    textAlign: 'left',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
    flexShrink: 0,
  },
  sideSlotRight: {
    minWidth: 36,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: MD3Shapes.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 4,
    minHeight: 40,
    maxWidth: 150,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
});
