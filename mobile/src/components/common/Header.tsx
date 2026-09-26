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
  const isCloud = serverUrl.includes('kito.rasppi.cloud');

  const todayStr = new Date().toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <View style={styles.header}>
      <View>
        <View style={styles.brandRow}>
          <Text style={styles.brand}>vito</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>AI</Text>
          </View>
        </View>
        <Text style={styles.date}>{todayStr.toUpperCase()}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.serverPill} onPress={onToggleServer}>
          <View style={[styles.dot, isCloud ? styles.dotCloud : styles.dotLocal]} />
          <Text style={styles.serverText}>{isCloud ? 'Cloudflare' : 'Local'}</Text>
        </TouchableOpacity>

        {user && (
          <TouchableOpacity style={styles.userAvatar} onPress={logout} accessibilityLabel="Sair">
            <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.surfaceBorder,
    backgroundColor: tokens.colors.bg,
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
  date: {
    fontSize: 11,
    color: tokens.colors.textMuted,
    marginTop: 2,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  serverPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tokens.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tokens.radii.full,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotLocal: { backgroundColor: tokens.colors.success },
  dotCloud: { backgroundColor: tokens.colors.accent },
  serverText: {
    fontSize: 11,
    color: tokens.colors.textSecondary,
    fontWeight: '600',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: tokens.colors.textPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
});
