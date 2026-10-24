export interface IdeaCard {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  prompt: string;
  layout: 'agenda' | 'gmail' | 'whatsapp' | 'radar' | 'task';
}

export const IDEA_CARDS: IdeaCard[] = [
  {
    id: 'agenda',
    tag: 'Agenda',
    title: 'Organizar a semana',
    subtitle: 'Revisa horários, eventos e compromissos',
    prompt: 'Organiza a minha agenda da semana',
    layout: 'agenda',
  },
  {
    id: 'emails',
    tag: 'Gmail',
    title: 'Resumo dos e-mails',
    subtitle: 'Destaca mensagens urgentes e pendências',
    prompt: 'Resume os meus e-mails importantes de hoje',
    layout: 'gmail',
  },
  {
    id: 'whatsapp',
    tag: 'WhatsApp',
    title: 'Responder mensagens',
    subtitle: 'Rascunha respostas quando você estiver ocupado',
    prompt: 'Responde as mensagens do WhatsApp por mim quando eu estiver ocupado',
    layout: 'whatsapp',
  },
  {
    id: 'flight',
    tag: 'Radar',
    title: 'Voo para o Rio',
    subtitle: 'Alerta quando o preço baixar de R$ 600',
    prompt: 'Me avisa quando o voo para o Rio baixar de R$ 600',
    layout: 'radar',
  },
  {
    id: 'bills',
    tag: 'Tarefas',
    title: 'Contas e boletos',
    subtitle: 'Lembrar de pagamentos antes de vencer',
    prompt: 'Lembra das minhas contas e boletos antes de vencer',
    layout: 'task',
  },
  {
    id: 'schedule_msg',
    tag: 'WhatsApp',
    title: 'Agendar mensagem',
    subtitle: 'Envio programado para amanhã às 09h',
    prompt: 'Agenda uma mensagem de WhatsApp para amanhã às 9h',
    layout: 'whatsapp',
  },
  {
    id: 'briefing',
    tag: 'Agenda',
    title: 'Resumo executivo',
    subtitle: 'Síntese diária de foco e prioridades',
    prompt: 'Manda um resumo executivo do meu dia toda manhã',
    layout: 'agenda',
  },
];

export const CAROUSEL_TIMING = {
  durationMs: 380,
  bezier: [0.2, 0.8, 0.2, 1] as const,
  swipeThresholdPx: 26,
  dragScalePx: 155,
  spring: {
    damping: 22,
    stiffness: 240,
    mass: 0.8,
  },
};

export function getCardOffset(index: number, cur: number, total: number): number {
  let d = (index - cur + total) % total;
  if (d > total / 2) {
    d = d - total;
  }
  return d;
}

export function getCardVisualSpec(effDistance: number) {
  if (effDistance === 0) {
    return { tx: 0, rot: '0deg', scale: 1.0, op: 1.0 };
  } else if (effDistance === 1) {
    return { tx: 58, rot: '5deg', scale: 0.93, op: 1.0 };
  } else if (effDistance === -1) {
    return { tx: -58, rot: '-5deg', scale: 0.93, op: 1.0 };
  } else if (effDistance >= 2) {
    return { tx: 86, rot: '8deg', scale: 0.86, op: 0.0 };
  } else {
    return { tx: -86, rot: '-8deg', scale: 0.86, op: 0.0 };
  }
}
