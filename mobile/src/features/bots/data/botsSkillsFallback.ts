import {
  MASCOT_PRESETS as CANONICAL_MASCOT_PRESETS,
  type MascotPreset as CanonicalMascotPreset,
} from '../mascot/mascotPalettes';
import { BotSkin, SkillPackage } from '../types/bots';

export interface MascotPreset {
  key: string;
  name: string;
  tag: string;
  darkStage: boolean;
  skin: BotSkin;
}

export const MASCOT_PRESETS: MascotPreset[] = CANONICAL_MASCOT_PRESETS.map(
  (p: CanonicalMascotPreset) => ({
    key: p.id,
    name: p.name,
    tag: p.tag,
    darkStage: p.darkStage,
    skin: {
      preset: p.id,
      fill: p.fill,
      stroke: p.stroke,
      eyes: p.eyes,
      bowtie: p.bowtie,
      hat: p.hat,
      band: p.band,
    },
  })
);

export const ASK_VITO_CHIPS: { label: string; prompt: string }[] = [
  {
    label: 'Resumo da manhã',
    prompt: 'Crie um bot de Resumo da manhã para me atualizar todo dia às 08:00.',
  },
  {
    label: 'Hora de sair',
    prompt: 'Crie um bot Hora de sair para me avisar quando devo sair para meus compromissos.',
  },
  {
    label: 'Editais',
    prompt: 'Crie um bot de Garimpo de editais para acompanhar novos editais e prazos.',
  },
  {
    label: 'Fatura',
    prompt: 'Crie um bot Cobrador de contas para ler faturas e boletos no meu e-mail.',
  },
];

export const DEFAULT_SKILL_PACKAGES: SkillPackage[] = [
  {
    key: 'cmp',
    version: 1,
    name: 'Comparar preços',
    icon: 'sell',
    description: 'Compara o mesmo item em mais de uma fonte e diz qual é o menor valor.',
    when: 'Quando o bot acompanha preço de voo, produto ou serviço.',
    steps: [
      'Pesquisar em pelo menos duas fontes',
      'Igualar moeda, bagagem e taxas',
      'Apontar o menor preço e a distância até o alvo',
      'Dizer qual fonte não carregou',
    ],
    actions: ['search', 'notify'],
    output_contract: 'Liste preço, fonte e diferença para o alvo.',
  },
  {
    key: 'inv',
    version: 1,
    name: 'Extrair fatura',
    icon: 'receipt',
    description: 'Lê e-mails recentes, extrai valor e vencimento e propõe tarefa.',
    when: 'Quando chega fatura, boleto ou cobrança.',
    steps: [
      'Ler o e-mail mais recente do emissor',
      'Extrair valor, vencimento e emissor',
      'Comparar com o mês anterior',
      'Propor tarefa de pagamento',
    ],
    actions: ['mailr', 'task'],
    output_contract: 'Apresente emissor, valor, vencimento e variação mensal.',
  },
  {
    key: 'prep',
    version: 1,
    name: 'Preparar compromisso',
    icon: 'event-available',
    description: 'Confirma detalhes em duas fontes, verifica agenda e propõe evento.',
    when: 'Antes de jogo, reunião ou evento.',
    steps: [
      'Confirmar data e horário em duas fontes',
      'Verificar horários livres na agenda',
      'Propor criação do evento',
      'Avisar antes do início',
    ],
    actions: ['search', 'free', 'evt'],
    output_contract: 'Informe horário confirmado, conflitos e proposta de evento.',
  },
  {
    key: 'leave',
    version: 1,
    name: 'Hora de sair',
    icon: 'directions',
    description: 'Calcula rota com trânsito atual e avisa o horário exato de saída.',
    when: 'Em compromisso com endereço definido.',
    steps: [
      'Ler o endereço do compromisso',
      'Calcular rota considerando trânsito atual',
      'Avisar o horário ideal de saída',
    ],
    actions: ['route', 'leave', 'notify'],
    output_contract: 'Diga tempo estimado, trânsito e horário limite para sair.',
  },
  {
    key: 'brief',
    version: 1,
    name: 'Resumo diário',
    icon: 'summarize',
    description: 'Resume o que mudou desde ontem sem repetir informações antigas.',
    when: 'Em checagens diárias de assunto, notícias ou gastos.',
    steps: [
      'Identificar o que mudou desde ontem',
      'Cortar informações repetidas',
      'Entregar em até 5 linhas objetivas',
    ],
    actions: ['search', 'notify'],
    output_contract: 'Entregue no máximo 5 linhas com foco apenas em novidades.',
  },
  {
    key: 'card',
    version: 1,
    name: 'E-mail vira cartão',
    icon: 'view-kanban',
    description: 'Converte e-mails acionáveis em cartões na sua lista do Trello.',
    when: 'Quando um e-mail vira pendência de projeto.',
    steps: [
      'Ler e-mail relevante',
      'Extrair título claro e descrição objetiva',
      'Propor cartão na lista combinada',
    ],
    actions: ['mailr', 'tcard'],
    output_contract: 'Mostre título do cartão, lista de destino e resumo.',
  },
  {
    key: 'draft',
    version: 1,
    name: 'Rascunhar resposta',
    icon: 'edit-note',
    description: 'Identifica pendências ou mensagens sem resposta e prepara rascunho.',
    when: 'Quando algo pede resposta ou follow-up.',
    steps: [
      'Ler conversa ou e-mail recente',
      'Detectar pendência ou cobrança sem resposta',
      'Preparar rascunho no seu tom para revisão',
    ],
    actions: ['mailr', 'waread', 'draft'],
    output_contract: 'Apresente o rascunho pronto sem enviar automaticamente.',
  },
  {
    key: 'spend',
    version: 1,
    name: 'Vigiar orçamento',
    icon: 'trending-up',
    description: 'Monitora gastos por categoria e avisa ao passar de 80% do limite.',
    when: 'Em bots de controle financeiro.',
    steps: [
      'Ler gastos consolidados por categoria',
      'Calcular percentual do orçamento usado',
      'Avisar quando ultrapassar 80%',
    ],
    actions: ['spend', 'notify'],
    output_contract: 'Liste categoria, gasto atual, limite e percentual.',
  },
  {
    key: 'tri',
    version: 1,
    name: 'Triagem de e-mails',
    icon: 'inbox',
    description: 'Classifica novos e-mails do Outlook entre urgente, informativo e ruído.',
    when: 'Na caixa de entrada da Microsoft.',
    steps: [
      'Ler novos e-mails não processados',
      'Separar em urgente, informativo ou ruído',
      'Propor tarefas para os itens urgentes',
    ],
    actions: ['omail', 'task'],
    output_contract: 'Agrupe por urgência e proponha tarefas apenas para urgentes.',
  },
];
