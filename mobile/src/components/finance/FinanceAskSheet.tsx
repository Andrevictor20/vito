import React, { useEffect } from 'react';
import {
  BackHandler,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';
import { pagerSwipeLockBus } from '../../services/dataSync';

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
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

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

  const overlayBg = isDark ? 'rgba(0, 0, 0, 0.65)' : 'rgba(0, 0, 0, 0.40)';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <TouchableWithoutFeedback onPress={onClose} accessibilityLabel="Fechar sheet financeiro">
          <View style={[styles.backdrop, { backgroundColor: overlayBg }]} />
        </TouchableWithoutFeedback>

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.bg,
              borderColor: colors.line,
              paddingBottom: Math.max(24, insets.bottom + 16),
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.line }]} />

          <View style={styles.headerRow}>
            <View style={[styles.sparkChip, { backgroundColor: colors.finBg }]}>
              <MaterialIcons name="auto-awesome" size={20} color={colors.fin} />
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
                  { backgroundColor: colors.bg, borderColor: colors.line },
                ]}
                onPress={() => {
                  hapticFeedback.selection();
                  onClose();
                  setTimeout(() => onSelectQuestion(item.prompt), 60);
                }}
                activeOpacity={0.78}
              >
                <Text style={[styles.questionText, { color: colors.ink }]}>{item.label}</Text>
                <MaterialIcons name="chevron-right" size={18} color={colors.muted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
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
    fontFamily: tokens.typography.family.montserratBold,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
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
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
});
