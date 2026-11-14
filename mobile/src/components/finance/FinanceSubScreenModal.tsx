import React, { useEffect } from 'react';
import {
  BackHandler,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';
import { pagerSwipeLockBus } from '../../services/dataSync';
import { resolveModalBottomInset, resolveModalTopInset } from '../../utils/safeArea';
import type {
  FinanceAccount,
  FinanceConnection,
  FinanceSubScreenKey,
  FinanceTransaction,
  FinancialSummary,
} from '../../types/finance';
import { ExtractSubView, SpendingSubView } from './FinanceSubScreenViews';
import { CardsSubView, CashFlowSubView } from './FinanceSubScreenFlowCardViews';
import {
  ConnectionsSubView,
  GoalsSubView,
  SubscriptionsSubView,
} from './FinanceSubScreenSecondaryViews';

const SUB_SCREEN_META: Record<
  FinanceSubScreenKey,
  { title: string; subtitle: string; aiPrompt: string }
> = {
  ext: {
    title: 'Extrato',
    subtitle: 'Entradas e saídas dos seus bancos',
    aiPrompt: 'Analise minhas últimas movimentações e destaque o que mais pesou.',
  },
  spend: {
    title: 'Gastos do mês',
    subtitle: 'Por categoria e por dia',
    aiPrompt: 'Como estão meus gastos por categoria este mês em relação ao meu ritmo ideal?',
  },
  flow: {
    title: 'Fluxo de caixa',
    subtitle: 'Entradas e saídas dos últimos meses',
    aiPrompt: 'Como está meu fluxo de caixa e minha taxa de poupança este mês?',
  },
  card: {
    title: 'Cartões',
    subtitle: 'Faturas, limite e histórico',
    aiPrompt: 'Quando vencem minhas faturas de cartão e quanto tenho de limite disponível?',
  },
  sub: {
    title: 'Assinaturas',
    subtitle: 'Cobranças recorrentes detectadas',
    aiPrompt: 'Quais são minhas assinaturas recorrentes ativas e houve algum reajuste?',
  },
  goal: {
    title: 'Metas e orçamentos',
    subtitle: 'Limites do mês e metas de economia',
    aiPrompt: 'Como posso ajustar meus orçamentos e criar uma meta de economia realista?',
  },
  conn: {
    title: 'Contas conectadas',
    subtitle: 'Open Finance, somente leitura',
    aiPrompt: 'Qual é o status atual das minhas contas conectadas via Open Finance?',
  },
};

interface FinanceSubScreenModalProps {
  visible: boolean;
  screenKey: FinanceSubScreenKey;
  summary: FinancialSummary;
  accounts: FinanceAccount[];
  transactions: FinanceTransaction[];
  connections: FinanceConnection[];
  isPrivacyHidden: boolean;
  onClose: () => void;
  onAskVito: (prompt: string) => void;
  onOpenPluggyModal: () => void;
}

export const FinanceSubScreenModal: React.FC<FinanceSubScreenModalProps> = ({
  visible,
  screenKey,
  summary,
  accounts,
  transactions,
  connections,
  isPrivacyHidden,
  onClose,
  onAskVito,
  onOpenPluggyModal,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const meta = SUB_SCREEN_META[screenKey];

  useEffect(() => {
    if (!visible) return;
    pagerSwipeLockBus.notify(true);
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => {
      pagerSwipeLockBus.notify(false);
      sub.remove();
    };
  }, [visible, onClose]);

  const handleAsk = (prompt: string) => {
    onClose();
    setTimeout(() => onAskVito(prompt), 60);
  };

  const handleOpenPluggy = () => {
    onClose();
    setTimeout(() => onOpenPluggyModal(), 80);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.bg,
            paddingTop: resolveModalTopInset(insets.top, 6),
          },
        ]}
      >
        {/* Header padrão sbar: botão voltar circular, título/subtítulo e botão circular primário Spark */}
        <View style={styles.sbar}>
          <TouchableOpacity
            style={[styles.rb, { backgroundColor: colors.bg, borderColor: colors.line }]}
            onPress={() => {
              hapticFeedback.light();
              onClose();
            }}
            hitSlop={tokens.hitSlop.sm}
            accessibilityLabel="Voltar"
          >
            <MaterialIcons name="arrow-back" size={20} color={colors.ink} />
          </TouchableOpacity>

          <View style={styles.ttl}>
            <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>
              {meta.title}
            </Text>
            <Text style={[styles.subtitle, { color: colors.muted }]} numberOfLines={1}>
              {meta.subtitle}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.rb, { backgroundColor: colors.ink, borderColor: colors.ink }]}
            onPress={() => {
              hapticFeedback.selection();
              handleAsk(meta.aiPrompt);
            }}
            hitSlop={tokens.hitSlop.sm}
            accessibilityLabel="Pedir ao Vito"
          >
            <MaterialIcons name="auto-awesome" size={19} color={colors.bg} />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: resolveModalBottomInset(insets.bottom, 20) },
          ]}
        >
          {screenKey === 'ext' && (
            <ExtractSubView
              summary={summary}
              accounts={accounts}
              transactions={transactions}
              isPrivacyHidden={isPrivacyHidden}
              onAskVito={handleAsk}
            />
          )}
          {screenKey === 'spend' && (
            <SpendingSubView
              summary={summary}
              accounts={accounts}
              transactions={transactions}
              isPrivacyHidden={isPrivacyHidden}
              onAskVito={handleAsk}
            />
          )}
          {screenKey === 'flow' && (
            <CashFlowSubView
              summary={summary}
              accounts={accounts}
              transactions={transactions}
              isPrivacyHidden={isPrivacyHidden}
              onAskVito={handleAsk}
            />
          )}
          {screenKey === 'card' && (
            <CardsSubView
              summary={summary}
              accounts={accounts}
              transactions={transactions}
              isPrivacyHidden={isPrivacyHidden}
              onAskVito={handleAsk}
            />
          )}
          {screenKey === 'sub' && (
            <SubscriptionsSubView
              summary={summary}
              isPrivacyHidden={isPrivacyHidden}
              onAskVito={handleAsk}
            />
          )}
          {screenKey === 'goal' && (
            <GoalsSubView
              summary={summary}
              isPrivacyHidden={isPrivacyHidden}
              onAskVito={handleAsk}
            />
          )}
          {screenKey === 'conn' && (
            <ConnectionsSubView
              connections={connections}
              accounts={accounts}
              isPrivacyHidden={isPrivacyHidden}
              onOpenPluggyModal={handleOpenPluggy}
            />
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  rb: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ttl: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: tokens.typography.family.montserratBold,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 13.5,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
});
