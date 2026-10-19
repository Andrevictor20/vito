import React, { useState, useEffect } from 'react';
import { Trigger } from '../../types';
import { X, Sparkles, Trash2, Loader2, Save } from 'lucide-react';

interface EditTriggerModalProps {
  open: boolean;
  trigger: Trigger | null;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Trigger>) => Promise<void>;
  onDeleteRequest: (trigger: Trigger) => void;
}

const FREQUENCY_OPTIONS = [
  { id: 'daily_morning', label: 'Manhã (08:30)' },
  { id: 'daily_evening', label: 'Fim do dia (18h)' },
  { id: 'hourly', label: 'A cada hora' },
  { id: 'immediate', label: 'A cada 5 min' },
];

export const EditTriggerModal: React.FC<EditTriggerModalProps> = ({
  open,
  trigger,
  onClose,
  onSave,
  onDeleteRequest,
}) => {
  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const [frequency, setFrequency] = useState('daily_morning');
  const [scheduledTime, setScheduledTime] = useState('08:30');
  const [status, setStatus] = useState<'active' | 'paused'>('active');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (trigger) {
      setTitle(trigger.title || '');
      setQuery(trigger.query || '');
      setFrequency(trigger.frequency || 'daily_morning');
      setScheduledTime(trigger.scheduled_time || '08:30');
      setStatus(trigger.status === 'paused' ? 'paused' : 'active');
      setError(null);
    }
  }, [trigger, open]);

  if (!open || !trigger) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('O título do radar é obrigatório.');
      return;
    }
    if (!query.trim()) {
      setError('A instrução de monitoramento é obrigatória.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(trigger.id, {
        title: title.trim(),
        query: query.trim(),
        frequency,
        scheduled_time: scheduledTime.trim(),
        status,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Falha ao salvar alterações.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] rounded-[28px] p-7 shadow-2xl text-zinc-900 dark:text-[#FAFAFA] transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-white/5 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white leading-tight">
                Editar Radar
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Ajuste os parâmetros de monitoramento deste radar
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-xs text-red-600 dark:text-red-400 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
              Título do Radar
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Vagas Desenvolvedor Sênior"
              required
              className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
              O que o Vito deve monitorar?
            </label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={3}
              placeholder="Ex: Acompanhar concursos abertos e notícias sobre editais..."
              required
              className="w-full px-4 py-3 bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] rounded-2xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white resize-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
                Frequência
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] rounded-xl text-xs font-medium text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors"
              >
                {FREQUENCY_OPTIONS.map((f) => (
                  <option key={f.id} value={f.id} className="bg-white dark:bg-[#14171C]">
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
                Horário Agendado
              </label>
              <div className="relative">
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] rounded-xl text-xs font-medium text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Status Switch */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730]">
            <div>
              <span className="text-xs font-bold text-zinc-900 dark:text-white block">
                Monitoramento Ativo
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {status === 'active'
                  ? 'O Vito continuará verificando novidades automaticamente'
                  : 'Radar pausado temporariamente'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setStatus((prev) => (prev === 'active' ? 'paused' : 'active'))}
              className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                status === 'active' ? 'bg-[#10B981]' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  status === 'active' ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-white/5">
            <button
              type="button"
              onClick={() => {
                onClose();
                onDeleteRequest(trigger);
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors p-1"
            >
              <Trash2 size={14} />
              <span>Excluir Radar</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 rounded-full border border-zinc-200 dark:border-[#222730] text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-[#09090B] text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                <span>Salvar Alterações</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
