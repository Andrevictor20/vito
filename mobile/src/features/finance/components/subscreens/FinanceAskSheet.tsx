import React, { useEffect } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ProtoUiIcon } from '../../../../icons/ProtoUiIcons';
import { useTheme } from '../../../../context/ThemeContext';
import { hapticFeedback } from '../../../../theme/motion';
import { pagerSwipeLockBus } from '../../../../services/dataSync';
import { VitoSheet } from '../../../../components/ui/VitoSheet';

export const FINANCE_QUICK_QUESTIONS: ReadonlyArray<{ label: string; prompt: string }> = [
  {
    label: 'Quanto posso gastar por dia?',
    prompt: 'Quanto posso gastar por dia até o fim do mês sem comprometer minhas contas?',
  },
  {
    label: 'Quanto gastei com Uber?',
    prompt: 'Quanto gastei com Uber este mês em comparação com minha média?',
  },
  {
    label: 'Posso gastar R$ 300 sábado?',
    prompt: 'Posso gastar R$ 300 neste sábado sem estourar meu Safe-to-Spend?',
  },
  {
    label: 'Quero juntar R$ 3.000',
    prompt: 'Quero juntar R$ 3.000. Como ajustar meus gastos mensais para atingir essa meta?',
  },
];

interface FinanceAskSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectQuestion: (prompt: string) => void;
}

export const FinanceAskSheet: React.FC<FinanceAskSheetProps> = ({
  visible,
  onClose,
  onSelectQuestion,
}) => {
  const { colors } = useTheme();

  useEffect(() => {
    if (!visible) return;
    pagerSwipeLockBus.notify(true);
    return () => {
      pagerSwipeLockBus.notify(false);
    };
  }, [visible]);

  return (
    <VitoSheet visible={visible} onClose={onClose}>
      <View style={styles.headerRow}>
        <View style={[styles.sparkChip, { backgroundColor: colors.finBg }]}>
          <ProtoUiIcon name="auto-awesome" size={20} color={colors.fin} />
        </View>
        <View style={styles.headerTextCol}>
          <Text style={[styles.title, { color: colors.ink }]}>
            O que você quer saber sobre o seu dinheiro?
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Escolha uma pergunta rápida para conversar com o Vito
          </Text>
        </View>
      </View>

      <View style={styles.questionsList}>
        {FINANCE_QUICK_QUESTIONS.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={[
              styles.questionCard,
              { backgroundColor: colors.surf, borderColor: colors.hairline },
            ]}
            onPress={() => {
              hapticFeedback.selection();
              onClose();
              setTimeout(() => onSelectQuestion(item.prompt), 60);
            }}
            activeOpacity={0.78}
          >
            <Text style={[styles.questionText, { color: colors.ink }]}>{item.label}</Text>
            <ProtoUiIcon name="chevron-right" size={18} color={colors.muted} />
          </TouchableOpacity>
        ))}
      </View>
    </VitoSheet>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
    marginTop: 4,
  },
  sparkChip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
  },
  title: {
    fontFamily: 'Geist_500Medium',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '500',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: 'Geist',
    fontSize: 13.5,
    marginTop: 4,
  },
  questionsList: {
    gap: 10,
  },
  questionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  questionText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
});
