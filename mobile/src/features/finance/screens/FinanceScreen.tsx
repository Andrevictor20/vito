import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { financeScreenStyles as styles } from './FinanceScreen.styles';
import { ProtoUiIcon } from '../../../icons/ProtoUiIcons';
import { tokens } from '../../../theme/tokens';
import { useTheme } from '../../../context/ThemeContext';
import { hapticFeedback } from '../../../theme/motion';
import { StaggerItem } from '../../../theme/vitoMotion';
import { api } from '../../../services/api';
import { chatPromptBus, dataSync } from '../../../services/dataSync';
import type {
  FinanceAccount,
  FinanceConnection,
  FinanceSubScreenKey,
  FinanceTransaction,
  FinancialSummary,
} from '../types/finance';
import { PluggyConnectModal } from './PluggyConnectModal';
import { FinanceHeroAndRail } from '../components/dashboard/FinanceHeroAndRail';
import { FinanceMonthAndCards } from '../components/dashboard/FinanceMonthAndCards';
import { RecentTransactionsList } from '../components/dashboard/RecentTransactionsList';
import { FinanceGoalsCard } from '../components/dashboard/FinanceGoalsCard';
import { FinanceAttentionSection } from '../components/dashboard/FinanceAttentionSection';
import { FinanceAskSheet } from '../components/subscreens/FinanceAskSheet';
import { FinanceSubScreenModal } from '../components/subscreens/FinanceSubScreenModal';
import {
  EMPTY_FINANCIAL_SUMMARY,
  formatBRL,
  normalizeSummary,
} from '../utils/financeHelpers';
import { syncAllUserConnections } from '../services/financeSyncRunner';
import { useFinanceAutoSync } from '../hooks/useFinanceAutoSync';

const PROMPT_CHIPS: ReadonlyArray<{ label: string; prompt: string }> = [
  { label: 'Quanto gastei com Uber?', prompt: 'Quanto gastei com Uber este mês em comparação com minha média?' },
  { label: 'Posso gastar R$ 300 sábado?', prompt: 'Posso gastar R$ 300 neste sábado sem estourar meu limite diário?' },
  { label: 'Quero juntar R$ 3.000', prompt: 'Quero juntar R$ 3.000. Como ajustar meus gastos mensais para atingir essa meta?' },
  { label: 'Quando vence minha fatura?', prompt: 'Quando vence minha fatura de cartão e qual é o valor atual?' },
];

