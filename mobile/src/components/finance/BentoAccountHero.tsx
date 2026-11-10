import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';
import type { FinanceAccount } from '../../types/finance';
import { getBankBrand, BankBrand } from '../../utils/bankBrands';

interface BentoAccountHeroProps {
  totalBalance: number;
  connectionsCount: number;
  accounts?: FinanceAccount[];
  isPrivacyHidden: boolean;
  onPressManage?: () => void;
  onSelectAccount?: (account: FinanceAccount) => void;
}

export const BentoAccountHero: React.FC<BentoAccountHeroProps> = ({
  totalBalance,
  connectionsCount,
  accounts = [],
  isPrivacyHidden,
  onPressManage,
  onSelectAccount,
}) => {
  const { colors } = useTheme();
  const [isExpanded, setIsExpanded] = useState(true);

  const formatBRL = (val: number) =>
    `R$ ${Math.abs(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Filtra apenas contas de saldo bancário (depósito, corrente, poupança, investimento)
  const bankAccounts = accounts.filter(
    (a) => a.account_type === 'BANK' || !a.account_type
  );

  // Instituições bancárias distintas
  const distinctInstitutions = Array.from(
    new Set(
      bankAccounts.map((a) => a.institution_name || 'Nubank').filter(Boolean)
    )
  );

  const toggleExpand = () => {
    hapticFeedback.selection();
    setIsExpanded((prev) => !prev);
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surf,
          borderColor: colors.line,
        },
      ]}
    >
      {/* Top Header Row do Card */}
      <View style={styles.topRow}>
        <View style={styles.institutionsRow}>
          {distinctInstitutions.length <= 1 ? (
            <View style={styles.singleBankBadge}>
              {(() => {
                const brand = getBankBrand(distinctInstitutions[0] || 'Nubank');
                return (
                  <>
                    <View style={[styles.bankLogoCircle, { backgroundColor: brand.color }]}>
                      <Text style={[styles.bankLogoText, { color: brand.textColor }]}>
                        {brand.initials}
                      </Text>
                    </View>
                    <Text style={[styles.bankNameText, { color: colors.ink }]}>
                      {brand.name}
                    </Text>
                  </>
                );
              })()}
            </View>
          ) : (
            <View style={styles.multiBankBadge}>
              <View style={styles.overlappingCircles}>
                {distinctInstitutions.slice(0, 3).map((inst, idx) => {
                  const brand = getBankBrand(inst);
                  return (
                    <View
                      key={inst + idx}
                      style={[
                        styles.bankLogoCircle,
                        {
                          backgroundColor: brand.color,
                          marginLeft: idx > 0 ? -8 : 0,
                          borderWidth: 2,
                          borderColor: colors.surf,
                          zIndex: 10 - idx,
                        },
                      ]}
                    >
                      <Text style={[styles.bankLogoText, { color: brand.textColor }]}>
                        {brand.initials}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <Text style={[styles.bankNameText, { color: colors.ink }]}>
                {distinctInstitutions.length} bancos conectados
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.manageBtn}
          onPress={onPressManage}
          hitSlop={tokens.hitSlop.sm}
          accessibilityLabel="Gerenciar conexões bancárias"
        >
          <MaterialIcons name="chevron-right" size={20} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {/* Saldo Consolidado */}
      <Text style={[styles.titleLabel, { color: colors.muted }]}>
        {bankAccounts.length > 1 ? 'Saldo consolidado em contas' : 'Saldo em contas'}
      </Text>
      <Text style={[styles.balanceValue, { color: colors.ink }]}>
        {isPrivacyHidden ? '••••••' : formatBRL(totalBalance)}
      </Text>

      {/* Lista organizada de 2 ou mais contas */}
      {bankAccounts.length >= 2 && (
        <View style={styles.accountsSection}>
          <TouchableOpacity
            style={styles.accountsSectionHeader}
            onPress={toggleExpand}
            activeOpacity={0.7}
          >
            <Text style={[styles.sectionHeading, { color: colors.muted }]}>
              CONTAS ATIVAS ({bankAccounts.length})
            </Text>
            <MaterialIcons
              name={isExpanded ? 'expand-less' : 'expand-more'}
              size={18}
              color={colors.muted}
            />
          </TouchableOpacity>

          {isExpanded && (
            <View style={[styles.accountsList, { borderTopColor: colors.line }]}>
              {bankAccounts.map((acc, index) => {
                const brand = getBankBrand(acc.institution_name);
                const isSavings =
                  acc.account_subtype === 'SAVINGS_ACCOUNT' ||
                  acc.name?.toLowerCase().includes('reserva') ||
                  acc.name?.toLowerCase().includes('caixinha') ||
                  acc.name?.toLowerCase().includes('poupança');
                const percentShare = totalBalance > 0
                  ? Math.round((Math.max(0, acc.balance) / totalBalance) * 100)
                  : 0;

                return (
                  <TouchableOpacity
                    key={acc.id || acc.pluggy_account_id || `acc_${index}`}
                    style={[
                      styles.accountItemRow,
                      index > 0 && { borderTopWidth: 1, borderTopColor: colors.line },
                    ]}
                    onPress={() => onSelectAccount?.(acc)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.itemLogoCircle, { backgroundColor: brand.color }]}>
                      <Text style={[styles.itemLogoText, { color: brand.textColor }]}>
                        {brand.initials}
                      </Text>
                    </View>

                    <View style={styles.itemInfoCol}>
                      <Text style={[styles.itemAccountName, { color: colors.ink }]} numberOfLines={1}>
                        {acc.name || (isSavings ? 'Reserva Financeira' : 'Conta Corrente')}
                      </Text>
                      <Text style={[styles.itemSubtype, { color: colors.muted }]}>
                        {brand.name} • {isSavings ? 'Poupança / Reserva' : 'Conta corrente'}
                      </Text>
                    </View>

                    <View style={styles.itemBalanceCol}>
                      <Text style={[styles.itemBalanceText, { color: colors.ink }]}>
                        {isPrivacyHidden ? '••••••' : formatBRL(acc.balance)}
                      </Text>
                      {totalBalance > 0 && (
                        <Text style={[styles.itemShareText, { color: colors.muted }]}>
                          {percentShare}% do saldo
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* Footer com Status de Sincronização */}
      <View style={styles.footerRow}>
        <View style={[styles.statusPill, { backgroundColor: colors.bg, borderColor: colors.line }]}>
          <View style={styles.activeDot} />
          <Text style={[styles.footerText, { color: colors.muted }]}>
            {connectionsCount > 0
              ? `${connectionsCount} ${connectionsCount === 1 ? 'banco conectado' : 'bancos conectados'}`
              : 'Conectar banco'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.addAccountLink}
          onPress={onPressManage}
          activeOpacity={0.7}
        >
          <MaterialIcons name="add" size={14} color={colors.accent || '#10B981'} />
          <Text style={[styles.addAccountLinkText, { color: colors.accent || '#10B981' }]}>
            Adicionar banco
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    marginBottom: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  institutionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  singleBankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  multiBankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  overlappingCircles: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bankLogoCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankLogoText: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: tokens.typography.family.montserratBold,
  },
  bankNameText: {
    fontSize: 13,
    fontWeight: '600',
  },
  manageBtn: {
    padding: 4,
  },
  titleLabel: {
    fontSize: 12.5,
    fontWeight: '500',
    marginBottom: 4,
  },
  balanceValue: {
    fontFamily: tokens.typography.family.montserratBold,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginBottom: 14,
  },
  accountsSection: {
    marginBottom: 14,
  },
  accountsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginBottom: 4,
  },
  sectionHeading: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  accountsList: {
    borderTopWidth: 1,
    marginTop: 4,
  },
  accountItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  itemLogoCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  itemLogoText: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: tokens.typography.family.montserratBold,
  },
  itemInfoCol: {
    flex: 1,
    marginRight: 8,
  },
  itemAccountName: {
    fontSize: 13,
    fontWeight: '600',
  },
  itemSubtype: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '400',
  },
  itemBalanceCol: {
    alignItems: 'flex-end',
  },
  itemBalanceText: {
    fontFamily: tokens.typography.family.montserratBold,
    fontSize: 13.5,
    fontWeight: '700',
  },
  itemShareText: {
    fontSize: 10.5,
    marginTop: 2,
    fontWeight: '500',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
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
  addAccountLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  addAccountLinkText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
