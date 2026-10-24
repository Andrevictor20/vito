import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { tokens } from '../../theme/tokens';
import { hapticFeedback } from '../../theme/motion';
import { VitoLoginMark } from '../login/VitoLoginMark';

interface VitoSuggestionCardProps {
  overdueCount: number;
  onReschedule: () => void;
  onDismiss: () => void;
  loading?: boolean;
}

/**
 * Card de sugestão inteligente do Vito (.vsug) fiel a vito-telas.html.
 * - Ícone SVG do Vito (30x32px)
 * - Mensagem: "Y tarefas atrasadas. Quer que eu reagende para hoje?"
 * - Botão "Reagendar" (.p): fundo colors.ink, texto colors.bg
 * - Botão "Depois": fundo transparente, borda 1.5px colors.ink, texto colors.ink
 */
export const VitoSuggestionCard: React.FC<VitoSuggestionCardProps> = ({
  overdueCount,
  onReschedule,
  onDismiss,
  loading = false,
}) => {
  const { colors, isDark } = useTheme();

  if (overdueCount <= 0) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? colors.surf : colors.bg,
          borderColor: colors.line,
        },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`Sugestão do Vito: ${overdueCount} tarefas atrasadas. Quer que eu reagende para hoje?`}
    >
      <View style={styles.iconSlot}>
        <VitoLoginMark color={colors.ink} width={30} height={32} />
      </View>

      <View style={styles.content}>
        <Text
          style={[
            styles.message,
            {
              color: colors.ink,
              fontFamily: tokens.typography.family.regular,
            },
          ]}
        >
          {overdueCount === 1
            ? '1 tarefa atrasada. Quer que eu reagende para hoje?'
            : `${overdueCount} tarefas atrasadas. Quer que eu reagende para hoje?`}
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[
              styles.btn,
              styles.primaryBtn,
              {
                backgroundColor: colors.ink,
                borderColor: colors.ink,
              },
            ]}
            onPress={() => {
              hapticFeedback.selection();
              onReschedule();
            }}
            disabled={loading}
            activeOpacity={0.8}
            hitSlop={tokens.hitSlop.sm}
            accessibilityRole="button"
            accessibilityLabel="Reagendar tarefas atrasadas para hoje"
          >
            <Text
              style={[
                styles.btnText,
                styles.primaryBtnText,
                {
                  color: colors.bg,
                  fontFamily: tokens.typography.family.semibold,
                },
              ]}
            >
              {loading ? 'Reagendando...' : 'Reagendar'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.btn,
              styles.secondaryBtn,
              {
                borderColor: colors.ink,
              },
            ]}
            onPress={() => {
              hapticFeedback.selection();
              onDismiss();
            }}
            disabled={loading}
            activeOpacity={0.7}
            hitSlop={tokens.hitSlop.sm}
            accessibilityRole="button"
            accessibilityLabel="Dispensar sugestão de reagendamento"
          >
            <Text
              style={[
                styles.btnText,
                styles.secondaryBtnText,
                {
                  color: colors.ink,
                  fontFamily: tokens.typography.family.semibold,
                },
              ]}
            >
              Depois
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    shadowColor: '#141916',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  iconSlot: {
    width: 30,
    height: 32,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    margin: 0,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  btn: {
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  primaryBtn: {},
  secondaryBtn: {
    backgroundColor: 'transparent',
  },
  btnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  primaryBtnText: {},
  secondaryBtnText: {},
});
