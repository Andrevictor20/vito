import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, tabularNumbers } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';
import type { FinanceAccount, FinanceConnection } from '../../types/finance';
import { getBankBrand, partitionBankAccounts } from '../../utils/bankBrands';
import { formatBRL, maskBRL } from './financeHelpers';

interface BentoAccountHeroProps {
  totalBalance: number;
  connectionsCount: number;
  accounts?: FinanceAccount[];
  connections?: FinanceConnection[];
  isPrivacyHidden: boolean;
  onPressConnections?: () => void;
  onPressAddBank?: () => void;
  onSelectAccount?: (account: FinanceAccount) => void;
}

export const BentoAccountHero: React.FC<BentoAccountHeroProps> = ({
  totalBalance,
  connectionsCount,
  accounts = [],
  connections = [],
  isPrivacyHidden,
  onPressConnections,
  onPressAddBank,
  onSelectAccount,
}) => {
  const { colors } = useTheme();
  const [isExpanded, setIsExpanded] = useState(true);

  const { bankAccounts } = partitionBankAccounts(accounts);
  const distinctInstitutions = Array.from(
    new Set(bankAccounts.map((a) => a.institution_name).filter(Boolean))
  );

  const effectiveCount = Math.max(connectionsCount, distinctInstitutions.length);
  const updatedCount =
    connections.length > 0
      ? connections.filter((c) => c.status === 'UPDATED').length
      : effectiveCount;
  const allUpdated = connections.length === 0 || updatedCount === connections.length;

  const isConnectionOutdated = (acc: FinanceAccount): boolean => {
    const conn = connections.find(
      (c) => c.id === acc.connection_id || c.institution_name === acc.institution_name
    );
    return Boolean(conn && conn.status !== 'UPDATED');
  };

  const toggleExpand = () => {
    hapticFeedback.selection();
    setIsExpanded((prev) => !prev);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.bg, borderColor: colors.line }]}>
      {/* Top row: avatares sobrepostos + N bancos conectados + chevron (abre sub-tela conn) */}
      <TouchableOpacity
        style={styles.topRow}
        onPress={() => {
          hapticFeedback.light();
          onPressConnections?.();
        }}
        activeOpacity={0.75}
        accessibilityLabel="Ver contas conectadas"
      >
        <View style={styles.institutionsRow}>
          {distinctInstitutions.length > 0 ? (
            <View style={styles.overlappingCircles}>
              {distinctInstitutions.slice(0, 4).map((inst, idx) => {
                const brand = getBankBrand(inst);
                return (
                  <View
                    key={`${inst}_${idx}`}
                    style={[
                      styles.avatarSmall,
                      {
                        backgroundColor: brand.color,
                        marginLeft: idx > 0 ? -6 : 0,
                        borderColor: colors.bg,
                        zIndex: 10 - idx,
                      },
                    ]}
                  >
                    <Text style={[styles.avatarSmallText, { color: brand.textColor }]}>
                      {brand.initials}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: colors.finBg }]}>
              <MaterialIcons name="account-balance" size={16} color={colors.fin} />
            </View>
          )}
          <Text style={[styles.topLabel, { color: colors.ink }]}>
            {effectiveCount > 0
              ? `${effectiveCount} ${effectiveCount === 1 ? 'banco conectado' : 'bancos conectados'}`
              : 'Nenhuma conta conectada'}
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={18} color={colors.muted} />
      </TouchableOpacity>

      {/* Saldo consolidado */}
      <Text style={[styles.balanceCaption, { color: colors.muted }]}>
        Saldo consolidado em contas
      </Text>
      <Text style={[styles.balanceValue, tabularNumbers, { color: colors.ink }]}>
        {maskBRL(isPrivacyHidden, formatBRL(totalBalance))}
      </Text>

      {/* Acordeão CONTAS ATIVAS (N) */}
      {bankAccounts.length > 0 && (
        <View style={styles.accountsSection}>
          <TouchableOpacity
            style={[styles.accordionHeader, { borderTopColor: colors.line }]}
            onPress={toggleExpand}
            activeOpacity={0.7}
            accessibilityState={{ expanded: isExpanded }}
          >
            <Text style={[styles.accordionTitle, { color: colors.muted }]}>
              CONTAS ATIVAS ({bankAccounts.length})
            </Text>
            <MaterialIcons
              name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
              size={18}
              color={colors.muted}
            />
          </TouchableOpacity>

          {isExpanded &&
            bankAccounts.map((acc, index) => {
              const brand = getBankBrand(acc.institution_name);
              const isSavings =
                acc.account_subtype === 'SAVINGS_ACCOUNT' ||
                /reserva|caixinha|poupança/i.test(acc.name || '');
              const percentShare =
                totalBalance > 0
                  ? Math.round((Math.max(0, acc.balance) / totalBalance) * 100)
                  : 0;
              const needsReconnect = isConnectionOutdated(acc);

              return (
                <TouchableOpacity
                  key={acc.id || acc.pluggy_account_id || `acc_${index}`}
                  style={[styles.accountRow, { borderTopColor: colors.line }]}
                  onPress={() => onSelectAccount?.(acc)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.avatarBig, { backgroundColor: brand.color }]}>
                    <Text style={[styles.avatarBigText, { color: brand.textColor }]}>
                      {brand.initials}
                    </Text>
                  </View>

                  <View style={styles.accountInfo}>
                    <Text style={[styles.accountName, { color: colors.ink }]} numberOfLines={1}>
                      {acc.name || (isSavings ? 'Reserva Financeira' : 'Conta corrente')}
                    </Text>
                    <Text style={[styles.accountMeta, { color: colors.muted }]} numberOfLines={1}>
                      {brand.name} · {isSavings ? 'Poupança / Reserva' : 'Conta corrente'}
                    </Text>
                  </View>

                  <View style={styles.accountRight}>
                    <Text style={[styles.accountBalance, tabularNumbers, { color: colors.ink }]}>
                      {maskBRL(isPrivacyHidden, formatBRL(acc.balance))}
                    </Text>
                    {needsReconnect ? (
                      <View style={[styles.reconnectPill, { backgroundColor: colors.finBg }]}>
                        <Text style={[styles.reconnectText, { color: colors.fin }]}>Reconectar</Text>
                      </View>
                    ) : totalBalance > 0 ? (
                      <Text style={[styles.shareText, { color: colors.muted }]}>
                        {percentShare}% do saldo
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
        </View>
      )}

      {/* Rodapé: pill de status + "+ Adicionar banco" */}
      <View style={styles.footerRow}>
        <View style={[styles.statusPill, { backgroundColor: colors.bg, borderColor: colors.line }]}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: allUpdated ? colors.acc : colors.orange },
            ]}
          />
          <Text style={[styles.statusPillText, { color: colors.ink }]}>
            {connections.length > 0 && !allUpdated
              ? `${updatedCount} de ${connections.length} atualizados`
              : `${effectiveCount} ${effectiveCount === 1 ? 'banco conectado' : 'bancos conectados'}`}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.addBankBtn}
          onPress={() => {
            hapticFeedback.light();
            onPressAddBank?.();
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.addBankText, { color: colors.ink }]}>+ Adicionar banco</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  institutionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  overlappingCircles: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSmallText: {
    fontSize: 11,
    fontWeight: '700',
  },
  avatarFallback: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topLabel: {
    fontSize: 15.5,
    fontWeight: '600',
  },
  balanceCaption: {
    fontSize: 12.5,
    fontWeight: '500',
    marginTop: 14,
  },
  balanceValue: {
    fontFamily: tokens.typography.family.montserratBold,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.9,
    marginTop: 6,
    marginBottom: 14,
  },
  accountsSection: {
    marginBottom: 8,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 14,
    paddingBottom: 6,
  },
  accordionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.7,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  avatarBig: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBigText: {
    fontSize: 13,
    fontWeight: '700',
  },
  accountInfo: {
    flex: 1,
    minWidth: 0,
  },
  accountName: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  accountMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  accountRight: {
    alignItems: 'flex-end',
  },
  accountBalance: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  shareText: {
    fontSize: 11.5,
    marginTop: 2,
  },
  reconnectPill: {
    marginTop: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  reconnectText: {
    fontSize: 11,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: '500',
  },
  addBankBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  addBankText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
