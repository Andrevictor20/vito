import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { hapticFeedback } from '../theme/motion';
import { api } from '../services/api';
import { chatPromptBus, dataSync } from '../services/dataSync';
import type {
  FinanceAccount,
  FinanceConnection,
  FinanceSubScreenKey,
  FinanceTransaction,
  FinancialSummary,
} from '../types/finance';
import { PluggyConnectModal } from './PluggyConnectModal';
import { BentoAccountHero } from '../components/finance/BentoAccountHero';
import { BentoMetricsGrid } from '../components/finance/BentoMetricsGrid';
import { RecentTransactionsList } from '../components/finance/RecentTransactionsList';
import { FinanceGoalsCard } from '../components/finance/FinanceGoalsCard';
import { FinanceAttentionSection } from '../components/finance/FinanceAttentionSection';
import { FinanceAskSheet } from '../components/finance/FinanceAskSheet';
import { FinanceSubScreenModal } from '../components/finance/FinanceSubScreenModal';
import {
  EMPTY_FINANCIAL_SUMMARY,
  formatBRL,
  normalizeSummary,
} from '../components/finance/financeHelpers';

const PROMPT_CHIPS: ReadonlyArray<{ label: string; prompt: string }> = [
  {
    label: 'Quanto gastei com Uber?',
    prompt: 'Quanto gastei com Uber este mês em comparação com minha média?',
  },
  {
    label: 'Posso gastar R$ 300 sábado?',
    prompt: 'Posso gastar R$ 300 neste sábado sem estourar meu limite diário?',
  },
  {
    label: 'Quero juntar R$ 3.000',
    prompt: 'Quero juntar R$ 3.000. Como ajustar meus gastos mensais para atingir essa meta?',
  },
  {
    label: 'Quando vence minha fatura?',
    prompt: 'Quando vence minha fatura de cartão e qual é o valor atual?',
  },
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
      const [sumRes, accRes, txRes, connRes] = await Promise.allSettled([
        api.finance.getSummary(),
        api.finance.getAccounts(),
        api.finance.getTransactions(100, 0),
        api.finance.getConnections(),
      ]);

      if (sumRes.status === 'fulfilled' && sumRes.value) {
        setSummary(normalizeSummary(sumRes.value));
      } else if (sumRes.status === 'rejected') {
        setSummary(EMPTY_FINANCIAL_SUMMARY);
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    hapticFeedback.light();
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
        <View style={styles.head}>
          <View style={styles.headLeft}>
            <Text style={[styles.mainTitle, { color: colors.ink }]}>Finanças</Text>
            <Text style={[styles.mainSubtitle, { color: colors.muted }]} numberOfLines={1}>
              {connectedCount > 0
                ? `${connectedCount} ${
                    connectedCount === 1 ? 'banco conectado' : 'bancos conectados'
                  } · Open Finance`
                : 'Conecte seus bancos via Open Finance'}
            </Text>
          </View>

          <View style={styles.headActs}>
            <TouchableOpacity
              style={[styles.rb, { backgroundColor: colors.bg, borderColor: colors.line }]}
              onPress={togglePrivacy}
              hitSlop={tokens.hitSlop.sm}
              accessibilityLabel={isPrivacyHidden ? 'Mostrar valores' : 'Ocultar valores'}
              accessibilityState={{ selected: isPrivacyHidden }}
            >
              <MaterialIcons
                name={isPrivacyHidden ? 'visibility-off' : 'visibility'}
                size={19}
                color={colors.ink}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.pillb, { backgroundColor: colors.bg, borderColor: colors.line }]}
              onPress={() => {
                hapticFeedback.light();
                if (connectedCount > 0 || accounts.length > 0) {
                  setSubScreenKey('conn');
                } else {
                  setConnectModalVisible(true);
                }
              }}
              activeOpacity={0.8}
              accessibilityLabel="Contas conectadas"
            >
              <MaterialIcons name="account-balance" size={17} color={colors.ink} />
              <Text style={[styles.pillbText, { color: colors.ink }]}>Bancos</Text>
              {connectedCount > 0 && (
                <View style={[styles.pillbDot, { backgroundColor: colors.acc }]} />
              )}
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
              <MaterialIcons name="auto-awesome" size={19} color={colors.bg} />
            </TouchableOpacity>
          </View>
        </View>

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
                <MaterialIcons name="account-balance" size={24} color={colors.fin} />
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
                  style={[styles.exChip, { backgroundColor: colors.bg, borderColor: colors.line }]}
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
            <BentoAccountHero
              totalBalance={summary.total_balance}
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

            <BentoMetricsGrid
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

            <FinanceGoalsCard
              summary={summary}
              isPrivacyHidden={isPrivacyHidden}
              onPress={() => setSubScreenKey('goal')}
            />

            <FinanceAttentionSection
              alerts={summary.attention_alerts}
              onPressAlertAction={sendPromptToVito}
            />

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
                  style={[styles.exChip, { backgroundColor: colors.bg, borderColor: colors.line }]}
                  onPress={() => sendPromptToVito(item.prompt)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.exChipText, { color: colors.ink }]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

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
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 120,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },
  headLeft: {
    flex: 1,
    minWidth: 0,
  },
  mainTitle: {
    fontFamily: tokens.typography.family.montserratBold,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  mainSubtitle: {
    fontSize: 13.5,
    marginTop: 4,
    fontWeight: '500',
  },
  headActs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  rb: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 42,
    paddingHorizontal: 13,
    borderRadius: 21,
    borderWidth: 1,
  },
  pillbText: {
    fontSize: 14,
    fontWeight: '600',
  },
  pillbDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  emptyCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 22,
    alignItems: 'flex-start',
    marginTop: 6,
    marginBottom: 10,
  },
  emptyChip: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontFamily: tokens.typography.family.montserratBold,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  emptySub: {
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 6,
  },
  emptyCta: {
    height: 46,
    borderRadius: 23,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    alignSelf: 'stretch',
  },
  emptyCtaText: {
    fontSize: 15,
    fontWeight: '600',
  },
  secHeader: {
    marginTop: 14,
    marginBottom: 10,
  },
  secTitle: {
    fontFamily: tokens.typography.family.montserratBold,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  exScroll: {
    gap: 8,
    paddingBottom: 8,
  },
  exChip: {
    height: 34,
    paddingHorizontal: 13,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
