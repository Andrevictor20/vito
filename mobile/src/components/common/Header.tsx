import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { tokens } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  onPressProfile?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onPressProfile }) => {
  const { user } = useAuth();

  const todayStr = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });

  const formattedDate = todayStr.charAt(0).toUpperCase() + todayStr.slice(1);
  const firstName = user?.name ? user.name.split(' ')[0] : 'Usuário';

  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <View style={styles.brandRow}>
          <Text style={styles.brand}>vito</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>AI</Text>
          </View>
        </View>

        {user && (
          <TouchableOpacity
            style={styles.userAvatar}
            onPress={onPressProfile}
            activeOpacity={0.7}
            accessibilityLabel="Perfil e Configurações"
            hitSlop={tokens.hitSlop.sm}
          >
            <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.greetingRow}>
        <Text style={styles.greeting}>Olá, {firstName} 👋</Text>
        <Text style={styles.date}>{formattedDate}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.surfaceBorder,
    backgroundColor: tokens.colors.bg,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brand: {
    fontSize: 22,
    fontWeight: '800',
    color: tokens.colors.textPrimary,
    letterSpacing: -0.5,
  },
  badge: {
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: tokens.radii.sm,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: tokens.colors.textPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  greetingRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  greeting: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.textPrimary,
    letterSpacing: -0.2,
  },
  date: {
    fontSize: 12,
    color: tokens.colors.textMuted,
    fontWeight: '500',
  },
});
