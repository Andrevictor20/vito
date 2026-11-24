import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ProtoUiIcon } from '../../../../icons/ProtoUiIcons';
import { BrandLogo } from '../../../../icons/IconRegistry';
import { tabularNumbers } from '../../../../theme/tokens';
import { useTheme } from '../../../../context/ThemeContext';
import { hapticFeedback } from '../../../../theme/motion';
import { CountUpText } from '../../../../theme/vitoMotion';
import type { FinanceAccount, FinanceConnection } from '../../types/finance';
import { getBankBrand, partitionBankAccounts } from '../../utils/bankBrands';
import { formatBRL, maskBRL, withHexAlpha } from '../shared/financeHelpers';

interface FinanceHeroAndRailProps {
  totalBalance: number;
  monthSurplus: number;
  connectionsCount: number;
  accounts: FinanceAccount[];
  connections: FinanceConnection[];
  isPrivacyHidden: boolean;
  onPressConnections: () => void;
  onPressAddBank: () => void;
  onSelectAccount: (account: FinanceAccount) => void;
}

const MONTH_NAMES_LOWER = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function resolveBankIconId(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('nubank') || n.includes('nu ')) return 'Nubank';
  if (n.includes('itaú') || n.includes('itau')) return 'Itaú';
  if (n.includes('inter')) return 'Inter';
  if (n.includes('brasil') || n === 'bb') return 'Banco do Brasil';
  if (n.includes('bradesco')) return 'Bradesco';
  if (n.includes('santander')) return 'Santander';
  if (n.includes('c6')) return 'C6 Bank';
  if (n.includes('caixa')) return 'Caixa';
  return name;
}

