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
          <View style={styles.brandDot} />
        </View>

        {user && (
          <TouchableOpacity
            style={styles.userAvatar}
            onPress={onPressProfile}
            activeOpacity={0.75}
            accessibilityLabel="Perfil e Configurações"
            hitSlop={tokens.hitSlop.sm}
          >
            <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
          </TouchableOpacity>
        )}
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
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.outlineVariant,
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
    gap: 6,
  },
  brand: {
    fontSize: tokens.typography.size.titleLarge,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.colors.onSurface,
    letterSpacing: -0.5,
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.colors.primary,
  },
  userAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: tokens.colors.secondaryContainer,
    borderWidth: 1,
    borderColor: tokens.colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: tokens.colors.onSecondaryContainer,
    fontWeight: tokens.typography.weight.bold,
    fontSize: tokens.typography.size.labelMedium,
  },
});
