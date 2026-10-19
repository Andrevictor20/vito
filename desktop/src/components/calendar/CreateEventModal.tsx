import React, { useState } from 'react';
import { api } from '../../services/api';
import { format } from 'date-fns';
import { X, Loader2 } from 'lucide-react';

interface CreateEventModalProps {
  open: boolean;
  selectedDate: Date;
  onClose: () => void;
  onEventCreated: () => void;
}

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  open,
  selectedDate,
  onClose,
  onEventCreated,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [category, setCategory] = useState('MEETING');
  const [creating, setCreating] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || creating) return;

    setCreating(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const startAt = `${dateStr}T${startTime}:00Z`;
      const endAt = `${dateStr}T${endTime}:00Z`;

      await api.createEvent({
        title,
        description,
        location,
        category,
        start_at: startAt,
        end_at: endAt,
        all_day: false,
      });

      onEventCreated();
      onClose();
      setTitle('');
      setDescription('');
      setLocation('');
    } catch (err: any) {
      alert(err.message || 'Erro ao criar compromisso');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] rounded-3xl p-6 shadow-2xl text-zinc-900 dark:text-[#FAFAFA]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/5 mb-4">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            Novo Compromisso
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
              Título do Evento
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Alinhamento de Sprint, Aula de Inglês..."
              className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#262B33] rounded-xl text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white"
              autoFocus
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
                Início
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#262B33] rounded-xl text-xs text-zinc-900 dark:text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
                Término
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#262B33] rounded-xl text-xs text-zinc-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
              Local ou Link
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Google Meet, Sala de Reunião, etc."
              className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#262B33] rounded-xl text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
              Categoria
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#262B33] rounded-xl text-xs text-zinc-900 dark:text-white focus:outline-none"
            >
              <option value="MEETING">Reunião (MEETING)</option>
              <option value="ESTUDO">Estudo & Aulas</option>
              <option value="TRABALHO">Trabalho & Foco</option>
              <option value="PESSOAL">Pessoal</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
              Descrição
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Notas adicionais..."
              className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#262B33] rounded-xl text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-[#09090B] text-xs font-semibold rounded-full shadow transition-all flex items-center gap-1.5"
            >
              {creating && <Loader2 size={13} className="animate-spin" />}
              <span>Salvar Compromisso</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
