export interface FocusMode {
  id: string;
  title: string;
  description: string;
  iconName: string;
}

export const FOCUS_MODES: FocusMode[] = [
  {
    id: 'calendar',
    title: 'Agenda & Eventos',
    description: 'Compromissos, horários, conflitos e sincronização',
    iconName: 'event',
  },
  {
    id: 'tasks',
    title: 'Tarefas & Prioridades',
    description: 'Afazeres, prazos, prioridades e lembretes recorrentes',
    iconName: 'check-box',
  },
  {
    id: 'triggers',
    title: 'Vigílias & Radares',
    description: 'Monitoramento contínuo de faturas, contas e alertas',
    iconName: 'radar',
  },
  {
    id: 'meetings',
    title: 'Booking & Reuniões',
    description: 'Links públicos de agendamento e consenso de grupo',
    iconName: 'event-available',
  },
  {
    id: 'briefing',
    title: 'Briefing Executivo',
    description: 'Panorama do dia, pendências críticas e prioridades',
    iconName: 'auto-awesome',
  },
  {
    id: 'memory',
    title: 'Memória & Rotinas',
    description: 'Preferências, hábitos e contexto pessoal duradouro',
    iconName: 'psychology',
  },
];
