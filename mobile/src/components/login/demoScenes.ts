export interface DemoSceneCardChip {
  kind: 'agenda' | 'radar' | 'tarefa' | 'boleto'
  title: string
  subtitle: string
  trailing: 'check' | 'chart' | 'pills' | 'tag'
}

export interface DemoScene {
  id: string
  userText: string
  vitoText: string
  card: DemoSceneCardChip
  /** Cena 4 exibe miniatura de boleto acima do texto na bolha do usuário. */
  photo?: boolean
}

/**
 * Quatro cenas da demonstração animada da tela de login.
 * Dados estáticos, sem rede, sem store, sem analytics.
 */
export const DEMO_SCENES: readonly DemoScene[] = [
  {
    id: 'dentista',
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
    id: 'voo-rio',
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
    userText: 'Responde a Isa que chego às 19h',
    vitoText: 'Rascunho pronto. Quer que eu envie?',
    card: {
      kind: 'tarefa',
      title: 'Resposta para Isa · WhatsApp',
      subtitle: 'Oi! Chego às 19h.',
      trailing: 'pills',
    },
  },
  {
    id: 'boleto',
    userText: 'Paga esse boleto até sexta',
    vitoText: 'Li o boleto e criei a tarefa.',
    card: {
      kind: 'boleto',
      title: 'Pagar boleto · R$ 248,90',
      subtitle: 'Vence sexta · prioridade alta',
      trailing: 'tag',
    },
    photo: true,
  },
] as const

export const DEMO_SCENE_COUNT = DEMO_SCENES.length

export function demoSceneById(id: string): DemoScene | undefined {
  return DEMO_SCENES.find((s) => s.id === id)
}

export function nextSceneIndex(current: number): number {
  return (current + 1) % DEMO_SCENE_COUNT
}
