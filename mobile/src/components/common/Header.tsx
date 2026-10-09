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
  activeTab?: 'calendar' | 'chat';
  onPressHistory?: () => void;
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
  mascotSize = 34,
  mascotState = 'idle',
  showStatusDot = false,
  statusColor,
  contextualActions,
  showDivider = true,
  onPressProfile,
  onPressTitle,
  activeTab,
  onPressHistory,
}) => {
  const { user } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();

  const firstName = user?.name ? user.name.split(' ')[0] : 'Usuário';
  const effectiveStatusColor = statusColor || colors.statusOnline;

  const tabTransition = useRef(new Animated.Value(activeTab === 'chat' ? 1 : 0)).current;

  useEffect(() => {
    if (activeTab) {
      Animated.timing(tabTransition, {
        toValue: activeTab === 'chat' ? 1 : 0,
        duration: 220,
        easing: Easing.bezier(0.2, 0, 0, 1),
        useNativeDriver: true,
      }).start();
    }
  }, [activeTab]);

  const calendarOpacity = tabTransition.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const calendarTranslateY = tabTransition.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const chatOpacity = tabTransition.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const chatTranslateY = tabTransition.interpolate({ inputRange: [0, 1], outputRange: [4, 0] });

  const titleContent = activeTab ? (
    <View style={styles.titleColumn}>
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
          {onPressHistory ? (
            <Animated.View
              style={{
                opacity: tabTransition.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
                transform: [
                  { scale: tabTransition.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
                  { translateX: tabTransition.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
                ],
              }}
              pointerEvents={activeTab === 'chat' ? 'auto' : 'none'}
            >
              <HeaderIconButton
                icon="forum"
                onPress={onPressHistory}
                accessibilityLabel="Histórico de conversas"
              />
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
  // M3 Top App Bar: 58dp de altura, alinhamento canônico, borda outlineVariant sutil
  header: {
    height: 58,
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
    gap: 10,
    flexShrink: 1,
  },
  titleColumn: {
    minHeight: 38,
    justifyContent: 'center',
    position: 'relative',
    minWidth: 155,
  },
  titleCrossfadeLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brand: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.2,
    marginTop: -1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontWeight: '700',
    fontSize: 14,
  },
});
