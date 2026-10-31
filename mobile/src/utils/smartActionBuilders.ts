export interface SmartActionItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  variant?: 'ai' | 'primary' | 'destructive' | 'default';
  badge?: string;
  onPress: () => void;
}

export interface AgendaEventPayload {
  id?: string;
  title: string;
  start_at?: string;
  end_at?: string;
  start_time?: string;
  end_time?: string;
  source?: string;
  category?: string;
}

export function formatEventSubtitle(event: AgendaEventPayload): string {
  const isAllDay =
    event.category === 'holiday' ||
    (event.start_at?.includes('00:00:00') &&
      (!event.end_at || event.end_at.includes('23:59:59')));
  if (isAllDay) {
    return event.source ? `Dia inteiro • ${event.source}` : 'Dia inteiro';
  }
  const isoStart = event.start_at || event.start_time;
  const isoEnd = event.end_at || event.end_time;
  if (!isoStart) return event.source || 'Compromisso';
  try {
    const dStart = new Date(isoStart);
    const timeStart = dStart.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    let timeEnd = '';
    if (isoEnd) {
      const dEnd = new Date(isoEnd);
      timeEnd = ` - ${dEnd.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    }
    const sourceSuffix = event.source ? ` • ${event.source}` : '';
    return `${timeStart}${timeEnd}${sourceSuffix}`;
  } catch {
    return event.source || 'Compromisso';
  }
}

export interface AgendaSmartActionsOptions {
  onAskVitoReschedule: (prompt: string) => void;
  onAskVitoMoveTomorrow: (prompt: string) => void;
  onAskVitoBriefing: (prompt: string) => void;
  onAskVitoCancel: (prompt: string) => void;
  onEditDirectly?: () => void;
}

export function buildAgendaSmartActions(
  event: AgendaEventPayload,
  options: AgendaSmartActionsOptions
): SmartActionItem[] {
  const actions: SmartActionItem[] = [
    {
      id: 'reschedule',
      title: 'Reagendar com Vito',
      subtitle: 'Encontrar um novo horário livre na sua rotina',
      icon: 'auto-awesome',
      variant: 'ai',
      badge: 'IA',
      onPress: () =>
        options.onAskVitoReschedule(
          `Para quando você gostaria de reagendar o evento "${event.title}"?`
        ),
    },
    {
      id: 'move_tomorrow',
      title: 'Adiar para amanhã',
      subtitle: 'Mover este compromisso para o mesmo horário amanhã',
      icon: 'update',
      variant: 'default',
      onPress: () =>
        options.onAskVitoMoveTomorrow(
          `Mova o compromisso "${event.title}" para amanhã`
        ),
    },
    {
      id: 'briefing',
      title: 'Resumo e preparação',
      subtitle: 'Perguntar ao Vito o que você precisa saber antes',
      icon: 'psychology',
      variant: 'ai',
      badge: 'IA',
      onPress: () =>
        options.onAskVitoBriefing(
          `O que eu preciso saber ou me preparar para o compromisso "${event.title}"?`
        ),
    },
  ];

  if (options.onEditDirectly) {
    actions.push({
      id: 'edit_details',
      title: 'Editar detalhes',
      subtitle: 'Ajustar título, local ou horário manualmente',
      icon: 'edit',
      variant: 'default',
      onPress: options.onEditDirectly,
    });
  }

  actions.push({
    id: 'cancel',
    title: 'Cancelar compromisso',
    subtitle: 'Remover este evento da agenda com auxílio da IA',
    icon: 'event-busy',
    variant: 'destructive',
    onPress: () => options.onAskVitoCancel(`Cancela ${event.title}`),
  });

  return actions;
}

export interface TaskRowPayload {
  id: string;
  title: string;
  isCompleted: boolean;
  isOverdue?: boolean;
  priority?: string;
  kind?: 'todo' | 'pending';
}

export interface TaskSmartActionsOptions {
  onToggleComplete: () => void;
  onAskVitoReschedule: (prompt: string) => void;
  onAskVitoBreakdown: (prompt: string) => void;
  onDelete: () => void;
}

export function buildTaskSmartActions(
  row: TaskRowPayload,
  options: TaskSmartActionsOptions
): SmartActionItem[] {
  return [
    {
      id: 'toggle_complete',
      title: row.isCompleted ? 'Reabrir tarefa' : 'Marcar como concluída',
      subtitle: row.isCompleted
        ? 'Mover de volta para tarefas ativas'
        : 'Concluir esta tarefa imediatamente',
      icon: row.isCompleted ? 'undo' : 'check-circle',
      variant: 'primary',
      onPress: options.onToggleComplete,
    },
    {
      id: 'reschedule',
      title: 'Mover ou reagendar com Vito',
      subtitle: 'Pedir ao Vito para encaixar num dia ou horário ideal',
      icon: 'auto-awesome',
      variant: 'ai',
      badge: 'IA',
      onPress: () =>
        options.onAskVitoReschedule(
          `Para qual dia ou horário você quer mover a tarefa "${row.title}"?`
        ),
    },
    {
      id: 'breakdown',
      title: 'Decompor em passos práticos',
      subtitle: 'Pedir ao Vito para quebrar a tarefa em subtarefas',
      icon: 'checklist',
      variant: 'ai',
      badge: 'IA',
      onPress: () =>
        options.onAskVitoBreakdown(
          `Vito, me ajude a quebrar a tarefa "${row.title}" em passos práticos e objetivos`
        ),
    },
    {
      id: 'delete',
      title: 'Excluir tarefa',
      subtitle: 'Remover definitivamente da sua lista',
      icon: 'delete-outline',
      variant: 'destructive',
      onPress: options.onDelete,
    },
  ];
}

export interface TriggerPayload {
  id: string;
  title: string;
  status: 'active' | 'paused' | string;
  check_time?: string;
  type?: string;
}

export interface TriggerSmartActionsOptions {
  onToggleStatus: () => void;
  onAskVitoChangeSchedule: (prompt: string) => void;
  onAskVitoInstantCheck: (prompt: string) => void;
  onAskVitoDelete: (prompt: string) => void;
}

export function buildTriggerSmartActions(
  trigger: TriggerPayload,
  options: TriggerSmartActionsOptions
): SmartActionItem[] {
  const isActive = trigger.status === 'active';
  return [
    {
      id: 'toggle_status',
      title: isActive ? 'Pausar vigília' : 'Retomar vigília',
      subtitle: isActive
        ? 'Suspender checagens automáticas temporariamente'
        : 'Reativar checagens periódicas da IA',
      icon: isActive ? 'pause-circle-outline' : 'play-circle-outline',
      variant: 'primary',
      onPress: options.onToggleStatus,
    },
    {
      id: 'instant_check',
      title: 'Checar vigília agora',
      subtitle: 'Fazer varredura imediata e resumir novidades no chat',
      icon: 'auto-awesome',
      variant: 'ai',
      badge: 'IA',
      onPress: () =>
        options.onAskVitoInstantCheck(
          `Execute uma checagem agora da vigília "${trigger.title}" e me dê um relatório resumido`
        ),
    },
    {
      id: 'change_schedule',
      title: 'Mudar horário ou regras',
      subtitle: 'Ajustar frequência ou critérios com a IA',
      icon: 'schedule',
      variant: 'default',
      onPress: () =>
        options.onAskVitoChangeSchedule(
          `Para qual horário você gostaria de ajustar a checagem da vigília "${trigger.title}"?`
        ),
    },
    {
      id: 'delete',
      title: 'Excluir vigília',
      subtitle: 'Apagar este radar permanentemente',
      icon: 'delete-outline',
      variant: 'destructive',
      onPress: () =>
        options.onAskVitoDelete(
          `Você quer realmente excluir a vigília "${trigger.title}"?`
        ),
    },
  ];
}

export interface BookingItemPayload {
  id: string;
  title: string;
  slug?: string;
  duration?: number;
}

export interface BookingSmartActionsOptions {
  onCopyLink?: () => void;
  onAskVitoCustomize: (prompt: string) => void;
  onAskVitoDuplicate?: (prompt: string) => void;
  onDelete: () => void;
}

export function buildBookingSmartActions(
  item: BookingItemPayload,
  type: 'type' | 'meeting',
  options: BookingSmartActionsOptions
): SmartActionItem[] {
  const actions: SmartActionItem[] = [];

  if (options.onCopyLink) {
    actions.push({
      id: 'copy_link',
      title: 'Copiar link de agendamento',
      subtitle: 'Compartilhar link público com participantes',
      icon: 'content-copy',
      variant: 'primary',
      onPress: options.onCopyLink,
    });
  }

  actions.push({
    id: 'customize',
    title: 'Ajustar com Vito',
    subtitle: 'Personalizar horários, formulário ou regras com o assistente',
    icon: 'auto-awesome',
    variant: 'ai',
    badge: 'IA',
    onPress: () =>
      options.onAskVitoCustomize(
        type === 'type'
          ? `Como você gostaria de personalizar ou ajustar o link "${item.title}"?`
          : `Como você gostaria de ajustar a votação/reunião "${item.title}"?`
      ),
  });

  if (type === 'type' && options.onAskVitoDuplicate) {
    actions.push({
      id: 'duplicate',
      title: 'Duplicar link com Vito',
      subtitle: 'Criar uma nova variação mantendo este link',
      icon: 'control-point-duplicate',
      variant: 'default',
      onPress: () =>
        options.onAskVitoDuplicate!(
          `Deseja criar um novo link baseado em "${item.title}" com quais alterações?`
        ),
    });
  }

  actions.push({
    id: 'delete',
    title: type === 'type' ? 'Excluir link' : 'Excluir reunião',
    subtitle: 'Remover definitivamente este agendamento',
    icon: 'delete-outline',
    variant: 'destructive',
    onPress: options.onDelete,
  });

  return actions;
}
