import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { tokens } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  serverUrl: string;
  onToggleServer: () => void;
}

export const Header: React.FC<HeaderProps> = ({ serverUrl, onToggleServer }) => {
  const { user, logout } = useAuth();
  const isCloud = serverUrl.includes('vito.rasppi.cloud');

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

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.serverPill, isCloud ? styles.serverPillCloud : styles.serverPillLocal]}
            onPress={onToggleServer}
            activeOpacity={0.7}
          >
            <View style={[styles.dot, isCloud ? styles.dotCloud : styles.dotLocal]} />
            <Text style={styles.serverText}>{isCloud ? 'Cloudflare' : 'Local Pi'}</Text>
          </TouchableOpacity>

          {user && (
            <TouchableOpacity style={styles.userAvatar} onPress={logout} accessibilityLabel="Sair">
              <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
            </TouchableOpacity>
          )}
        </View>
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serverPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tokens.radii.full,
    borderWidth: 1,
  },
  serverPillCloud: {
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    borderColor: 'rgba(14, 165, 233, 0.25)',
  },
  serverPillLocal: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: 'rgba(34, 197, 94, 0.25)',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotLocal: { backgroundColor: '#22c55e' },
  dotCloud: { backgroundColor: '#0ea5e9' },
  serverText: {
    fontSize: 11,
    color: tokens.colors.textSecondary,
    fontWeight: '600',
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
