import React, { useState } from 'react';
import { api } from '../../services/api';
import { X, Sparkles, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

interface CreateTriggerModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

const QUICK_EXAMPLES = [
  { text: 'Acompanhe as ações da PETR3 e avise se passar de R$ 35', cat: 'Finanças' },
  { text: 'Avise se voos GRU para JFK ficarem abaixo de R$ 3.000', cat: 'Viagens' },
  { text: 'Concursos públicos para Analista de TI abertos no Maranhão', cat: 'Carreira' },
  { text: 'Notícias relevantes sobre inteligência artificial e modelos locais', cat: 'Tech' },
];

export const CreateTriggerModal: React.FC<CreateTriggerModalProps> = ({ open, onClose, onCreated }) => {
  const [promptText, setPromptText] = useState('');
  const [category, setCategory] = useState('Finanças');
  const [frequency, setFrequency] = useState('daily_morning');
  const [scheduledTime, setScheduledTime] = useState('08:30');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptText.trim() || submitting) return;

    setSubmitting(true);
    try {
      const trimmed = promptText.trim();
      const title = trimmed.length > 40 ? trimmed.slice(0, 38) + '...' : trimmed;

      await api.request('/api/v1/triggers', {
        method: 'POST',
        body: JSON.stringify({
          title,
          query: trimmed,
          category,
          frequency,
          scheduled_time: scheduledTime,
        }),
      });

      onCreated?.();
      onClose();
      setPromptText('');
    } catch (err: any) {
      alert(err.message || 'Erro ao criar radar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] rounded-[28px] p-7 shadow-2xl text-zinc-900 dark:text-[#FAFAFA] transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-white/5 mb-5">
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Sparkles size={18} className="text-emerald-500" />
              <span>Novo Radar</span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              O Vito pesquisa e avisa das novidades automaticamente
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
              O que o Vito deve monitorar?
            </label>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={3}
              placeholder="Ex: Avise-me se saírem novas matérias sobre o edital do concurso TCE MA..."
              required
              autoFocus
              className="w-full px-4 py-3 bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] rounded-2xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white resize-none transition-colors"
            />
          </div>

          {/* Exemplos Rápidos */}
          <div>
            <span className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Sugestões rápidas
            </span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_EXAMPLES.map((ex, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setPromptText(ex.text);
                    setCategory(ex.cat);
                  }}
                  className="px-2.5 py-1 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-[#1C2026] dark:hover:bg-[#262B33] border border-zinc-200 dark:border-[#222730] text-[11px] text-zinc-700 dark:text-zinc-300 transition-colors text-left truncate max-w-full"
                >
                  {ex.text}
                </button>
              ))}
            </div>
          </div>

          {/* Toggle de Opções Avançadas */}
          <div>
            <button
              type="button"
              onClick={() => setAdvancedOpen(!advancedOpen)}
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              <span>Opções Avançadas</span>
              {advancedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {advancedOpen && (
            <div className="grid grid-cols-2 gap-3.5 pt-2 border-t border-zinc-100 dark:border-white/5 animate-in fade-in duration-100">
              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
                  Categoria
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] rounded-xl text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none"
                >
                  <option value="Finanças">Finanças</option>
                  <option value="Carreira">Carreira & Vagas</option>
                  <option value="Concursos">Concursos Públicos</option>
                  <option value="Tech">Tecnologia & IA</option>
                  <option value="Notícias">Notícias & Política</option>
                  <option value="Viagens">Viagens & Voos</option>
                  <option value="Estudos">Estudos & Cursos</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
                  Frequência
                </label>
                <select
                  value={frequency}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFrequency(val);
                    if (val === 'daily_morning') setScheduledTime('08:30');
                    if (val === 'daily_evening') setScheduledTime('18:00');
                  }}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] rounded-xl text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none"
                >
                  <option value="daily_morning">Matinal (08:30)</option>
                  <option value="daily_evening">Noturna (18:00)</option>
                  <option value="hourly">De hora em hora</option>
                  <option value="immediate">Em tempo real</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
                  Horário do Relatório
                </label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] rounded-xl text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-full text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!promptText.trim() || submitting}
              className="px-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-[#09090B] text-xs font-bold uppercase tracking-wider rounded-full shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              <span>Criar Radar</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
