import React from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { loginPalette } from './loginPalette';

export type LegalDocKind = 'terms' | 'priv';

const DOCS: Record<
  LegalDocKind,
  { title: string; updatedAt: string; sections: readonly { h: string; p: string }[] }
> = {
  terms: {
    title: 'Termos de Uso',
    updatedAt: 'Atualizados em 15 de novembro de 2026',
    sections: [
      {
        h: 'Uso do serviço',
        p: 'O Vito é destinado a maiores de 13 anos. Você é responsável pelo conteúdo que envia e pelas ações que autoriza.',
      },
      {
        h: 'Inteligência artificial',
        p: 'As respostas podem conter imprecisões e não constituem aconselhamento financeiro, jurídico ou médico.',
      },
      {
        h: 'Assinaturas',
        p: 'Planos pagos renovam automaticamente e podem ser cancelados a qualquer momento na loja de aplicativos.',
      },
      {
        h: 'Encerramento',
        p: 'Você pode excluir sua conta quando quiser. Podemos suspender contas que violem estes termos.',
      },
    ],
  },
  priv: {
    title: 'Política de Privacidade',
    updatedAt: 'Atualizada em 15 de novembro de 2026',
    sections: [
      {
        h: 'Dados que coletamos',
        p: 'Conta (nome, e-mail), conteúdo que você cria (eventos, tarefas, conversas) e dados das integrações que você conecta.',
      },
      {
        h: 'Como usamos',
        p: 'Para operar o app, personalizar respostas e melhorar a segurança. Não vendemos seus dados nem os usamos para publicidade.',
      },
      {
        h: 'Provedores de IA',
        p: 'Com o seu consentimento, enviamos o conteúdo necessário a provedores de IA para gerar respostas. Eles não podem usá-lo para treinar modelos.',
      },
      {
        h: 'Retenção e exclusão',
        p: 'Mantemos os dados enquanto a conta existir. Ao excluir a conta, apagamos tudo em até 30 dias.',
      },
      {
        h: 'Seus direitos',
        p: 'Acesse, corrija, exporte ou exclua seus dados a qualquer momento no app ou em privacidade@vito.app.',
      },
    ],
  },
};

export interface LegalDocModalProps {
  doc: LegalDocKind | null;
  onClose: () => void;
}

export const LegalDocModal: React.FC<LegalDocModalProps> = ({ doc, onClose }) => {
  const { isDark } = useTheme();
  const palette = loginPalette(isDark);
  if (!doc) return null;
  const content = DOCS[doc];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={content.title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm select-none"
    >
      <div
        style={{ backgroundColor: palette.bg, borderColor: palette.hairline, color: palette.ink }}
        className="w-full max-w-[460px] rounded-[28px] border p-7 shadow-2xl relative"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          style={{ backgroundColor: palette.btn, color: palette.ink }}
          className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-[22px] font-semibold tracking-tight">{content.title}</h2>
        <p style={{ color: palette.muted }} className="text-xs mt-1 mb-4">
          {content.updatedAt}
        </p>

        <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
          {content.sections.map((s) => (
            <div key={s.h}>
              <h3 className="text-[15px] font-medium mb-1">{s.h}</h3>
              <p style={{ color: palette.muted }} className="text-[13.5px] leading-relaxed">
                {s.p}
              </p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{ backgroundColor: palette.btn, color: palette.ink }}
          className="w-full h-11 rounded-full font-semibold text-sm mt-5 hover:opacity-85 transition-opacity"
        >
          Fechar
        </button>
      </div>
    </div>
  );
};
