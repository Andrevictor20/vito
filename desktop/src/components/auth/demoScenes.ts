export type DemoTone = 'blue' | 'red' | 'orange' | 'acc' | 'purple';

export type DemoCardKind =
  | 'agenda'
  | 'email'
  | 'radar'
  | 'whatsapp'
  | 'email-draft'
  | 'tarefa'
  | 'boleto';

export interface DemoSceneCardChip {
  kind: DemoCardKind;
  title: string;
  subtitle?: string;
  trailing?: 'check' | 'chart' | 'pills' | 'tag';
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
  'ler seus e-mails',
  'monitorar preços',
  'cuidar do WhatsApp',
  'escrever e-mails',
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
    id: 'emails',
    headline: 'ler seus e-mails',
    tone: 'red',
    userText: 'Tem e-mail importante hoje?',
    vitoText: '3 novos. O da Ana pede resposta até hoje.',
    card: {
      kind: 'email',
      title: 'Ana Souza · Proposta',
      subtitle: 'Pede resposta hoje · Gmail',
      trailing: 'tag',
      tagLabel: 'Urgente',
      tagTone: 'red',
    },
  },
  {
    id: 'voo-rio',
    headline: 'monitorar preços',
    tone: 'orange',
    userText: 'Me avisa se o voo pro Rio baixar de R$ 600',
    vitoText: 'Radar criado. Eu confiro todo dia.',
    card: {
      kind: 'radar',
      title: 'Voo para o Rio',
      subtitle: 'Hoje R$ 742 · alerta abaixo de R$ 600',
      trailing: 'chart',
    },
  },
  {
    id: 'isa-whatsapp',
    headline: 'cuidar do WhatsApp',
    tone: 'acc',
    userText: 'Responde a Isa que chego às 19h',
    vitoText: 'Rascunho pronto. Quer que eu envie?',
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
    id: 'escrever-email',
    headline: 'escrever e-mails',
    tone: 'red',
    userText: 'Escreve pro Carlos confirmando a reunião de quinta',
    vitoText: 'Rascunho pronto no seu Gmail.',
    card: {
      kind: 'email-draft',
      title: 'Para Carlos · E-mail',
      bubbleTitle: 'Confirmação da reunião',
      bubbleText: 'Oi Carlos, confirmo nossa reunião de quinta às 10h.',
      trailing: 'pills',
      bubbleTone: 'red',
      isCol: true,
    },
  },
  {
    id: 'boleto',
    headline: 'não perder prazos',
    tone: 'purple',
    userText: 'Paga esse boleto até sexta',
    vitoText: 'Li o boleto e criei a tarefa.',
    card: {
      kind: 'boleto',
      title: 'Pagar boleto · R$ 248,90',
      subtitle: 'Vence sexta · prioridade alta',
      trailing: 'tag',
      tagLabel: 'Tarefa',
      tagTone: 'purple',
    },
    photo: true,
  },
] as const;

export function getToneColor(tone: DemoTone, isDark: boolean): string {
  switch (tone) {
    case 'blue':
      return isDark ? '#5aa2ee' : '#2b7fd4';
    case 'red':
      return isDark ? '#ff6b8a' : '#d6355a';
    case 'orange':
      return isDark ? '#ff9a52' : '#d9681a';
    case 'purple':
      return isDark ? '#a58bff' : '#7a4fe0';
    case 'acc':
    default:
      return isDark ? '#34d399' : '#0b9a5f';
  }
}