export const FinanceScreen: React.FC = () => {
  const { colors } = useTheme();
  const [summary, setSummary] = useState<FinancialSummary>(EMPTY_FINANCIAL_SUMMARY);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [connections, setConnections] = useState<FinanceConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connectModalVisible, setConnectModalVisible] = useState(false);
  const [askSheetVisible, setAskSheetVisible] = useState(false);
  const [subScreenKey, setSubScreenKey] = useState<FinanceSubScreenKey | null>(null);
  const [isPrivacyHidden, setIsPrivacyHidden] = useState(false);

  const loadAllFinanceData = useCallback(async () => {
    try {
      const [sumRes, accRes, txRes, connRes, limitsRes] = await Promise.allSettled([
        api.finance.getSummary(),
        api.finance.getAccounts(),
        api.finance.getTransactions(100, 0),
        api.finance.getConnections(),
        api.finance.getLimits(),
      ]);

      const baseSummary =
        sumRes.status === 'fulfilled' && sumRes.value
          ? normalizeSummary(sumRes.value)
          : sumRes.status === 'rejected'
            ? EMPTY_FINANCIAL_SUMMARY
            : null;

      if (baseSummary) {
        if (limitsRes.status === 'fulfilled' && Array.isArray(limitsRes.value)) {
          const mappedBudgets = limitsRes.value
            .filter((lim) => lim.rule?.kind !== 'SAVINGS_GOAL')
            .map((lim) => ({
              id: lim.rule?.id,
              title: lim.rule?.title || lim.rule?.category_filter || 'Limite',
              category_filter: lim.rule?.category_filter,
              used_amount: lim.spent_amount ?? 0,
              target_amount: lim.rule?.target_amount ?? 0,
              auto_alert_threshold:
                lim.rule?.auto_alert_threshold ?? lim.rule?.alert_thresholds?.[0],
            }));
          const mappedGoals = limitsRes.value
            .filter((lim) => lim.rule?.kind === 'SAVINGS_GOAL')
            .map((lim) => ({
              id: lim.rule?.id,
              title: lim.rule?.title || 'Meta',
              current_amount: lim.rule?.current_amount ?? lim.spent_amount ?? 0,
              target_amount: lim.rule?.target_amount ?? 0,
              deadline_date: lim.rule?.deadline_date,
            }));
          setSummary({
            ...baseSummary,
            budgets: mappedBudgets.length > 0 ? mappedBudgets : baseSummary.budgets,
            goals: mappedGoals.length > 0 ? mappedGoals : baseSummary.goals,
          });
        } else {
          setSummary(baseSummary);
        }
      }

      if (accRes.status === 'fulfilled' && Array.isArray(accRes.value)) {
        setAccounts(accRes.value);
      }
      if (txRes.status === 'fulfilled' && Array.isArray(txRes.value)) {
        setTransactions(txRes.value);
      }
      if (connRes.status === 'fulfilled' && Array.isArray(connRes.value)) {
        setConnections(connRes.value);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAllFinanceData();
    const unsub = dataSync.subscribe('refresh_finance', loadAllFinanceData);
    return () => unsub();
  }, [loadAllFinanceData]);

  useFinanceAutoSync({
    connections,
    enabled: !loading && connections.length > 0,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    hapticFeedback.light();
    await syncAllUserConnections();
    await loadAllFinanceData();
    setRefreshing(false);
  }, [loadAllFinanceData]);

  const sendPromptToVito = useCallback((prompt: string) => {
    hapticFeedback.selection();
    chatPromptBus.notify(prompt);
  }, []);

  const togglePrivacy = () => {
    hapticFeedback.selection();
    setIsPrivacyHidden((prev) => !prev);
  };

  const connectedCount = Math.max(
    summary.connected_institutions_count,
    connections.length
  );
  const hasConnectedData =
    connectedCount > 0 || accounts.length > 0 || transactions.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Cabeçalho Canônico (#s-fin .head) */}
        <StaggerItem index={0}>
        <View style={styles.head}>
          <TouchableOpacity
            style={styles.headLeft}
            activeOpacity={0.75}
            onPress={() => {
              hapticFeedback.light();
              if (connectedCount > 0 || accounts.length > 0) {
                setSubScreenKey('conn');
              } else {
                setConnectModalVisible(true);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Gerenciar contas conectadas"
          >
            <Text style={[styles.mainTitle, { color: colors.ink }]}>Finanças</Text>
            <Text style={[styles.mainSubtitle, { color: colors.muted }]} numberOfLines={1}>
              {connectedCount > 0
                ? `${connectedCount} ${
                    connectedCount === 1 ? 'banco conectado' : 'bancos conectados'
                  } · Open Finance`
                : 'Conecte seus bancos'}
            </Text>
          </TouchableOpacity>

          <View style={styles.headActs}>
            <TouchableOpacity
              style={[styles.rb, { backgroundColor: colors.bg, borderColor: colors.hairline }]}
              onPress={togglePrivacy}
              hitSlop={tokens.hitSlop.sm}
              accessibilityLabel={isPrivacyHidden ? 'Mostrar valores' : 'Ocultar valores'}
              accessibilityState={{ selected: isPrivacyHidden }}
            >
              <ProtoUiIcon
                name={isPrivacyHidden ? 'visibility-off' : 'visibility'}
                size={20}
                color={colors.ink}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.rb, { backgroundColor: colors.ink, borderColor: colors.ink }]}
              onPress={() => {
                hapticFeedback.selection();
                setAskSheetVisible(true);
              }}
              hitSlop={tokens.hitSlop.sm}
              accessibilityLabel="Pedir ao Vito: finanças"
            >
              <ProtoUiIcon name="auto-awesome" size={20} color={colors.bg} />
            </TouchableOpacity>
          </View>
        </View>
        </StaggerItem>

        {loading && !hasConnectedData ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.bg, borderColor: colors.line }]}>
            <ActivityIndicator size="small" color={colors.ink} />
            <Text style={[styles.emptySub, { color: colors.muted, marginTop: 10 }]}>
              Carregando suas finanças...
            </Text>
          </View>
        ) : !hasConnectedData ? (
          <>
            <View style={[styles.emptyCard, { backgroundColor: colors.bg, borderColor: colors.line }]}>
              <View style={[styles.emptyChip, { backgroundColor: colors.finBg }]}>
                <ProtoUiIcon name="account-balance" size={24} color={colors.fin} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.ink }]}>
                Conecte seus bancos via Open Finance
              </Text>
              <Text style={[styles.emptySub, { color: colors.muted }]}>
                Seus dados ficam em modo leitura no seu servidor privado. Conecte sua conta para acompanhar saldo consolidado, faturas e quanto pode gastar hoje.
              </Text>
              <TouchableOpacity
                style={[styles.emptyCta, { backgroundColor: colors.ink }]}
                onPress={() => {
                  hapticFeedback.light();
                  setConnectModalVisible(true);
                }}
                activeOpacity={0.85}
              >
                <Text style={[styles.emptyCtaText, { color: colors.bg }]}>Conectar bancos</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.secHeader}>
              <Text style={[styles.secTitle, { color: colors.ink }]}>Pergunte ao Vito</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.exScroll}
            >
              {PROMPT_CHIPS.map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.exChip, { backgroundColor: colors.surf, borderColor: colors.hairline }]}
                  onPress={() => sendPromptToVito(item.prompt)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.exChipText, { color: colors.ink }]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        ) : (
          <>
            {/* Blocos 1, 2 e 3: Saldo aberto (.fx-hero), Alerta mais urgente e Carrossel de contas (.fx-rail) */}
            <StaggerItem index={1}>
              <FinanceHeroAndRail
                totalBalance={summary.total_balance}
                monthSurplus={(summary.month_income ?? 0) - (summary.month_expenses ?? summary.monthly_spend_actual ?? 0)}
                connectionsCount={connectedCount}
                accounts={accounts}
                connections={connections}
                isPrivacyHidden={isPrivacyHidden}
                onPressConnections={() => setSubScreenKey('conn')}
                onPressAddBank={() => setConnectModalVisible(true)}
                onSelectAccount={(acc) =>
                  sendPromptToVito(
                    `Me mostre os detalhes e movimentações recentes da conta ${acc.name || acc.institution_name}.`
                  )
                }
              />
            </StaggerItem>

            <StaggerItem index={2}>
              <FinanceAttentionSection
                alerts={summary.attention_alerts}
                onPressAlertAction={sendPromptToVito}
              />
            </StaggerItem>

            {/* Blocos 4, 5 e 6: Card do Mês, Atalhos (Pode gastar hoje / Assinaturas) e Cartões */}
            <StaggerItem index={3}>
              <FinanceMonthAndCards
                summary={summary}
                accounts={accounts}
                isPrivacyHidden={isPrivacyHidden}
                onOpenSubScreen={(key) => {
                  hapticFeedback.light();
                  setSubScreenKey(key);
                }}
                onPressSafeToSpend={() =>
                  sendPromptToVito(
                    `Quanto posso gastar por dia até o fim do mês? Hoje meu limite diário está em ${formatBRL(
                      summary.safe_to_spend_daily,
                      0
                    )}.`
                  )
                }
              />
            </StaggerItem>

            {/* Bloco 7: Metas e orçamentos */}
            <StaggerItem index={4}>
              <FinanceGoalsCard
                summary={summary}
                isPrivacyHidden={isPrivacyHidden}
                onPress={() => setSubScreenKey('goal')}
              />
            </StaggerItem>

            {/* Bloco 8: Perguntas rápidas */}
            <StaggerItem index={5}>
              <View style={styles.secHeader}>
                <Text style={[styles.secTitle, { color: colors.ink }]}>Pergunte ao Vito</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.exScroll}
              >
                {PROMPT_CHIPS.map((item) => (
                  <TouchableOpacity
                    key={item.label}
                    style={[styles.exChip, { backgroundColor: colors.surf, borderColor: colors.hairline }]}
                    onPress={() => sendPromptToVito(item.prompt)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.exChipText, { color: colors.ink }]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </StaggerItem>

            {/* Bloco 9: Movimentações agrupadas por dia */}
            <StaggerItem index={6}>
              <RecentTransactionsList
                transactions={transactions}
                isPrivacyHidden={isPrivacyHidden}
                onViewAll={() => setSubScreenKey('ext')}
                onSelectTransaction={(tx) =>
                  sendPromptToVito(
                    `Sobre o lançamento "${tx.clean_merchant_name || tx.description}" de ${formatBRL(
                      tx.amount
                    )}, me ajude a analisar ou recategorizar.`
                  )
                }
              />
            </StaggerItem>
          </>
        )}
      </ScrollView>

      <FinanceAskSheet
        visible={askSheetVisible}
        onClose={() => setAskSheetVisible(false)}
        onSelectQuestion={sendPromptToVito}
      />

      {subScreenKey && (
        <FinanceSubScreenModal
          visible={Boolean(subScreenKey)}
          screenKey={subScreenKey}
          summary={summary}
          accounts={accounts}
          transactions={transactions}
          connections={connections}
          isPrivacyHidden={isPrivacyHidden}
          onClose={() => setSubScreenKey(null)}
          onAskVito={sendPromptToVito}
          onOpenPluggyModal={() => setConnectModalVisible(true)}
        />
      )}

      <PluggyConnectModal
        visible={connectModalVisible}
        onClose={() => setConnectModalVisible(false)}
        onConnectionSuccess={() => void loadAllFinanceData()}
        onOpenCustomLimits={() => {
          setConnectModalVisible(false);
          setSubScreenKey('goal');
        }}
      />
    </View>
  );
};
