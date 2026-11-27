import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ProtoUiIcon } from '../../../../icons/ProtoUiIcons';
import { ProtoRingChart } from '../../../../charts/ProtoRingChart';
import { tabularNumbers } from '../../../../theme/tokens';
import { useTheme } from '../../../../context/ThemeContext';
import { hapticFeedback } from '../../../../theme/motion';
import { AnimatedSegmentedBar, CountUpText } from '../../../../theme/vitoMotion';
import type { FinanceAccount, FinanceSubScreenKey, FinancialSummary } from '../../types/finance';
import { getBankBrand } from '../../utils/bankBrands';
import {
  computeCreditCardStats,
  formatBRL,
  getCategoryAmount,
  hasSubscriptionIncrease,
  maskBRL,
  withHexAlpha,
} from '../../utils/financeHelpers';
import {
  FinanceBankBadge,
  resolveCategoryVisual,
} from '../shared/FinanceSemanticIcons';

interface FinanceMonthAndCardsProps {
  summary: FinancialSummary;
  accounts: FinanceAccount[];
  isPrivacyHidden: boolean;
  onOpenSubScreen: (key: FinanceSubScreenKey) => void;
  onPressSafeToSpend: () => void;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const FinanceMonthAndCards: React.FC<FinanceMonthAndCardsProps> = ({
  summary,
  accounts,
  isPrivacyHidden,
  onOpenSubScreen,
  onPressSafeToSpend,
}) => {
  const { colors, isDark } = useTheme();
  const monthName = MONTH_NAMES[new Date().getMonth()];

  const monthIncome = summary.month_income ?? 0;
  const monthExpenses = summary.month_expenses ?? summary.monthly_spend_actual ?? 0;
  const leftover = monthIncome - monthExpenses;
  const topCats = summary.category_spending.slice(0, 3);

  const subscriptionsTotal = summary.subscriptions.reduce((acc, s) => acc + (s.amount || 0), 0);
  const subscriptionsCount = summary.subscriptions.length;
  const priceIncreaseCount = summary.subscriptions.filter(hasSubscriptionIncrease).length;

  const creditStats = computeCreditCardStats(accounts, summary);
  const ringColor =
    creditStats.usedPercent >= 85
      ? colors.red
      : creditStats.usedPercent >= 60
        ? colors.orange
        : colors.acc;

  const lastDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const monthNum = String(new Date().getMonth() + 1).padStart(2, '0');

  return (
    <View>
      {/* Bloco 4: .fx-card do Mês (Entradas/Saídas + barra segmentada + top 3 categorias + Sobra no mês) */}
      <View style={[styles.fxCard, { backgroundColor: colors.surf }]}>
        <TouchableOpacity
          style={styles.fxHd}
          onPress={() => {
            hapticFeedback.light();
            onOpenSubScreen('spend');
          }}
          activeOpacity={0.75}
        >
          <View style={styles.fxTtl}>
            <View style={[styles.fxIc, { backgroundColor: withHexAlpha(colors.blue, 0.14) }]}>
              <ProtoUiIcon name="trending-up" size={18} color={colors.blue} />
            </View>
            <Text style={[styles.fxHdTitle, { color: colors.ink }]}>{monthName}</Text>
          </View>
          <View style={styles.fxHdRight}>
            <Text style={[styles.fxHdLink, { color: colors.muted }]}>Ver gastos</Text>
            <ProtoUiIcon name="chevron-right" size={16} color={colors.muted} />
          </View>
        </TouchableOpacity>

        <View style={styles.fxIo}>
          <View style={styles.fxIoCol}>
            <Text style={[styles.fxIoLabel, { color: colors.muted }]}>Entradas</Text>
            <CountUpText
              value={monthIncome}
              decimals={0}
              prefix="R$ "
              privacyHidden={isPrivacyHidden}
              style={[styles.fxIoVal, tabularNumbers, { color: colors.acc }]}
            />
          </View>
          <View style={styles.fxIoCol}>
            <Text style={[styles.fxIoLabel, { color: colors.muted }]}>Saídas</Text>
            <CountUpText
              value={monthExpenses}
              decimals={0}
              prefix="R$ "
              delayMs={180}
              privacyHidden={isPrivacyHidden}
              style={[styles.fxIoVal, tabularNumbers, { color: colors.ink }]}
            />
          </View>
        </View>

        <AnimatedSegmentedBar
          style={styles.fxSeg}
          height={10}
          borderRadius={5}
          segmentRadius={4}
          gap={3}
          delayMs={240}
          stepMs={85}
          segments={
            summary.category_spending.length > 0
              ? summary.category_spending.slice(0, 5).map((cat, idx) => ({
                  key: `${cat.category}_${idx}`,
                  flex: Math.max(1, getCategoryAmount(cat)),
                  color: resolveCategoryVisual(cat.category, isDark, idx).color,
                }))
              : [{ key: 'empty', flex: 1, color: colors.line }]
          }
        />

        {topCats.length > 0 && (
          <View style={styles.fxLeg}>
            {topCats.map((cat, idx) => (
              <View key={`${cat.category}_leg_${idx}`} style={styles.fxLegRow}>
                <View
                  style={[
                    styles.fxLegDot,
                    { backgroundColor: resolveCategoryVisual(cat.category, isDark, idx).color },
                  ]}
                />
                <Text style={[styles.fxLegName, { color: colors.ink }]} numberOfLines={1}>
                  {cat.category}
                </Text>
                <Text style={[styles.fxLegVal, tabularNumbers, { color: colors.muted }]}>
                  {maskBRL(isPrivacyHidden, formatBRL(getCategoryAmount(cat), 0))}
                </Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.fxFt, { backgroundColor: colors.bg }]}
          onPress={() => {
            hapticFeedback.light();
            onOpenSubScreen('flow');
          }}
          activeOpacity={0.78}
        >
          <Text style={[styles.fxFtLabel, { color: colors.muted }]}>Sobra no mês</Text>
          <CountUpText
            value={leftover}
            decimals={0}
            prefix="R$ "
            signed
            privacyHidden={isPrivacyHidden}
            style={[
              styles.fxFtVal,
              tabularNumbers,
              { color: leftover >= 0 ? colors.acc : colors.red },
            ]}
          />
          <ProtoUiIcon name="chevron-right" size={16} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {/* Bloco 5: .fx-two (Pode gastar hoje | Assinaturas) */}
      <View style={styles.fxTwo}>
        <TouchableOpacity
          style={[styles.fxT, { backgroundColor: colors.surf }]}
          onPress={onPressSafeToSpend}
          activeOpacity={0.8}
        >
          <View style={[styles.fxTi, { backgroundColor: colors.bg }]}>
            <ProtoUiIcon name="account-balance" size={17} color={colors.acc} />
          </View>
          <Text style={[styles.fxTLabel, { color: colors.muted }]}>Pode gastar hoje</Text>
          <CountUpText
            value={summary.safe_to_spend_daily}
            decimals={0}
            prefix="R$ "
            privacyHidden={isPrivacyHidden}
            style={[styles.fxTVal, tabularNumbers, { color: colors.ink }]}
          />
          <Text style={[styles.fxTSub, { color: colors.muted }]}>
            por dia até {lastDayOfMonth}/{monthNum}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.fxT, { backgroundColor: colors.surf }]}
          onPress={() => {
            hapticFeedback.light();
            onOpenSubScreen('sub');
          }}
          activeOpacity={0.8}
        >
          <View style={[styles.fxTi, { backgroundColor: colors.bg }]}>
            <ProtoUiIcon name="repeat" size={17} color={colors.orange} />
          </View>
          <Text style={[styles.fxTLabel, { color: colors.muted }]}>Assinaturas</Text>
          <CountUpText
            value={subscriptionsTotal}
            decimals={2}
            prefix="R$ "
            delayMs={180}
            privacyHidden={isPrivacyHidden}
            style={[styles.fxTVal, tabularNumbers, { color: colors.ink }]}
          />
          <Text style={[styles.fxTSub, { color: colors.muted }]} numberOfLines={1}>
            {subscriptionsCount} {subscriptionsCount === 1 ? 'serviço' : 'serviços'}
            {priceIncreaseCount > 0 ? (
              <Text style={{ color: colors.orange, fontWeight: '600' }}>
                {' '}· {priceIncreaseCount} reajuste
              </Text>
            ) : null}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Bloco 6: .fx-card Cartões com ProtoRingChart + lista de cartões */}
      <TouchableOpacity
        style={[styles.fxCard, { backgroundColor: colors.surf }]}
        onPress={() => {
          hapticFeedback.light();
          onOpenSubScreen('card');
        }}
        activeOpacity={0.82}
      >
        <View style={styles.fxHd}>
          <View style={styles.fxTtl}>
            <View style={[styles.fxIc, { backgroundColor: withHexAlpha(colors.blue, 0.14) }]}>
              <ProtoUiIcon name="credit-card" size={18} color={colors.blue} />
            </View>
            <Text style={[styles.fxHdTitle, { color: colors.ink }]}>
              Cartões{creditStats.creditAccounts.length > 0 ? ` · ${creditStats.creditAccounts.length}` : ''}
            </Text>
          </View>
          <ProtoUiIcon name="chevron-right" size={16} color={colors.muted} />
        </View>

        <View style={styles.fxCrow}>
          <ProtoRingChart
            pct={isPrivacyHidden ? 0 : creditStats.usedPercent}
            size={76}
            strokeWidth={7}
            color={ringColor}
            label={isPrivacyHidden ? '••%' : `${creditStats.usedPercent}%`}
            animateLabel={!isPrivacyHidden}
            isDark={isDark}
          />
          <View style={styles.fxCb}>
            <Text style={[styles.fxCbLabel, { color: colors.muted }]}>Limite usado</Text>
            <CountUpText
              value={creditStats.totalBill}
              decimals={2}
              prefix="R$ "
              privacyHidden={isPrivacyHidden}
              style={[styles.fxCbVal, tabularNumbers, { color: colors.ink }]}
            />
            <Text style={[styles.fxCbSub, { color: colors.muted }]}>
              <Text style={{ color: colors.acc, fontWeight: '500' }}>
                {isPrivacyHidden ? 'R$ ••••' : formatBRL(creditStats.totalAvailable, 0)} disponíveis
              </Text>
              {creditStats.totalLimit > 0 && !isPrivacyHidden
                ? ` de ${formatBRL(creditStats.totalLimit, 0)}`
                : ''}
            </Text>
          </View>
        </View>

        {creditStats.creditAccounts.length > 0 && (
          <View style={styles.fxCrList}>
            {creditStats.creditAccounts.slice(0, 3).map((card, idx) => {
              const brand = getBankBrand(card.institution_name);
              return (
                <View key={card.id || `card_${idx}`} style={styles.fxCri}>
                  <FinanceBankBadge institutionName={card.institution_name} size={32} rounded />
                  <View style={styles.fxCriBody}>
                    <Text style={[styles.fxCriTitle, { color: colors.ink }]} numberOfLines={1}>
                      {brand.name}
                    </Text>
                    <Text style={[styles.fxCriMeta, tabularNumbers, { color: colors.muted }]}>
                      {maskBRL(isPrivacyHidden, formatBRL(Math.abs(card.balance), 0))}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.fxPill,
                      {
                        backgroundColor: withHexAlpha(
                          creditStats.hasBillAlert ? colors.orange : colors.acc,
                          0.14
                        ),
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.fxPillText,
                        { color: creditStats.hasBillAlert ? colors.orange : colors.acc },
                      ]}
                    >
                      {creditStats.hasBillAlert ? creditStats.dueLabel : 'Em dia'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  fxCard: { marginTop: 14, padding: 16, borderRadius: 24 },
  fxHd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 },
  fxTtl: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fxIc: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  fxHdTitle: { fontFamily: 'Geist_500Medium', fontSize: 16, letterSpacing: -0.2 },
  fxHdRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  fxHdLink: { fontFamily: 'Geist', fontSize: 13 },
  fxIo: { flexDirection: 'row', gap: 12, marginTop: 12 },
  fxIoCol: { flex: 1 },
  fxIoLabel: { fontFamily: 'Geist', fontSize: 12.5 },
  fxIoVal: { fontFamily: 'Geist_500Medium', fontSize: 24, lineHeight: 28, letterSpacing: -0.8, marginTop: 3 },
  fxSeg: { flexDirection: 'row', height: 10, gap: 3, marginTop: 18, borderRadius: 5, overflow: 'hidden' },
  fxSegPiece: { height: '100%', borderRadius: 4 },
  fxLeg: { gap: 9, marginTop: 14 },
  fxLegRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fxLegDot: { width: 8, height: 8, borderRadius: 4 },
  fxLegName: { flex: 1, fontFamily: 'Geist', fontSize: 13.5 },
  fxLegVal: { fontFamily: 'Geist', fontSize: 13.5 },
  fxFt: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginTop: 14, paddingHorizontal: 14, borderRadius: 16 },
  fxFtLabel: { flex: 1, fontFamily: 'Geist_500Medium', fontSize: 14 },
  fxFtVal: { fontFamily: 'Geist_500Medium', fontSize: 14 },
  fxTwo: { flexDirection: 'row', gap: 12, marginTop: 14 },
  fxT: { flex: 1, minWidth: 0, padding: 14, borderRadius: 22, alignItems: 'flex-start' },
  fxTi: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  fxTLabel: { fontFamily: 'Geist', fontSize: 13 },
  fxTVal: { fontFamily: 'Geist_500Medium', fontSize: 22, letterSpacing: -0.6, marginTop: 2 },
  fxTSub: { fontFamily: 'Geist', fontSize: 12.5, marginTop: 4 },
  fxCrow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 14 },
  fxCb: { flex: 1, minWidth: 0 },
  fxCbLabel: { fontFamily: 'Geist', fontSize: 13 },
  fxCbVal: { fontFamily: 'Geist_500Medium', fontSize: 24, lineHeight: 28, letterSpacing: -0.8, marginTop: 2 },
  fxCbSub: { fontFamily: 'Geist', fontSize: 12.5, marginTop: 6 },
  fxCrList: { marginTop: 16, gap: 12 },
  fxCri: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cardBadgeText: { fontSize: 10, fontWeight: '700' },
  fxCriBody: { flex: 1, minWidth: 0 },
  fxCriTitle: { fontFamily: 'Geist_500Medium', fontSize: 14 },
  fxCriMeta: { fontFamily: 'Geist', fontSize: 12.5, marginTop: 1 },
  fxPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  fxPillText: { fontFamily: 'Geist_500Medium', fontSize: 12 },
});
