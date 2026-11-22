export type LegalDocKind = 'terms' | 'priv'

export interface LegalDocSection {
  heading: string
  body: string
}

export interface LegalDocContent {
  title: string
  updatedAt: string
  sections: readonly LegalDocSection[]
}

export const LEGAL_DOCS: Record<LegalDocKind, LegalDocContent> = {
  terms: {
    title: 'Termos de Uso',
    updatedAt: 'Atualizados em 15 de novembro de 2026',
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
  priv: {
    title: 'Política de Privacidade',
    updatedAt: 'Atualizada em 15 de novembro de 2026',
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
}
