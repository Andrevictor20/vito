import React, { useState } from 'react';
import { useTheme } from '../../../../context/ThemeContext';
import { Todo } from '../../../../types';
import { formatTodoDue } from '../../utils/chatCards';
import { CheckCircleIcon } from '../../../../icons/AppGlyphs';
import { tabNavigationBus, chatPromptBus } from '../../../../services/dataSync';
import { hapticFeedback } from '../../../../theme/motion';
import { BaseInlineCard } from './BaseInlineCard';

interface TodoInlineCardProps {
  todo: Todo;
  onToggle?: (id: string) => void;
  onUndo?: () => void;
}

export const TodoInlineCard: React.FC<TodoInlineCardProps> = ({ todo, onUndo }) => {
  const { colors } = useTheme();
  const [undone, setUndone] = useState(false);

  const priorityLabel =
    todo.priority === 'high'
      ? 'prioridade alta'
      : todo.priority === 'medium'
        ? 'prioridade média'
        : 'prioridade baixa';

  const dateLabel = formatTodoDue(todo.due_date);
  const subtitleText = [
    dateLabel !== 'Sem prazo' ? dateLabel : null,
    priorityLabel,
    todo.category || 'Tarefas',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <BaseInlineCard
      icon={<CheckCircleIcon color={colors.purple} size={20} />}
      chipBg={colors.purpleBg}
      title={todo.title}
      titleLines={2}
      subtitle={subtitleText}
      dimmed={undone}
      hideActions={undone}
      secondaryAction={{
        label: 'Desfazer',
        accessibilityLabel: 'Desfazer criação da tarefa',
        onPress: () => {
          hapticFeedback.light();
          setUndone(true);
          if (onUndo) onUndo();
          else chatPromptBus.notify(`Desfazer criação da tarefa "${todo.title}"`);
        },
      }}
      primaryAction={{
        label: 'Ver tarefas',
        accessibilityLabel: 'Ver tarefas',
        onPress: () => {
          hapticFeedback.selection();
          tabNavigationBus.notify('tasks');
        },
      }}
    />
  );
};