export const FinanceHeroAndRail: React.FC<FinanceHeroAndRailProps> = ({
  totalBalance,
  monthSurplus,
  connectionsCount,
  accounts,
  connections,
  isPrivacyHidden,
  onPressConnections,
  onPressAddBank,
  onSelectAccount,
}) => {
  const { colors } = useTheme();
  const { bankAccounts } = partitionBankAccounts(accounts);
  const currentMonth = MONTH_NAMES_LOWER[new Date().getMonth()];

  const effectiveCount = Math.max(
    connectionsCount,
    new Set(bankAccounts.map((a) => a.institution_name).filter(Boolean)).size
  );
  const updatedCount =
    connections.length > 0
      ? connections.filter((c) => c.status === 'UPDATED').length
      : effectiveCount;
  const pendingCount = Math.max(0, connections.length - updatedCount);

  const isAccountOutdated = (acc: FinanceAccount): boolean => {
    const conn = connections.find(
      (c) => c.id === acc.connection_id || c.institution_name === acc.institution_name
    );
    return Boolean(conn && conn.status !== 'UPDATED');
  };

  const surplusPositive = monthSurplus >= 0;

  return (
    <View>
      {/* Bloco 1: .fx-hero (saldo aberto sem borda + pill delta + status sync) */}
      <View style={styles.hero}>
        <Text style={[styles.lab, { color: colors.muted }]}>Saldo em contas</Text>
        <CountUpText
          value={totalBalance}
          decimals={2}
          prefix="R$ "
          privacyHidden={isPrivacyHidden}
          maskedText="R$ •••••"
          style={[styles.sal, tabularNumbers, { color: colors.ink }]}
        />

        <View style={styles.metaRow}>
          <View
            style={[
              styles.deltaPill,
              { backgroundColor: surplusPositive ? colors.greenBg : colors.redBg },
            ]}
          >
            <ProtoUiIcon
              name="trending-up"
              size={14}
              color={surplusPositive ? colors.acc : colors.red}
            />
            <Text
              style={[
                styles.deltaText,
                tabularNumbers,
                { color: surplusPositive ? colors.acc : colors.red },
              ]}
            >
              {isPrivacyHidden
                ? 'R$ ••••'
                : `${surplusPositive ? '+' : '−'}${formatBRL(monthSurplus, 0)}`}{' '}
              em {currentMonth}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.syncRow}
            onPress={() => {
              hapticFeedback.light();
              onPressConnections();
            }}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.syncDot,
                { backgroundColor: pendingCount > 0 ? colors.orange : colors.acc },
              ]}
            />
            <Text style={[styles.syncText, { color: colors.muted }]}>
              {pendingCount > 0
                ? `${updatedCount} de ${connections.length} bancos atualizados`
                : 'Atualizado agora'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bloco 3: .fx-rail (carrossel horizontal de contas + botão + Adicionar banco) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.railContent}
        style={styles.rail}
      >
        {bankAccounts.map((acc, idx) => {
          const brand = getBankBrand(acc.institution_name);
          const outdated = isAccountOutdated(acc);
          const sharePct =
            totalBalance > 0
              ? Math.round((Math.max(0, acc.balance) / totalBalance) * 100)
              : 0;
          const bankIconId = resolveBankIconId(acc.institution_name || brand.name);

          return (
            <TouchableOpacity
              key={acc.id || acc.pluggy_account_id || `acc_${idx}`}
              style={[
                styles.accCard,
                { backgroundColor: colors.surf },
                outdated && {
                  borderWidth: 1.5,
                  borderColor: withHexAlpha(colors.red, 0.45),
                },
              ]}
              onPress={() => {
                hapticFeedback.light();
                if (outdated) {
                  onPressConnections();
                } else {
                  onSelectAccount(acc);
                }
              }}
              activeOpacity={0.78}
              accessibilityLabel={`${brand.name}${outdated ? ', precisa reconectar' : ''}`}
            >
              <View style={[styles.bankAvatar, { backgroundColor: brand.color }]}>
                <BrandLogo group="bank" id={bankIconId} size={22} color={brand.textColor} />
                {!bankIconId && (
                  <Text style={[styles.bankInitials, { color: brand.textColor }]}>
                    {brand.initials}
                  </Text>
                )}
              </View>

              <Text style={[styles.accName, { color: colors.muted }]} numberOfLines={1}>
                {acc.name || brand.name}
              </Text>
              <CountUpText
                value={acc.balance}
                decimals={2}
                prefix="R$ "
                delayMs={180 + idx * 55}
                privacyHidden={isPrivacyHidden}
                maskedText="R$ ••••"
                numberOfLines={1}
                style={[styles.accVal, tabularNumbers, { color: colors.ink }]}
              />
              <Text
                style={[
                  styles.accSub,
                  { color: outdated ? colors.red : colors.muted, fontWeight: outdated ? '600' : '400' },
                ]}
              >
                {outdated ? 'Reconectar' : `${sharePct}% do saldo`}
              </Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={[styles.accCard, styles.addCard, { borderColor: colors.line }]}
          onPress={() => {
            hapticFeedback.light();
            onPressAddBank();
          }}
          activeOpacity={0.78}
          accessibilityLabel="Adicionar banco"
        >
          <View style={[styles.plusCircle, { backgroundColor: colors.surf }]}>
            <ProtoUiIcon name="add" size={20} color={colors.ink} />
          </View>
          <Text style={[styles.addLabel, { color: colors.muted }]}>Adicionar banco</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  hero: {
    paddingTop: 14,
    paddingHorizontal: 2,
  },
  lab: {
    fontFamily: 'Geist_500Medium',
    fontSize: 14,
  },
  sal: {
    fontFamily: 'Geist_500Medium',
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -2,
    marginTop: 8,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  deltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  deltaText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  syncDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  syncText: {
    fontFamily: 'Geist',
    fontSize: 13,
  },
  rail: {
    marginHorizontal: -20,
    marginTop: 18,
  },
  railContent: {
    paddingHorizontal: 20,
    gap: 10,
  },
  accCard: {
    width: 156,
    padding: 14,
    borderRadius: 22,
    alignItems: 'flex-start',
  },
  bankAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  bankInitials: {
    fontSize: 12,
    fontWeight: '700',
  },
  accName: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13.5,
  },
  accVal: {
    fontFamily: 'Geist_500Medium',
    fontSize: 19,
    letterSpacing: -0.6,
    marginTop: 2,
  },
  accSub: {
    fontFamily: 'Geist',
    fontSize: 12.5,
    marginTop: 6,
  },
  addCard: {
    width: 128,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
  },
  plusCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLabel: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13.5,
    textAlign: 'center',
  },
});
