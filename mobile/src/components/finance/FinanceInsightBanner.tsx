import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';

interface FinanceInsightBannerProps {
  balance: number;
  isPrivacyHidden: boolean;
  onPressPrompt?: (prompt: string) => void;
}

export const FinanceInsightBanner: React.FC<FinanceInsightBannerProps> = ({
  balance,
  isPrivacyHidden,
  onPressPrompt,
}) => {
  const { colors, isDark } = useTheme();

  const formatBRL = (val: number) =>
    `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const promptText = `Quanto renderia ${formatBRL(balance)} em CDB 100% do CDI em 6 meses?`;

  return (
    <TouchableOpacity
      style={[
        styles.banner,
        {
          backgroundColor: isDark ? '#1C1917' : '#FEF3C7',
          borderColor: isDark ? 'rgba(245, 158, 11, 0.25)' : 'rgba(217, 119, 6, 0.2)',
        },
      ]}
      onPress={() => onPressPrompt?.(promptText)}
      activeOpacity={0.85}
    >
      <View style={styles.leftCol}>
        <View style={styles.titleRow}>
          <MaterialIcons name="trending-up" size={18} color="#F59E0B" />
          <Text style={[styles.title, { color: isDark ? '#FDE68A' : '#92400E' }]}>
            Seu dinheiro parado rende no CDB
          </Text>
        </View>
        <Text style={[styles.desc, { color: isDark ? '#D6D3D1' : '#78350F' }]}>
          {isPrivacyHidden ? '••••••' : formatBRL(balance)} parado na conta corrente poderia render 100% do CDI com liquidez diária.
        </Text>
      </View>
      <View style={styles.actionPill}>
        <Text style={styles.actionPillText}>Simular</Text>
        <MaterialIcons name="arrow-forward" size={13} color="#FFFFFF" />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 18,
    gap: 12,
  },
  leftCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  title: {
    fontFamily: tokens.typography.family.semibold,
    fontSize: 13.5,
    fontWeight: '700',
  },
  desc: {
    fontSize: 12,
    lineHeight: 16,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D97706',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  actionPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
