import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Star } from 'lucide-react';
import { api } from '../../services/api';
import { FAQ_ITEMS, LEGAL_DOCS } from './StoreCatalogData';
import { VitoMascot } from '../common/VitoMascot';
import { Button } from '../ui/Button';

interface StoreHelpViewProps {
  onToast: (msg: string) => void;
}

export const StoreHelpView: React.FC<StoreHelpViewProps> = ({ onToast }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [supportMsg, setSupportMsg] = useState('');
  const [reportReason, setReportReason] = useState('Informação incorreta');
  const [stars, setStars] = useState(0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-[var(--bg)] border border-[var(--line)] space-y-2.5">
          <b className="text-sm block">Falar com o suporte</b>
          <textarea
            value={supportMsg}
            onChange={(e) => setSupportMsg(e.target.value)}
            rows={3}
            placeholder="Como podemos ajudar?"
            className="w-full p-3 rounded-xl border border-[var(--line)] bg-[var(--surf)] text-xs"
          />
          <Button
            variant="pri"
            size="sm"
            pill
            disabled={!supportMsg.trim()}
            onClick={async () => {
              await api.store.sendSupportContact(supportMsg.trim()).catch(() => {});
              setSupportMsg('');
              onToast('Mensagem enviada para suporte@vito.app');
            }}
          >
            Enviar mensagem
          </Button>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--bg)] border border-[var(--line)] space-y-3">
          <b className="text-sm block">Denunciar resposta da IA</b>
          <select
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            className="w-full h-9 px-3 rounded-xl border border-[var(--line)] bg-[var(--surf)] text-xs"
          >
            <option>Informação incorreta</option>
            <option>Conteúdo ofensivo ou perigoso</option>
            <option>Vazamento de dados pessoais</option>
            <option>Outro motivo</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            pill
            onClick={async () => {
              await api.store.reportAiContent(reportReason).catch(() => {});
              onToast('Denúncia enviada. Obrigado!');
            }}
          >
            Enviar denúncia
          </Button>

          <div className="pt-2 border-t border-[var(--line)]">
            <b className="text-xs block mb-1.5">Avaliar o Vito</b>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setStars(n);
                    onToast(`Obrigado pela nota ${n}/5!`);
                  }}
                  className="p-1"
                >
                  <Star
                    size={20}
                    className={n <= stars ? 'text-[var(--fin)] fill-[var(--fin)]' : 'text-[var(--muted)]'}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-[var(--bg)] border border-[var(--line)] divide-y divide-[var(--line)]">
        {FAQ_ITEMS.map((item, idx) => (
          <div key={item.q}>
            <button
              type="button"
              onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
              className="w-full p-4 flex items-center justify-between text-left text-sm font-semibold"
            >
              <span>{item.q}</span>
              {openFaq === idx ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {openFaq === idx && (
              <p className="px-4 pb-4 text-xs text-[var(--muted)] leading-relaxed">{item.a}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export const StoreAboutView: React.FC = () => {
  const [docKey, setDocKey] = useState<'terms' | 'priv' | 'oss' | null>(null);

  return (
    <div className="space-y-4">
      <div className="p-6 rounded-2xl bg-[var(--bg)] border border-[var(--line)] flex flex-col items-center text-center gap-2">
        <VitoMascot size={54} state="idle" />
        <h3 className="text-xl font-bold">Vito</h3>
        <p className="text-xs text-[var(--muted)]">
          Seu assistente pessoal com IA · © 2026 Vito Tecnologia Ltda.
        </p>
        <span className="text-[11px] text-[var(--muted)]">
          Versão 1.0.0 · build OTA 01a1663 · Classificação indicativa: 13+
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['terms', 'Termos de Uso'],
            ['priv', 'Política de Privacidade'],
            ['oss', 'Licenças de código aberto'],
          ] as const
        ).map(([k, lbl]) => (
          <Button key={k} variant="outline" size="sm" pill onClick={() => setDocKey(docKey === k ? null : k)}>
            {lbl}
          </Button>
        ))}
      </div>

      {docKey && (
        <div className="p-4 rounded-2xl bg-[var(--bg)] border border-[var(--line)] space-y-2">
          <h4 className="text-sm font-bold">{LEGAL_DOCS[docKey].title}</h4>
          <p className="text-[11px] text-[var(--muted)]">{LEGAL_DOCS[docKey].subtitle}</p>
          {LEGAL_DOCS[docKey].sections.map((s) => (
            <div key={s.heading} className="pt-1">
              <b className="text-xs block">{s.heading}</b>
              <p className="text-xs text-[var(--muted)]">{s.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
