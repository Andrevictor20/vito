import React, { useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated, Easing } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { VitoMascot } from './VitoMascot';

export interface HeaderProps {
  title?: string;
  subtitle?: string;
  showMascot?: boolean;
  mascotSize?: number;
  mascotState?: 'idle' | 'thinking';
  showStatusDot?: boolean;
  statusColor?: string;
  contextualActions?: React.ReactNode;
  showDivider?: boolean;
  onPressProfile?: () => void;
  onPressTitle?: () => void;
  activeTab?: 'calendar' | 'chat' | 'triggers';
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
    >
      <MaterialIcons name={icon} size={size} color={colors.onSurface} />
    </TouchableOpacity>
  );
};

export const Header: React.FC<HeaderProps> = ({
  title = 'Agenda & Tarefas',
  subtitle = 'Organização Pessoal',
  showMascot = true,
  mascotSize = 28,
  mascotState = 'idle',
  showStatusDot = false,
  statusColor,
  contextualActions,
  showDivider = true,
  onPressProfile,
  onPressTitle,
  activeTab,
  onPressHistory,
  onPressNewChat,
}) => {
  const { user } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();

  const firstName = user?.name ? user.name.split(' ')[0] : 'Usuário';
  const effectiveStatusColor = statusColor || colors.statusOnline;

  const tabTransition = useRef(new Animated.Value(activeTab === 'chat' ? 1 : activeTab === 'triggers' ? 2 : 0)).current;

  useEffect(() => {
    if (activeTab) {
      const targetVal = activeTab === 'chat' ? 1 : activeTab === 'triggers' ? 2 : 0;
      Animated.timing(tabTransition, {
        toValue: targetVal,
        duration: 220,
        easing: Easing.bezier(0.2, 0, 0, 1),
        useNativeDriver: true,
      }).start();
    }
  }, [activeTab]);

  const calendarOpacity = tabTransition.interpolate({ inputRange: [0, 0.5, 1, 2], outputRange: [1, 0, 0, 0] });
  const calendarTranslateY = tabTransition.interpolate({ inputRange: [0, 1, 2], outputRange: [0, -4, -4] });
  const chatOpacity = tabTransition.interpolate({ inputRange: [0, 0.5, 1, 1.5, 2], outputRange: [0, 0, 1, 0, 0] });
  const chatTranslateY = tabTransition.interpolate({ inputRange: [0, 1, 2], outputRange: [4, 0, -4] });
  const triggersOpacity = tabTransition.interpolate({ inputRange: [0, 1, 1.5, 2], outputRange: [0, 0, 0, 1] });
  const triggersTranslateY = tabTransition.interpolate({ inputRange: [0, 1, 2], outputRange: [4, 4, 0] });

  const titleContent = activeTab ? (
    <View style={[styles.titleColumn, { minWidth: activeTab === 'chat' ? 115 : 150 }]}>
      {/* Camada Calendário */}
      <Animated.View
        style={[
          styles.titleCrossfadeLayer,
          {
            opacity: calendarOpacity,
            transform: [{ translateY: calendarTranslateY }],
          },
        ]}
        pointerEvents={activeTab === 'calendar' ? 'auto' : 'none'}
      >
        <Text style={[styles.brand, { color: colors.onSurface }]} numberOfLines={1}>
          Agenda & Tarefas
        </Text>
        <Text style={[styles.brandSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
          Organização Pessoal
        </Text>
      </Animated.View>

      {/* Camada Chat / Vito */}
      <Animated.View
        style={[
          styles.titleCrossfadeLayer,
          {
            opacity: chatOpacity,
            transform: [{ translateY: chatTranslateY }],
          },
        ]}
        pointerEvents={activeTab === 'chat' ? 'auto' : 'none'}
      >
        <View style={styles.titleRow}>
          <Text style={[styles.brand, { color: colors.onSurface }]} numberOfLines={1}>
            Vito
          </Text>
          <View style={[styles.statusDot, { backgroundColor: effectiveStatusColor }]} />
        </View>
        <Text style={[styles.brandSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
          Assistente Executivo
        </Text>
      </Animated.View>

      {/* Camada Disparadores */}
      <Animated.View
        style={[
          styles.titleCrossfadeLayer,
          {
            opacity: triggersOpacity,
            transform: [{ translateY: triggersTranslateY }],
          },
        ]}
        pointerEvents={activeTab === 'triggers' ? 'auto' : 'none'}
      >
        <View style={styles.titleRow}>
          <Text style={[styles.brand, { color: colors.onSurface }]} numberOfLines={1}>
            Radares
          </Text>
          <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
        </View>
        <Text style={[styles.brandSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
          Radar do Vito
        </Text>
      </Animated.View>
    </View>
  ) : (
    <View style={styles.titleColumn}>
      <View style={styles.titleRow}>
        <Text style={[styles.brand, { color: colors.onSurface }]} numberOfLines={1}>
          {title}
        </Text>
        {showStatusDot && (
          <View style={[styles.statusDot, { backgroundColor: effectiveStatusColor }]} />
        )}
      </View>
      {subtitle ? (
        <Text style={[styles.brandSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );

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
    >
      <View style={styles.topRow}>
        <View style={styles.brandRow}>
          {showMascot && (
            <VitoMascot size={mascotSize} state={mascotState} />
          )}
          {onPressTitle ? (
            <TouchableOpacity onPress={onPressTitle} activeOpacity={0.7}>
              {titleContent}
            </TouchableOpacity>
          ) : (
            titleContent
          )}
        </View>

        <View style={styles.actionsRow}>
          {((activeTab === 'chat' || !activeTab) && (onPressNewChat || onPressHistory)) ? (
            <Animated.View
              style={[
                styles.chatActionsGroup,
                activeTab ? {
                  opacity: tabTransition.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
                  transform: [
                    { scale: tabTransition.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
                    { translateX: tabTransition.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
                  ],
                } : undefined,
              ]}
              pointerEvents={activeTab === 'chat' || !activeTab ? 'auto' : 'none'}
            >
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
            </Animated.View>
          ) : (
            contextualActions
          )}

          <TouchableOpacity
            style={[
              styles.actionBtn,
              {
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.outlineVariant,
              },
            ]}
            onPress={toggleTheme}
            activeOpacity={0.7}
            hitSlop={tokens.hitSlop.sm}
            accessibilityLabel={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          >
            <MaterialIcons
              name={isDark ? 'light-mode' : 'dark-mode'}
              size={18}
              color={colors.onSurface}
            />
          </TouchableOpacity>

          {user && (
            <TouchableOpacity
              style={[
                styles.userAvatar,
                {
                  backgroundColor: colors.surfaceContainerHighest,
                  borderColor: colors.outlineVariant,
                },
              ]}
              onPress={onPressProfile}
              activeOpacity={0.75}
              accessibilityLabel="Perfil e Configurações"
              hitSlop={tokens.hitSlop.sm}
            >
              <Text style={[styles.avatarText, { color: colors.onSurface }]}>
                {firstName.charAt(0).toUpperCase()}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

export const TopAppBar = Header;

const styles = StyleSheet.create({
  // Top App Bar Compacta: 50dp de altura para maior respiro vertical
  header: {
    height: 50,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.md,
    backgroundColor: tokens.colors.surface,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  titleColumn: {
    minHeight: 38,
    justifyContent: 'center',
    position: 'relative',
    minWidth: 145,
  },
  titleCrossfadeLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    right: 0,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  brand: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '500',
    letterSpacing: 0.1,
    marginTop: 0,
    paddingBottom: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  chatActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontWeight: '700',
    fontSize: 12,
  },
});
