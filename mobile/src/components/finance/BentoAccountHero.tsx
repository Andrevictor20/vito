import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';

interface BentoAccountHeroProps {
  totalBalance: number;
  connectionsCount: number;
  institutionName?: string;
  isPrivacyHidden: boolean;
  onPress?: () => void;
}

export const BentoAccountHero: React.FC<BentoAccountHeroProps> = ({
  totalBalance,
  connectionsCount,
  institutionName = 'Nubank',
  isPrivacyHidden,
  onPress,
}) => {
  const { colors, isDark } = useTheme();

  const formatBRL = (val: number) =>
    `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const isNubank = institutionName.toLowerCase().includes('nu');

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: isDark ? '#18181B' : colors.surf,
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : colors.line,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityLabel={`Saldo em contas: ${formatBRL(totalBalance)}`}
    >
      <View style={styles.topRow}>
        <View style={styles.bankBadge}>
          <View style={[styles.bankLogoCircle, { backgroundColor: isNubank ? '#820AD1' : '#10B981' }]}>
            <Text style={styles.bankLogoText}>{isNubank ? 'nu' : institutionName.slice(0, 2).toUpperCase()}</Text>
          </View>
          <Text style={[styles.bankNameText, { color: colors.ink }]}>{institutionName}</Text>
        </View>
        <MaterialIcons name="chevron-right" size={20} color={colors.muted} />
      </View>

      <Text style={[styles.titleLabel, { color: colors.muted }]}>Saldo em contas</Text>
      <Text style={[styles.balanceValue, { color: colors.ink }]}>
        {isPrivacyHidden ? '••••••' : formatBRL(totalBalance)}
      </Text>

      <View style={styles.footerRow}>
        <View style={[styles.statusPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
          <View style={styles.activeDot} />
          <Text style={[styles.footerText, { color: colors.muted }]}>
            {connectionsCount > 0
              ? `${connectionsCount} ${connectionsCount === 1 ? 'conta conectada' : 'contas conectadas'}`
              : 'Conectar banco'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    marginBottom: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  bankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bankLogoCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankLogoText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: tokens.typography.family.montserratBold,
  },
  bankNameText: {
    fontSize: 13,
    fontWeight: '600',
  },
  titleLabel: {
    fontSize: 12.5,
    fontWeight: '500',
    marginBottom: 4,
  },
  balanceValue: {
    fontFamily: tokens.typography.family.montserratBold,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginBottom: 12,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  footerText: {
    fontSize: 11.5,
    fontWeight: '500',
  },
});
