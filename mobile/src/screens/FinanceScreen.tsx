import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { hapticFeedback } from '../theme/motion';
import { api } from '../services/api';
import { chatPromptBus, dataSync } from '../services/dataSync';
import type { FinancialSummary, FinanceAlert, CategorySpendItem, SubscriptionItem } from '../types/finance';
import { PluggyConnectModal } from './PluggyConnectModal';

const DEFAULT_SUMMARY: FinancialSummary = {
  total_balance: 0,
  open_credit_card_bills: 0,
  safe_to_spend_daily: 0,
  safe_to_spend_total: 0,
  days_remaining_in_month: 0,
  monthly_spend_planned: 0,
  monthly_spend_actual: 0,
  pace_percent: 0,
  month_progress_percent: 0,
  projected_leftover: 0,
  headline_status: 'Nenhuma conta conectada',
  connected_institutions_count: 0,
  attention_alerts: [],
  category_spending: [],
  subscriptions: [],
};

const PROMPT_CHIPS = [
  'Quanto gastei com Uber este mês?',
  'Posso gastar R$ 300 no sábado?',
  'Quero juntar R$ 3.000 até o fim do ano',
  'Qual fatura vence primeiro?',
  'Resumo analítico dos meus gastos',
];

export const FinanceScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const [summary, setSummary] = useState<FinancialSummary>(DEFAULT_SUMMARY);
  const [refreshing, setRefreshing] = useState(false);
  const [connectModalVisible, setConnectModalVisible] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.35, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const loadFinanceSummary = useCallback(async () => {
    try {
      const data: any = await api.finance.getSummary();
      if (data && typeof data === 'object') {
        const totalBalance = data.total_balance ?? data.consolidated_balance ?? 0;
        const openBills = data.open_credit_card_bills ?? data.open_invoices_total ?? 0;
        const daysRemaining = data.days_remaining_in_month ?? data.safe_to_spend_days_remaining ?? 0;
        const safeDaily = data.safe_to_spend_daily ?? 0;
        const monthProgress = data.month_progress_percent ?? data.safe_to_spend_month_percent ?? 0;
        const leftover = data.projected_leftover ?? (totalBalance - openBills);
        const pace = data.pace_percent ?? 0;
        const connCount = data.connected_institutions_count ?? 0;
        const alerts = data.attention_alerts ?? data.alerts ?? [];
        const catSpending = (data.category_spending || []).map((c: any) => ({
          category: c.category,
          amount: c.total_amount ?? c.amount ?? 0,
          percentage: c.percentage ?? 0,
          delta_vs_average_percent: c.delta_percent ?? c.delta_vs_average_percent,
        }));
        const subs = (data.subscriptions || []).map((s: any) => ({
          id: s.id || s.merchant_name || s.name,
          name: s.name || s.merchant_name,
          amount: s.amount ?? 0,
          frequency: s.frequency || 'monthly',
          has_price_increase: s.is_price_increased ?? s.has_price_increase,
          previous_amount: s.previous_amount,
        }));

        let headline = 'Nenhuma conta conectada';
        if (connCount > 0) {
          headline = leftover >= 0 ? 'Você está bem este mês' : 'Atenção com faturas de cartão';
        }

        setSummary({
          total_balance: totalBalance,
          open_credit_card_bills: openBills,
          safe_to_spend_daily: safeDaily,
          safe_to_spend_total: safeDaily * (daysRemaining > 0 ? daysRemaining : 1),
          days_remaining_in_month: daysRemaining,
          monthly_spend_planned: 0,
          monthly_spend_actual: data.month_expenses ?? 0,
          pace_percent: pace,
          month_progress_percent: monthProgress,
          projected_leftover: leftover,
          headline_status: data.headline_status || headline,
          connected_institutions_count: connCount,
          attention_alerts: alerts,
          category_spending: catSpending,
          subscriptions: subs,
        });
      }
    } catch {
      // Estado real mantido
    }
  }, []);

  useEffect(() => {
    loadFinanceSummary();
    const unsub = dataSync.subscribe('refresh_finance', loadFinanceSummary);
    return () => unsub();
  }, [loadFinanceSummary]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    hapticFeedback.light();
    await loadFinanceSummary();
    setRefreshing(false);
  }, [loadFinanceSummary]);

  const handlePromptPress = (prompt: string) => {
    hapticFeedback.selection();
    chatPromptBus.notify(prompt);
  };

  const formatBRL = (val: number) =>
    `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Cabeçalho da Tela com Conexões */}
        <View style={styles.topHeader}>
          <View style={styles.topHeaderTitleCol}>
            <Text style={[styles.mainTitle, { color: colors.ink }]}>Finanças</Text>
            <Text style={[styles.mainSubtitle, { color: colors.muted }]}>
              {summary.connected_institutions_count > 0
                ? `${summary.connected_institutions_count} ${summary.connected_institutions_count === 1 ? 'banco conectado' : 'bancos conectados'}`
                : 'Nenhum banco conectado'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.connectHeaderBtn, { backgroundColor: colors.surf, borderColor: colors.line }]}
            onPress={() => {
              hapticFeedback.light();
              setConnectModalVisible(true);
            }}
            activeOpacity={0.8}
            accessibilityLabel="Gerenciar conexões bancárias"
          >
            <MaterialIcons name="account-balance" size={16} color={colors.ink} />
            <Text style={[styles.connectHeaderBtnText, { color: colors.ink }]}>Bancos</Text>
          </TouchableOpacity>
        </View>

        {/* Card Hero: Safe-to-Spend (.fhero) ou Onboarding quando sem contas */}
        {summary.connected_institutions_count === 0 && summary.total_balance === 0 && summary.open_credit_card_bills === 0 ? (
          <View style={[styles.heroCard, { backgroundColor: colors.surf, borderColor: colors.line }]}>
            <View style={styles.emptyIconCircle}>
              <MaterialIcons name="account-balance-wallet" size={30} color="#8B5CF6" />
            </View>
            <Text style={[styles.emptyHeroTitle, { color: colors.ink }]}>Safe-to-Spend em Tempo Real</Text>
            <Text style={[styles.emptyHeroDesc, { color: colors.muted }]}>
              Conecte suas contas bancárias e cartões com segurança via Open Finance. O Vito calcula quanto você pode gastar hoje sem comprometer suas faturas.
            </Text>
            <TouchableOpacity
              style={styles.emptyConnectBtn}
              onPress={() => {
                hapticFeedback.medium();
                setConnectModalVisible(true);
              }}
              activeOpacity={0.8}
              accessibilityLabel="Conectar Banco via Open Finance"
            >
              <MaterialIcons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.emptyConnectBtnText}>Conectar Banco com Open Finance</Text>
            </TouchableOpacity>
            <View style={styles.securityBadgesRow}>
              <View style={styles.secBadgeItem}>
                <MaterialIcons name="lock-outline" size={13} color={colors.muted} />
                <Text style={[styles.secBadgeText, { color: colors.muted }]}>Somente Leitura</Text>
              </View>
              <View style={styles.secBadgeItem}>
                <MaterialIcons name="security" size={13} color={colors.muted} />
                <Text style={[styles.secBadgeText, { color: colors.muted }]}>Zero IP Leak</Text>
              </View>
              <View style={styles.secBadgeItem}>
                <MaterialIcons name="sd-storage" size={13} color={colors.muted} />
                <Text style={[styles.secBadgeText, { color: colors.muted }]}>SQLite Local</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={[styles.heroCard, { backgroundColor: colors.surf, borderColor: colors.line }]}>
            <View style={styles.eyebrowRow}>
              <Animated.View
                style={[
                  styles.pulseDot,
                  { transform: [{ scale: pulseAnim }], backgroundColor: '#10B981' },
                ]}
              />
              <Text style={[styles.eyebrowText, { color: '#10B981' }]}>{summary.headline_status}</Text>
            </View>

            <View style={styles.dailyMetricRow}>
              <Text style={[styles.dailyValueText, { color: colors.ink }]}>
                R$ {Math.round(summary.safe_to_spend_daily)}
              </Text>
              <Text style={[styles.dailyUnitText, { color: colors.muted }]}>
                /dia até o fim do mês ({summary.days_remaining_in_month} dias)
              </Text>
            </View>

            {/* Barra de Ritmo Comparativa */}
            <View style={styles.paceBarSection}>
              <View style={[styles.paceTrack, { backgroundColor: colors.bg }]}>
                <View
                  style={[
                    styles.paceFill,
                    {
                      width: `${Math.min(100, summary.pace_percent)}%`,
                      backgroundColor: summary.pace_percent > summary.month_progress_percent ? '#EF4444' : '#10B981',
                    },
                  ]}
                />
              </View>
              <Text style={[styles.paceLegend, { color: colors.muted }]}>
                Você usou {summary.pace_percent}% do planejado. O mês está em {summary.month_progress_percent}%.
              </Text>
            </View>

            {/* 3 Submétricas Típicas */}
            <View style={[styles.subMetricsRow, { borderTopColor: colors.line }]}>
              <View style={styles.subMetricCol}>
                <Text style={[styles.subMetricLabel, { color: colors.muted }]}>Saldo Disponível</Text>
                <Text style={[styles.subMetricVal, { color: colors.ink }]}>{formatBRL(summary.total_balance)}</Text>
              </View>
              <View style={[styles.subMetricDivider, { backgroundColor: colors.line }]} />
              <View style={styles.subMetricCol}>
                <Text style={[styles.subMetricLabel, { color: colors.muted }]}>Fatura Aberta</Text>
                <Text style={[styles.subMetricVal, { color: colors.ink }]}>{formatBRL(summary.open_credit_card_bills)}</Text>
              </View>
              <View style={[styles.subMetricDivider, { backgroundColor: colors.line }]} />
              <View style={styles.subMetricCol}>
                <Text style={[styles.subMetricLabel, { color: colors.muted }]}>Sobra Prevista</Text>
                <Text style={[styles.subMetricVal, { color: '#10B981' }]}>{formatBRL(summary.projected_leftover)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Seção Alertas de Atenção */}
        {summary.attention_alerts && summary.attention_alerts.length > 0 && (
          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionTitle, { color: colors.muted }]}>ATENÇÃO</Text>
            {summary.attention_alerts.map((alert) => (
              <View
                key={alert.id}
                style={[
                  styles.alertCard,
                  { backgroundColor: colors.surf, borderColor: colors.line },
                ]}
              >
                <View style={styles.alertContentCol}>
                  <View style={styles.alertHeaderRow}>
                    <MaterialIcons
                      name={alert.urgency === 'high' ? 'error-outline' : 'warning-amber'}
                      size={18}
                      color={alert.urgency === 'high' ? '#EF4444' : '#F59E0B'}
                    />
                    <Text style={[styles.alertTitle, { color: colors.ink }]}>{alert.title}</Text>
                  </View>
                  <Text style={[styles.alertDesc, { color: colors.muted }]}>{alert.description}</Text>
                </View>
                {alert.action_label && (
                  <TouchableOpacity
                    style={[styles.alertActionBtn, { backgroundColor: colors.bg, borderColor: colors.line }]}
                    onPress={() => handlePromptPress(`Como lidar com: ${alert.title}`)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.alertActionBtnText, { color: colors.ink }]}>{alert.action_label}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Seção Pergunte ao Vito (Chips de Ação Rápida) */}
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionTitle, { color: colors.muted }]}>PERGUNTE AO VITO</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
            {PROMPT_CHIPS.map((chip, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.chipPill, { backgroundColor: colors.surf, borderColor: colors.line }]}
                onPress={() => handlePromptPress(chip)}
                activeOpacity={0.7}
              >
                <MaterialIcons name="auto-awesome" size={14} color="#8B5CF6" style={{ marginRight: 6 }} />
                <Text style={[styles.chipPillText, { color: colors.ink }]}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Seção Gastos do Mês por Categoria (somente se houver dados reais) */}
        {summary.category_spending && summary.category_spending.length > 0 && (
          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionTitle, { color: colors.muted }]}>GASTOS DO MÊS POR CATEGORIA</Text>
            <View style={[styles.categoriesCard, { backgroundColor: colors.surf, borderColor: colors.line }]}>
              {summary.category_spending.map((cat, idx) => {
                const delta = cat.delta_vs_average_percent ?? 0;
                const isUp = delta > 0;
                return (
                  <View key={cat.category} style={[styles.categoryRow, idx > 0 && { borderTopColor: colors.line, borderTopWidth: 1 }]}>
                    <View style={styles.catMetaRow}>
                      <Text style={[styles.catName, { color: colors.ink }]}>{cat.category}</Text>
                      <View style={styles.catValuesRow}>
                        <Text style={[styles.catAmount, { color: colors.ink }]}>{formatBRL(cat.amount)}</Text>
                        {delta !== 0 && (
                          <View style={[styles.deltaBadge, { backgroundColor: isUp ? '#FEE2E2' : '#DCFCE7' }]}>
                            <Text style={[styles.deltaText, { color: isUp ? '#B91C1C' : '#15803D' }]}>
                              {isUp ? `+${delta}%` : `${delta}%`}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={[styles.catBarTrack, { backgroundColor: colors.bg }]}>
                      <View style={[styles.catBarFill, { width: `${cat.percentage}%`, backgroundColor: colors.ink }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Seção Assinaturas Recorrentes (somente se houver dados reais) */}
        {summary.subscriptions && summary.subscriptions.length > 0 && (
          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionTitle, { color: colors.muted }]}>ASSINATURAS RECORRENTES</Text>
            <View style={[styles.categoriesCard, { backgroundColor: colors.surf, borderColor: colors.line }]}>
              {summary.subscriptions.map((sub, idx) => (
                <View key={sub.id} style={[styles.subRow, idx > 0 && { borderTopColor: colors.line, borderTopWidth: 1 }]}>
                  <View style={styles.subLeftCol}>
                    <Text style={[styles.subName, { color: colors.ink }]}>{sub.name}</Text>
                    {sub.has_price_increase && (
                      <Text style={[styles.subAlert, { color: '#EF4444' }]}>
                        Reajuste detectado (era {formatBRL(sub.previous_amount || 0)})
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.subAmount, { color: colors.ink }]}>
                    {formatBRL(sub.amount)}
                    <Text style={[styles.subFreq, { color: colors.muted }]}>/{sub.frequency === 'monthly' ? 'mês' : 'ano'}</Text>
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Modal de Conexão Open Finance Meu Pluggy */}
      <PluggyConnectModal
        visible={connectModalVisible}
        onClose={() => setConnectModalVisible(false)}
        onConnectionSuccess={() => loadFinanceSummary()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 110 },
  topHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  topHeaderTitleCol: { flex: 1 },
  mainTitle: { fontFamily: tokens.typography.family.montserratBold, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  mainSubtitle: { fontSize: 13, marginTop: 2, fontWeight: '500' },
  connectHeaderBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 36, borderRadius: 18, borderWidth: 1 },
  connectHeaderBtnText: { fontSize: 13, fontWeight: '600' },
  heroCard: { borderRadius: 24, borderWidth: 1, padding: 20, marginBottom: 20 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  pulseDot: { width: 8, height: 8, borderRadius: 4 },
  eyebrowText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  dailyMetricRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  dailyValueText: { fontFamily: tokens.typography.family.montserratBold, fontSize: 42, fontWeight: '800', letterSpacing: -1 },
  dailyUnitText: { fontSize: 14, fontWeight: '500' },
  paceBarSection: { marginTop: 14, marginBottom: 18 },
  paceTrack: { height: 7, borderRadius: 3.5, overflow: 'hidden' },
  paceFill: { height: '100%', borderRadius: 3.5 },
  paceLegend: { fontSize: 12.5, marginTop: 6, fontWeight: '500' },
  subMetricsRow: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 14, alignItems: 'center' },
  subMetricCol: { flex: 1, alignItems: 'center' },
  subMetricLabel: { fontSize: 11.5, fontWeight: '500', marginBottom: 4 },
  subMetricVal: { fontSize: 14, fontWeight: '700' },
  subMetricDivider: { width: 1, height: 26 },
  sectionBlock: { marginBottom: 20 },
  sectionTitle: { fontFamily: tokens.typography.family.semibold, fontSize: 11.5, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10, marginHorizontal: 2 },
  alertCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  alertContentCol: { flex: 1 },
  alertHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  alertTitle: { fontSize: 14, fontWeight: '600' },
  alertDesc: { fontSize: 12.5, lineHeight: 17 },
  alertActionBtn: { paddingHorizontal: 12, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  alertActionBtnText: { fontSize: 12.5, fontWeight: '600' },
  chipsScroll: { gap: 8, paddingRight: 8 },
  chipPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 38, borderRadius: 19, borderWidth: 1 },
  chipPillText: { fontSize: 13, fontWeight: '500' },
  categoriesCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  categoryRow: { padding: 14 },
  catMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  catName: { fontSize: 13.5, fontWeight: '600' },
  catValuesRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catAmount: { fontSize: 13.5, fontWeight: '600' },
  deltaBadge: { paddingHorizontal: 6, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  deltaText: { fontSize: 11, fontWeight: '700' },
  catBarTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  catBarFill: { height: '100%', borderRadius: 3 },
  subRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  subLeftCol: { flex: 1, marginRight: 10 },
  subName: { fontSize: 14, fontWeight: '600' },
  subAlert: { fontSize: 11.5, marginTop: 2, fontWeight: '500' },
  subAmount: { fontSize: 14, fontWeight: '700' },
  subFreq: { fontSize: 12, fontWeight: '400' },
  emptyIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(139, 92, 246, 0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyHeroTitle: { fontFamily: tokens.typography.family.montserratBold, fontSize: 20, fontWeight: '800', marginBottom: 6 },
  emptyHeroDesc: { fontSize: 13, lineHeight: 19, marginBottom: 16 },
  emptyConnectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 22, backgroundColor: '#8B5CF6', paddingHorizontal: 18, marginBottom: 14 },
  emptyConnectBtnText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' },
  securityBadgesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 10 },
  secBadgeItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  secBadgeText: { fontSize: 11, fontWeight: '500' },
});
