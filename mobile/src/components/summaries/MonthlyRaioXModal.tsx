import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes, tabularNumbers } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { BottomSheetModal } from '../ui/BottomSheetModal';

interface MonthlyMetrics {
  totalHours: string;
  totalEvents: number;
  totalTodos: number;
  completionRate: number;
  workRatio: number;
  personalRatio: number;
}

interface MonthlyTip {
  category: string;
  text: string;
}

interface MonthlyRaioXModalProps {
  visible: boolean;
  onClose: () => void;
  monthlyMetrics: MonthlyMetrics;
  monthlyTips: MonthlyTip[];
  subtitle: string;
  onOpenChatWithPrompt?: (prompt: string) => void;
}

export const MonthlyRaioXModal: React.FC<MonthlyRaioXModalProps> = ({
  visible,
  onClose,
  monthlyMetrics,
  monthlyTips,
  subtitle,
  onOpenChatWithPrompt,
}) => {
  const { colors } = useTheme();

  const handleAskVito = () => {
    onClose();
    if (onOpenChatWithPrompt) {
      onOpenChatWithPrompt(
        `Analise meu desempenho executivo mensal: foram ${monthlyMetrics.totalHours} horas reais em compromissos, taxa de resolução de ${monthlyMetrics.completionRate}%, e foco dividido em ${monthlyMetrics.workRatio}% trabalho e ${monthlyMetrics.personalRatio}% pessoal. O que posso otimizar?`
      );
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Raio-X mensal"
      subtitle={subtitle}
    >
      <ScrollView
        style={styles.modalScroll}
        contentContainerStyle={styles.modalScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.truthBadge, { backgroundColor: colors.surfaceContainerHighest }]}>
          <MaterialIcons name="verified" size={13} color={colors.primary} />
          <Text style={[styles.truthBadgeText, { color: colors.primary }]}>
            SEM DISTORÇÃO 24H
          </Text>
        </View>

        <View
          style={[
            styles.modalNarrativeBox,
            {
              backgroundColor: colors.surfaceContainer,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <View style={styles.synthesisHeaderBadge}>
            <MaterialIcons name="auto-awesome" size={15} color={colors.primary} />
            <Text style={[styles.bentoTag, { color: colors.primary }]}>
              DIAGNÓSTICO DO MÊS
            </Text>
          </View>
          <Text style={[styles.modalNarrativeText, { color: colors.onSurface }]}>
            Neste ciclo você registrou {monthlyMetrics.totalHours} horas reais em compromissos, com taxa de resolução em {monthlyMetrics.completionRate}%. Foco dividido em {monthlyMetrics.workRatio}% trabalho e {monthlyMetrics.personalRatio}% pessoal.
          </Text>
        </View>

        <Text style={[styles.modalSectionHeading, { color: colors.onSurface, marginTop: 16 }]}>
          Recomendações do Vito
        </Text>
        <View style={styles.tipsList}>
          {monthlyTips.map((tip, i) => (
            <View
              key={tip.category}
              style={[
                styles.tipCard,
                {
                  backgroundColor: colors.surfaceContainer,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <Text style={[styles.tipNumber, tabularNumbers, { color: colors.primary }]}>
                {String(i + 1).padStart(2, '0')}
              </Text>
              <View style={styles.tipBody}>
                <Text style={[styles.tipTitle, { color: colors.onSurface }]}>
                  {tip.category}
                </Text>
                <Text
                  style={[styles.tipText, { color: colors.onSurfaceVariant }]}
                  numberOfLines={2}
                >
                  {tip.text}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.modalChatButton, { backgroundColor: colors.primary }]}
          onPress={handleAskVito}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Discutir no chat"
        >
          <MaterialIcons name="chat" size={18} color={colors.onPrimary} />
          <Text style={[styles.modalChatButtonText, { color: colors.onPrimary }]}>
            Discutir no chat
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  modalScroll: {
    marginTop: 2,
  },
  modalScrollContent: {
    paddingBottom: 24,
    paddingHorizontal: 16,
    gap: 8,
  },
  truthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: MD3Shapes.full,
    marginBottom: 8,
  },
  truthBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  modalNarrativeBox: {
    padding: tokens.spacing.md,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    gap: 8,
  },
  synthesisHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bentoTag: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  modalNarrativeText: {
    fontSize: 14,
    lineHeight: 21,
  },
  modalSectionHeading: {
    fontSize: 14,
    fontWeight: '700',
  },
  tipsList: {
    gap: 8,
  },
  tipCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: MD3Shapes.medium,
    borderWidth: 1,
    gap: 12,
    alignItems: 'center',
  },
  tipNumber: {
    fontSize: 16,
    fontWeight: '700',
  },
  tipBody: {
    flex: 1,
    gap: 2,
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  tipText: {
    fontSize: 12,
    lineHeight: 16,
  },
  modalChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: MD3Shapes.large,
    marginTop: 16,
  },
  modalChatButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
