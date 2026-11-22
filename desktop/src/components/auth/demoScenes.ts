export type DemoTone = 'blue' | 'fin' | 'orange' | 'acc' | 'red' | 'purple';

export type DemoCardKind =
  | 'agenda'
  | 'finance'
  | 'radar'
  | 'whatsapp'
  | 'email'
  | 'boleto'
  | 'tarefa';

export interface DemoSceneCardChip {
  kind: DemoCardKind;
  title: string;
  subtitle?: string;
  trailing?: 'check' | 'value' | 'status' | 'tag' | 'pills';
  trailingValue?: string;
  tagLabel?: string;
  tagTone?: 'red' | 'purple' | 'green';
  bubbleTitle?: string;
  bubbleText?: string;
  bubbleTone?: 'green' | 'red';
  isCol?: boolean;
}

export interface DemoScene {
  id: string;
  headline: string;
  tone: DemoTone;
  userText: string;
  vitoText: string;
  card: DemoSceneCardChip;
  photo?: boolean;
}

export const DEMO_HEADLINES = [
  'organizar a agenda',
  'controlar finanças',
  'automatizar rotinas',
  'cuidar do WhatsApp',
  'ler seus e-mails',
  'não perder prazos',
] as const;

export const DEMO_SCENES: readonly DemoScene[] = [
  {
    id: 'dentista',
    headline: 'organizar a agenda',
    tone: 'blue',
    userText: 'Dentista terça às 15h',
    vitoText: 'Marcado. Sem conflitos na sua agenda.',
    card: {
      kind: 'agenda',
      title: 'Dentista',
      subtitle: 'Terça, 15:00 · Google Agenda',
      trailing: 'check',
    },
  },
  {
    id: 'financas-uber',
    headline: 'controlar finanças',
    tone: 'fin',
    userText: 'Quanto gastei com Uber esse mês?',
    vitoText: 'R$ 212,40 em 14 corridas (+18% vs média).',
    card: {
      kind: 'finance',
      title: 'Uber · Outubro',
      subtitle: '14 corridas · Nubank',
      trailing: 'value',
      trailingValue: 'R$ 212',
    },
  },
  {
    id: 'rotina-manha',
    headline: 'automatizar rotinas',
    tone: 'orange',
    userText: 'Todo dia às 7h30, me manda um resumo do meu dia',
    vitoText: 'Bot ativado. Seu resumo chega às 7h30 no WhatsApp.',
    card: {
      kind: 'radar',
      title: 'Resumo da manhã',
      subtitle: 'Todo dia · 07:30 · WhatsApp',
      trailing: 'status',
      tagLabel: 'Ativo',
      tagTone: 'green',
    },
  },
  {
    id: 'isa-whatsapp',
    headline: 'cuidar do WhatsApp',
    tone: 'acc',
    userText: 'Responde a Isa que chego às 19h',
    vitoText: 'Rascunho pronto. Posso enviar?',
    card: {
      kind: 'whatsapp',
      title: 'Para Isa · WhatsApp',
      bubbleText: 'Oi! Chego às 19h.',
      trailing: 'pills',
      bubbleTone: 'green',
      isCol: true,
    },
  },
  {
    id: 'emails',
    headline: 'ler seus e-mails',
    tone: 'red',
    userText: 'Tem algum e-mail urgente hoje?',
    vitoText: 'Sim — Ana Souza pediu retorno na proposta.',
    card: {
      kind: 'email',
      title: 'Ana Souza · Proposta',
      subtitle: 'Responder hoje · Gmail',
      trailing: 'tag',
      tagLabel: 'Urgente',
      tagTone: 'red',
    },
  },
  {
    id: 'boleto',
    headline: 'não perder prazos',
    tone: 'purple',
    userText: 'Lembra de pagar o boleto sexta',
    vitoText: 'Tarefa criada com lembrete às 9h.',
    card: {
      kind: 'boleto',
      title: 'Pagar boleto · R$ 248,90',
      subtitle: 'Sexta · prioridade alta',
      trailing: 'check',
    },
  },
] as const;

export function getToneColor(tone: DemoTone, isDark: boolean): string {
  switch (tone) {
    case 'blue':
      return isDark ? '#3b93ff' : '#0a7cff';
    case 'fin':
      return isDark ? '#ffb938' : '#d98a00';
    case 'orange':
      return isDark ? '#ffa733' : '#f08300';
    case 'red':
      return isDark ? '#ff5468' : '#ff2d46';
    case 'purple':
      return isDark ? '#ff55b0' : '#ff2fa0';
    case 'acc':
    default:
      return isDark ? '#2dd17f' : '#0aa55c';
  }
}
