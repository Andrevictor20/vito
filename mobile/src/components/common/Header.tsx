import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { VitoMascot } from './VitoMascot';

interface HeaderProps {
  onPressProfile?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onPressProfile }) => {
  const { user } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();

  const todayStr = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const formattedDate = todayStr.toUpperCase();
  const firstName = user?.name ? user.name.split(' ')[0] : 'Usuário';

  return (
    <View style={[styles.header, { backgroundColor: colors.surface }]}>
      <View style={styles.topRow}>
        <View style={styles.titleColumn}>
          <Text style={[styles.dateSubtitle, { color: colors.textMuted }]}>{formattedDate}</Text>
          <View style={styles.brandRow}>
            <VitoMascot size={26} style={{ marginRight: 6 }} />
            <Text style={[styles.brand, { color: colors.onSurface }]}>Vito Events</Text>
            <View style={[styles.statusDot, { backgroundColor: colors.statusOnline }]} />
          </View>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.themeToggleBtn, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}
            onPress={toggleTheme}
            activeOpacity={0.7}
            hitSlop={tokens.hitSlop.sm}
            accessibilityLabel={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          >
            <MaterialIcons
              name={isDark ? 'light-mode' : 'dark-mode'}
              size={20}
              color={colors.onSurface}
            />
          </TouchableOpacity>

          {user && (
            <TouchableOpacity
              style={[styles.userAvatar, { backgroundColor: colors.surfaceContainerHighest, borderColor: colors.outlineVariant }]}
              onPress={onPressProfile}
              activeOpacity={0.75}
              accessibilityLabel="Perfil e Configurações"
              hitSlop={tokens.hitSlop.sm}
            >
              <Text style={[styles.avatarText, { color: colors.onSurface }]}>{firstName.charAt(0).toUpperCase()}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // M3 Top App Bar
  header: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing.md,
    backgroundColor: tokens.colors.surface,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleColumn: {
    flexDirection: 'column',
    gap: 2,
  },
  dateSubtitle: {
    fontSize: tokens.typography.size.labelSmall,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.colors.textMuted,
    letterSpacing: 0.8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brand: {
    fontSize: tokens.typography.size.headlineSmall,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.colors.onSurface,
    letterSpacing: -0.3,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.colors.statusOnline,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  themeToggleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.primary,
    borderWidth: 2,
    borderColor: tokens.colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: tokens.colors.onPrimary,
    fontWeight: tokens.typography.weight.bold,
    fontSize: tokens.typography.size.titleSmall,
  },
});
