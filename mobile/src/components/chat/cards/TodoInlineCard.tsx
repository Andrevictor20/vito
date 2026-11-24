import React, { useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { Todo } from '../../../types';
import { formatTodoDue } from '../../../utils/chatCards';
import { CheckCircleIcon } from '../../login/DemoIcons';
import { tabNavigationBus, chatPromptBus } from '../../../services/dataSync';
import { hapticFeedback } from '../../../theme/motion';
import { PressableScale } from '../../../theme/vitoMotion';

interface TodoInlineCardProps {
  todo: Todo;
  onToggle?: (id: string) => void;
  onUndo?: () => void;
}

/**
 * Card in-chat de criação de tarefa alinhado ao protótipo `vito-telas.html`:
 * - Card arredondado com chip roxo 44x44px e ícone de check.
 * - Título da tarefa em Inter 600 SemiBold e subtítulo contextual (data, prioridade, categoria).
 * - Botões de ação em formato pílula abaixo do card: "Desfazer" (outline) e "Ver tarefas" (solid ink).
 */
export const TodoInlineCard: React.FC<TodoInlineCardProps> = ({ todo, onToggle, onUndo }) => {
  const { colors } = useTheme();
  const [undone, setUndone] = useState(false);

  const priorityLabel =
    todo.priority === 'high'
      ? 'prioridade alta'
      : todo.priority === 'medium'
      ? 'prioridade média'
      : 'prioridade baixa';

  const dateLabel = formatTodoDue(todo.due_date);
  const subtitleParts = [dateLabel !== 'Sem prazo' ? dateLabel : null, priorityLabel, todo.category || 'Tarefas'].filter(Boolean);
  const subtitleText = subtitleParts.join(' · ');

  const handleUndo = () => {
    hapticFeedback.light();
    setUndone(true);
    if (onUndo) {
      onUndo();
    } else {
      chatPromptBus.notify(`Desfazer criação da tarefa "${todo.title}"`);
    }
  };

  const handleViewTasks = () => {
    hapticFeedback.selection();
    tabNavigationBus.notify('tasks');
  };

  return (
    <View style={styles.wrapper}>
      {/* Card Principal */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surf },
          undone && { opacity: 0.5 },
        ]}
      >
        {/* Chip Roxo 40x40 com CheckCircleIcon */}
        <View style={[styles.chip, { backgroundColor: colors.purpleBg }]}>
          <CheckCircleIcon color={colors.purple} size={20} />
        </View>

        {/* Informações da Tarefa */}
        <View style={styles.titleCol}>
          <Text
            style={[styles.title, { color: colors.ink }]}
            numberOfLines={2}
          >
            {todo.title}
          </Text>
          <Text
            style={[styles.subtitle, { color: colors.muted }]}
            numberOfLines={1}
          >
            {subtitleText}
          </Text>
        </View>
      </View>

      {/* Botões de Ação Abaixo do Card */}
      {!undone && (
        <View style={styles.actionsRow}>
          <PressableScale
            style={[styles.btnOutline, { backgroundColor: colors.surf }]}
            onPress={handleUndo}
            accessibilityRole="button"
            accessibilityLabel="Desfazer criação da tarefa"
          >
            <Text style={[styles.btnOutlineText, { color: colors.ink }]}>
              Desfazer
            </Text>
          </PressableScale>

          <PressableScale
            style={[styles.btnFill, { backgroundColor: colors.ink }]}
            onPress={handleViewTasks}
            accessibilityRole="button"
            accessibilityLabel="Ver tarefas"
          >
            <Text style={[styles.btnFillText, { color: colors.bg }]}>
              Ver tarefas
            </Text>
          </PressableScale>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 8,
    width: '100%',
  },
  card: {
    borderRadius: 22,
    borderWidth: 0,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Geist_500Medium',
    fontSize: 14.5,
    fontWeight: '500',
    lineHeight: 19,
  },
  subtitle: {
    fontFamily: 'Geist',
    fontSize: 12.5,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  btnOutline: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutlineText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
    fontWeight: '500',
  },
  btnFill: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFillText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
    fontWeight: '500',
  },
});
