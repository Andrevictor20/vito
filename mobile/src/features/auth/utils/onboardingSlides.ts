export interface OnboardingSlide {
  id: string
  title: string
  description: string
}

export const ONBOARDING_SLIDES: readonly OnboardingSlide[] = [
  {
    id: 'intro',
    title: 'Conheça o Vito',
    description:
      'Seu assistente pessoal com IA para organizar a rotina: agenda, tarefas e finanças em um só lugar.',
  },
  {
    id: 'agenda-tarefas',
    title: 'Agenda e tarefas sem esforço',
    description:
      'Fale ou digite do seu jeito. O Vito marca compromissos, cria tarefas e lembra você na hora certa.',
  },
  {
    id: 'financas',
    title: 'Suas finanças, conectadas',
    description:
      'Conecte seus bancos com Open Finance e acompanhe saldo, gastos e faturas em tempo real.',
  },
  {
    id: 'bots',
    title: 'Bots que trabalham por você',
    description:
      'Bots vigiam o que importa e só agem depois da sua aprovação. Você sempre no controle.',
  },
] as const
