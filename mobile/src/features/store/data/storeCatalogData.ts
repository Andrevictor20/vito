export interface PlanDefinition {
  id: 'pro' | 'ultra';
  name: string;
  badge: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
}

export const STORE_PLANS: PlanDefinition[] = [
  {
    id: 'pro',
    name: 'Pro',
    badge: 'Popular',
    monthlyPrice: 29.9,
    yearlyPrice: 249.9,
    features: [
      'Bots e automações ilimitados',
      'Todas as integrações e Vito Finance',
      'Modelos avançados e voz neural',
      'Resumos diários, semanais e mensais',
    ],
  },
  {
    id: 'ultra',
    name: 'Ultra',
    badge: 'Mais completo',
    monthlyPrice: 69.9,
    yearlyPrice: 599.9,
    features: [
      'Tudo do Pro',
      'Modelos de raciocínio mais poderosos',
      'Agentes autônomos 24h',
      'Memória ilimitada e suporte prioritário',
    ],
  },
];

export const DEVICE_PERMISSION_ROWS = [
  { key: 'notifications' as const, label: 'Notificações', desc: 'Lembretes, alertas e aprovações' },
  { key: 'calendar' as const, label: 'Calendário', desc: 'Sincronizar a agenda do aparelho' },
  { key: 'microphone' as const, label: 'Microfone', desc: 'Conversa e comandos por voz' },
  { key: 'contacts' as const, label: 'Contatos', desc: 'Sugerir participantes' },
  { key: 'location' as const, label: 'Localização', desc: 'Trânsito e lugares próximos' },
];

export const NOTIFICATION_CATEGORY_ROWS = [
  { key: 'agenda' as const, label: 'Agenda', desc: 'Eventos e conflitos' },
  { key: 'tarefas' as const, label: 'Tarefas', desc: 'Prazos e atrasos' },
  { key: 'financas' as const, label: 'Finanças', desc: 'Boletos e faturas' },
  { key: 'bots' as const, label: 'Bots', desc: 'Aprovações pendentes' },
  { key: 'resumo' as const, label: 'Resumos', desc: 'Diário às 7h' },
  { key: 'promo' as const, label: 'Novidades e ofertas', desc: 'Opcional' },
];

export const FAQ_ITEMS = [
  {
    q: 'O Vito pode errar?',
    a: 'Sim. Respostas de IA podem conter erros. Revise datas, valores e decisões importantes antes de agir.',
  },
  {
    q: 'Como cancelo a assinatura?',
    a: 'Pelo Google Play, em Pagamentos e assinaturas. O acesso continua até o fim do período pago.',
  },
  {
    q: 'Como excluir minha conta?',
    a: 'Perfil › Privacidade e dados › Excluir minha conta.',
  },
  {
    q: 'O Vito lê meus e-mails?',
    a: 'Somente se você conectar o Gmail, e apenas para encontrar boletos, faturas e voos. Desconecte quando quiser.',
  },
];

export const LEGAL_DOCS = {
  priv: {
    title: 'Política de Privacidade',
    subtitle: 'Atualizada em 15 de novembro de 2026',
    sections: [
      {
        heading: 'Dados que coletamos',
        body: 'Conta (nome, e-mail), conteúdo que você cria (eventos, tarefas, conversas) e dados das integrações que você conecta.',
      },
      {
        heading: 'Como usamos',
        body: 'Para operar o app, personalizar respostas e melhorar a segurança. Não vendemos seus dados nem os usamos para publicidade.',
      },
      {
        heading: 'Provedores de IA',
        body: 'Com o seu consentimento, enviamos o conteúdo necessário a provedores de IA para gerar respostas. Eles não podem usá-lo para treinar modelos.',
      },
      {
        heading: 'Retenção e exclusão',
        body: 'Mantemos os dados enquanto a conta existir. Ao excluir a conta, apagamos tudo em até 30 dias.',
      },
      {
        heading: 'Seus direitos',
        body: 'Acesse, corrija, exporte ou exclua seus dados a qualquer momento no app ou em privacidade@vito.app.',
      },
    ],
  },
  terms: {
    title: 'Termos de Uso',
    subtitle: 'Atualizados em 15 de novembro de 2026',
    sections: [
      {
        heading: 'Uso do serviço',
        body: 'O Vito é destinado a maiores de 13 anos. Você é responsável pelo conteúdo que envia e pelas ações que autoriza.',
      },
      {
        heading: 'Inteligência artificial',
        body: 'As respostas podem conter imprecisões e não constituem aconselhamento financeiro, jurídico ou médico.',
      },
      {
        heading: 'Assinaturas',
        body: 'Planos pagos renovam automaticamente e podem ser cancelados a qualquer momento na loja de aplicativos.',
      },
      {
        heading: 'Encerramento',
        body: 'Você pode excluir sua conta quando quiser. Podemos suspender contas que violem estes termos.',
      },
    ],
  },
  oss: {
    title: 'Licenças de código aberto',
    subtitle: 'Bibliotecas usadas no Vito',
    sections: [
      { heading: 'Geist (fonte)', body: 'SIL Open Font License 1.1' },
      { heading: 'React Native', body: 'MIT License' },
      { heading: 'SQLite', body: 'Domínio público' },
    ],
  },
};
