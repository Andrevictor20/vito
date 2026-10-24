import React, { useState } from 'react';
import { Meeting, MeetingSlot } from '../../types';
import { api } from '../../services/api';
import {
  X,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  Share2,
  Check,
  Star,
  Info,
  Loader2,
  ExternalLink,
} from 'lucide-react';

interface MeetingPollDetailModalProps {
  meeting: Meeting | null;
  open: boolean;
  onClose: () => void;
  onConfirmed?: () => void;
}

export const MeetingPollDetailModal: React.FC<MeetingPollDetailModalProps> = ({
  meeting,
  open,
  onClose,
  onConfirmed,
}) => {
  const [confirmingSlotId, setConfirmingSlotId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!open || !meeting) return null;

  const isConfirmed = meeting.status === 'confirmed';
  const slots: MeetingSlot[] = Array.isArray(meeting.slots) ? meeting.slots : [];
  const participantsCount = meeting.participants_count || 0;

  // Localiza o slot líder em votos
  const leadingSlot = slots.reduce<MeetingSlot | null>((max, s) => {
    if (!max || (s.votes_count || 0) > (max.votes_count || 0)) return s;
    return max;
  }, null);

  const handleConfirmSlot = async (slotId: string) => {
    try {
      setConfirmingSlotId(slotId);
      await api.confirmMeetingConsensus(meeting.id, slotId);
      if (onConfirmed) onConfirmed();
    } catch (err) {
      console.error('Erro ao confirmar consenso:', err);
    } finally {
      setConfirmingSlotId(null);
    }
  };

  const handleCopy = () => {
    if (meeting.public_url) {
      navigator.clipboard.writeText(meeting.public_url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const formatSlotDate = (startStr: string, endStr: string) => {
    const s = new Date(startStr);
    const e = new Date(endStr);
    const dateStr = s.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });
    const startTime = s.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const endTime = e.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} às ${startTime} – ${endTime}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="px-7 py-6 border-b border-zinc-200 dark:border-[#222730] flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
              <Calendar size={24} />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-white leading-tight font-display">
                {meeting.title}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500 flex items-center gap-2 mt-1">
                <span className="flex items-center gap-1 font-medium">
                  <Clock size={14} /> {meeting.duration_minutes} min
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-medium">
                  <Users size={14} /> {participantsCount} participantes
                </span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-6">
          {/* Status Banner */}
          {isConfirmed ? (
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-start gap-3.5">
              <CheckCircle2 size={24} className="shrink-0 mt-0.5" />
              <div>
                <b className="block text-base font-bold">Consenso Definido!</b>
                <span className="text-xs sm:text-sm leading-relaxed opacity-95">
                  A reunião já foi fechada no horário oficial e o compromisso foi gravado na sua agenda.
                </span>
              </div>
            </div>
          ) : leadingSlot && (leadingSlot.votes_count || 0) > 0 ? (
            <div className="p-5 rounded-2xl bg-zinc-100 dark:bg-[#1C2026] border border-zinc-200 dark:border-[#222730] flex items-start gap-3.5">
              <Star size={24} className="text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <b className="block text-base font-bold text-zinc-900 dark:text-white">Horário Mais Votado</b>
                <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {formatSlotDate(leadingSlot.start_at, leadingSlot.end_at)} — {leadingSlot.votes_count} votos
                </span>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-[#101318] border border-zinc-200 dark:border-[#222730] flex items-start gap-3.5 text-zinc-500 text-xs sm:text-sm">
              <Info size={18} className="shrink-0 mt-0.5" />
              <span>Nenhum participante votou ainda. Compartilhe o link de votação para recolher a disponibilidade do grupo.</span>
            </div>
          )}

          {/* Slots List */}
          <div className="space-y-3.5">
            <h4 className="text-xs sm:text-sm font-bold text-zinc-500 uppercase tracking-wider">
              Horários Propostos ({slots.length})
            </h4>

            {slots.length === 0 ? (
              <div className="py-8 text-center text-zinc-400 text-sm">
                Nenhum slot cadastrado nesta reunião.
              </div>
            ) : (
              slots.map((slot) => {
                const isWinner = isConfirmed && meeting.confirmed_slot_id === slot.id;
                const votes = slot.votes_count || 0;
                const percent = participantsCount > 0 ? Math.round((votes / participantsCount) * 100) : 0;

                return (
                  <div
                    key={slot.id}
                    className={`p-5 rounded-2xl border transition-all ${
                      isWinner
                        ? 'bg-emerald-500/5 border-emerald-500/30'
                        : 'bg-zinc-50 dark:bg-[#101318] border-zinc-200 dark:border-[#222730]'
                    } flex items-center justify-between gap-5 flex-wrap sm:flex-nowrap`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-sm sm:text-base text-zinc-900 dark:text-white">
                          {formatSlotDate(slot.start_at, slot.end_at)}
                        </span>
                        {isWinner && (
                          <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                            Escolhido
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3.5 mt-2 text-xs sm:text-sm text-zinc-500">
                        <div className="w-32 h-2.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                          <div
                            style={{ width: `${percent}%` }}
                            className="h-full bg-emerald-500 rounded-full"
                          />
                        </div>
                        <span className="font-medium">
                          {votes} {votes === 1 ? 'voto' : 'votos'} ({percent}%)
                        </span>
                      </div>
                    </div>

                    {!isConfirmed && (
                      <button
                        onClick={() => handleConfirmSlot(slot.id)}
                        disabled={confirmingSlotId === slot.id}
                        className="px-5 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-[#09090B] hover:opacity-90 text-xs sm:text-sm font-bold shrink-0 flex items-center gap-2 transition-all shadow-xs"
                      >
                        {confirmingSlotId === slot.id ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <Check size={15} />
                        )}
                        <span>Confirmar Horário</span>
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-7 py-5 border-t border-zinc-200 dark:border-[#222730] flex items-center justify-between bg-zinc-50/50 dark:bg-[#101318]/50">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-[#1C2026] dark:hover:bg-[#262B33] text-xs sm:text-sm font-bold text-zinc-700 dark:text-zinc-200 transition-colors shadow-2xs"
          >
            {copiedLink ? <Check size={16} className="text-emerald-500" /> : <Share2 size={16} />}
            <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link de Votação'}</span>
          </button>

          {meeting.public_url && (
            <a
              href={meeting.public_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
            >
              <span>Abrir página pública</span>
              <ExternalLink size={15} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
