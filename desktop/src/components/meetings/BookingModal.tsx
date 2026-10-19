import React, { useState } from 'react';
import { api } from '../../services/api';
import { X, Users, Clock, Link2, Plus, Trash2, Loader2 } from 'lucide-react';

interface BookingModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({ open, onClose, onCreated }) => {
  const [tab, setTab] = useState<'booking' | 'meeting'>('booking');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [duration, setDuration] = useState(30);
  const [buffer, setBuffer] = useState(10);
  const [startHour, setStartHour] = useState('09:00');
  const [endHour, setEndHour] = useState('18:00');
  const [description, setDescription] = useState('');
  const [proposedSlots, setProposedSlots] = useState<Array<{ date: string; time: string }>>([
    { date: new Date(Date.now() + 86400000).toISOString().split('T')[0], time: '14:00' },
    { date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0], time: '16:00' },
  ]);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!slug || slug === title.toLowerCase().replace(/[^a-z0-9]/g, '-')) {
      setSlug(
        val
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
      );
    }
  };

  const handleAddSlot = () => {
    const nextDate = new Date(Date.now() + 86400000 * (proposedSlots.length + 1)).toISOString().split('T')[0];
    setProposedSlots([...proposedSlots, { date: nextDate, time: '10:00' }]);
  };

  const handleRemoveSlot = (index: number) => {
    setProposedSlots(proposedSlots.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || submitting) return;

    setSubmitting(true);
    try {
      if (tab === 'booking') {
        await api.request('/api/v1/booking/types', {
          method: 'POST',
          body: JSON.stringify({
            title: title.trim(),
            slug: slug.trim() || 'reuniao-vito',
            description: description.trim() || undefined,
            duration_minutes: Number(duration),
            buffer_minutes: Number(buffer),
            start_hour: startHour,
            end_hour: endHour,
            days_of_week: '1,2,3,4,5',
          }),
        });
      } else {
        await api.request('/api/v1/meetings', {
          method: 'POST',
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || undefined,
            duration_minutes: Number(duration),
            mode: 'group_consensus',
            slots: proposedSlots.map((s) => ({
              start_at: `${s.date}T${s.time}:00Z`,
              end_at: `${s.date}T${String(Number(s.time.split(':')[0]) + 1).padStart(2, '0')}:${s.time.split(':')[1]}:00Z`,
            })),
          }),
        });
      }

      onCreated?.();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Erro ao criar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] rounded-[28px] p-7 shadow-2xl text-zinc-900 dark:text-[#FAFAFA] transition-colors max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-white/5 mb-5">
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              {tab === 'booking' ? 'Novo Link de Agendamento' : 'Nova Reunião em Grupo'}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {tab === 'booking' ? 'Página pública de agendamento 1-on-1' : 'Enquete de horários com consenso inteligente'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs de Seleção (Paridade Mobile) */}
        <div className="flex p-1 bg-zinc-100 dark:bg-[#0B0D10] rounded-2xl mb-5 border border-zinc-200/80 dark:border-[#222730]">
          <button
            type="button"
            onClick={() => setTab('booking')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              tab === 'booking'
                ? 'bg-white dark:bg-[#1C2026] text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Link2 size={14} className={tab === 'booking' ? 'text-indigo-500' : ''} />
            <span>Link 1-on-1</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('meeting')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              tab === 'meeting'
                ? 'bg-white dark:bg-[#1C2026] text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Users size={14} className={tab === 'meeting' ? 'text-emerald-500' : ''} />
            <span>Reunião em Grupo</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
              Título
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder={tab === 'booking' ? 'Ex: Consultoria de Produto (30 min)' : 'Ex: Alinhamento Estratégico Q4'}
              required
              autoFocus
              className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors"
            />
          </div>

          {tab === 'booking' && (
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
                Link Personalizado (Slug)
              </label>
              <div className="flex items-center px-3 py-2 bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] rounded-xl text-xs text-zinc-500">
                <span>vito.ai/p/</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="meu-link"
                  className="flex-1 bg-transparent border-none text-zinc-900 dark:text-white focus:outline-none font-mono ml-0.5"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5 flex items-center gap-1">
                <Clock size={13} className="text-zinc-400" />
                <span>Duração</span>
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] rounded-xl text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none"
              >
                <option value={15}>15 minutos</option>
                <option value={30}>30 minutos</option>
                <option value={45}>45 minutos</option>
                <option value={60}>60 minutos (1h)</option>
              </select>
            </div>

            {tab === 'booking' ? (
              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
                  Intervalo (Buffer)
                </label>
                <select
                  value={buffer}
                  onChange={(e) => setBuffer(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] rounded-xl text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none"
                >
                  <option value={0}>Sem intervalo</option>
                  <option value={5}>5 minutos</option>
                  <option value={10}>10 minutos</option>
                  <option value={15}>15 minutos</option>
                </select>
              </div>
            ) : null}
          </div>

          {tab === 'booking' && (
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
                  Horário Inicial
                </label>
                <input
                  type="time"
                  value={startHour}
                  onChange={(e) => setStartHour(e.target.value)}
                  className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] rounded-xl text-xs text-zinc-900 dark:text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
                  Horário Limite
                </label>
                <input
                  type="time"
                  value={endHour}
                  onChange={(e) => setEndHour(e.target.value)}
                  className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] rounded-xl text-xs text-zinc-900 dark:text-white focus:outline-none"
                />
              </div>
            </div>
          )}

          {tab === 'meeting' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  Horários Propostos para Votação
                </label>
                <button
                  type="button"
                  onClick={handleAddSlot}
                  className="text-xs font-semibold text-indigo-500 hover:text-indigo-600 flex items-center gap-1"
                >
                  <Plus size={13} />
                  <span>Adicionar Horário</span>
                </button>
              </div>
              <div className="space-y-2">
                {proposedSlots.map((slot, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="date"
                      value={slot.date}
                      onChange={(e) => {
                        const updated = [...proposedSlots];
                        updated[idx].date = e.target.value;
                        setProposedSlots(updated);
                      }}
                      className="flex-1 px-3 py-1.5 bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] rounded-xl text-xs text-zinc-900 dark:text-white focus:outline-none"
                    />
                    <input
                      type="time"
                      value={slot.time}
                      onChange={(e) => {
                        const updated = [...proposedSlots];
                        updated[idx].time = e.target.value;
                        setProposedSlots(updated);
                      }}
                      className="w-28 px-3 py-1.5 bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] rounded-xl text-xs text-zinc-900 dark:text-white focus:outline-none"
                    />
                    {proposedSlots.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSlot(idx)}
                        className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
              Descrição ou Pauta (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Descreva detalhes sobre a reunião..."
              className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] rounded-xl text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none resize-none"
            />
          </div>

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
              disabled={!title.trim() || submitting}
              className="px-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-[#09090B] text-xs font-bold uppercase tracking-wider rounded-full shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              <span>{tab === 'booking' ? 'Criar Link' : 'Criar Enquete'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
