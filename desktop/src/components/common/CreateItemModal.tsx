import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { CalendarEvent, Todo } from '../../types';
import { X, Calendar, CheckSquare, Clock, Link, Loader2 } from 'lucide-react';

interface CreateItemModalProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: 'event' | 'todo';
  selectedDate?: Date;
  onCreated?: () => void;
}

export const CreateItemModal: React.FC<CreateItemModalProps> = ({
  open,
  onClose,
  defaultTab = 'event',
  selectedDate = new Date(),
  onCreated,
}) => {
  const [tab, setTab] = useState<'event' | 'todo'>(defaultTab);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [category, setCategory] = useState('MEETING');
  const [notifPriority, setNotifPriority] = useState<'silent' | 'default' | 'urgent'>('default');
  const [todoPriority, setTodoPriority] = useState<Todo['priority']>('medium');
  const [dueDate, setDueDate] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTab(defaultTab);
      setTitle('');
      setDescription('');
      setStartTime('09:00');
      setEndTime('10:00');
      setCategory('MEETING');
      setNotifPriority('default');
      setTodoPriority('medium');
      setSelectedEventId('');

      const yyyy = selectedDate.getFullYear();
      const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const dd = String(selectedDate.getDate()).padStart(2, '0');
      setDueDate(`${yyyy}-${mm}-${dd}`);

      api.getEvents().then(setCalendarEvents).catch(() => {});
    }
  }, [open, defaultTab, selectedDate]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || submitting) return;

    setSubmitting(true);
    try {
      const yyyy = selectedDate.getFullYear();
      const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const dd = String(selectedDate.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      if (tab === 'event') {
        const startAt = `${dateStr}T${startTime}:00Z`;
        let endAt = `${dateStr}T${endTime}:00Z`;
        if (endAt <= startAt) {
          endAt = `${dateStr}T${startTime}:00Z`;
        }

        await api.createEvent({
          title: title.trim(),
          description: description.trim() || undefined,
          category,
          start_at: startAt,
          end_at: endAt,
          all_day: false,
        });
      } else {
        const linked = calendarEvents.find((ev) => ev.id === selectedEventId);
        await api.createTodo({
          title: title.trim(),
          description: linked ? `Vinculado ao compromisso: ${linked.title}` : description.trim() || undefined,
          priority: todoPriority,
          due_date: dueDate || dateStr,
          status: 'pending',
        });
      }

      onCreated?.();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar');
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
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              {tab === 'event' ? 'Novo Compromisso' : 'Nova Tarefa'}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {selectedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Segmented Control de Abas (Mobile Parity) */}
        <div className="flex p-1 bg-zinc-100 dark:bg-[#0B0D10] rounded-2xl mb-5 border border-zinc-200/80 dark:border-[#222730]">
          <button
            type="button"
            onClick={() => setTab('event')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              tab === 'event'
                ? 'bg-white dark:bg-[#1C2026] text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Calendar size={14} className={tab === 'event' ? 'text-indigo-500' : ''} />
            <span>Compromisso</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('todo')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              tab === 'todo'
                ? 'bg-white dark:bg-[#1C2026] text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <CheckSquare size={14} className={tab === 'todo' ? 'text-emerald-500' : ''} />
            <span>Tarefa</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Título */}
          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
              {tab === 'event' ? 'Título do Compromisso' : 'Título da Tarefa'}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={tab === 'event' ? 'Ex: Reunião de planejamento ou Aula de Inglês...' : 'Ex: Revisar planilha de orçamento semanal...'}
              required
              autoFocus
              className="w-full px-4 py-3 bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] rounded-2xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors"
            />
          </div>

          {/* Campos específicos de Compromisso */}
          {tab === 'event' && (
            <>
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5 flex items-center gap-1">
                    <Clock size={13} className="text-zinc-400" />
                    <span>Início</span>
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5 flex items-center gap-1">
                    <Clock size={13} className="text-zinc-400" />
                    <span>Término</span>
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
                    Categoria
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] rounded-xl text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none"
                  >
                    <option value="MEETING">Reunião (MEETING)</option>
                    <option value="STUDY">Estudo (STUDY)</option>
                    <option value="HEALTH">Saúde (HEALTH)</option>
                    <option value="FOCUS">Foco (FOCUS)</option>
                    <option value="PERSONAL">Pessoal (PERSONAL)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
                    Notificação
                  </label>
                  <select
                    value={notifPriority}
                    onChange={(e) => setNotifPriority(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] rounded-xl text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none"
                  >
                    <option value="default">Padrão</option>
                    <option value="urgent">Urgente (som forte)</option>
                    <option value="silent">Silencioso</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Campos específicos de Tarefa */}
          {tab === 'todo' && (
            <>
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
                    Prioridade
                  </label>
                  <select
                    value={todoPriority}
                    onChange={(e) => setTodoPriority(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] rounded-xl text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none"
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
                    Data de Vencimento
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] rounded-xl text-xs font-medium text-zinc-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Vínculo opcional a compromisso existente */}
              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <Link size={13} className="text-zinc-400" />
                  <span>Vincular a compromisso da agenda (opcional)</span>
                </label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] rounded-xl text-xs text-zinc-900 dark:text-white focus:outline-none"
                >
                  <option value="">Nenhum compromisso vinculado</option>
                  {calendarEvents.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} ({new Date(ev.start_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})
                    </option>
                  ))}
                </select>
              </div>
            </>
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
              disabled={!title.trim() || submitting}
              className="px-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-[#09090B] text-xs font-bold uppercase tracking-wider rounded-full shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              <span>{tab === 'event' ? 'Criar Compromisso' : 'Criar Tarefa'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
