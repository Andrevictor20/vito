import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { BookingType, Meeting } from '../../types';
import { BookingModal } from './BookingModal';
import { VotersModal, VOTER_COLORS, getVoterInitials } from './VotersModal';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Check, ChevronRight, Copy, Plus } from 'lucide-react';

export const MeetingsView: React.FC = () => {
  const [bookings, setBookings] = useState<BookingType[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [appointments, setAppointments] = useState<unknown[]>([]);
  const [selectedMeetingIndex, setSelectedMeetingIndex] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [votersModal, setVotersModal] = useState<{ title: string; voters: string[] } | null>(null);

  const fetchMeetings = async () => {
    try {
      const [bData, mData, aData] = await Promise.all([
        api.getBookings(),
        api.getMeetings(),
        api.getBookingAppointments(),
      ]);
      setBookings(bData || []);
      setMeetings(mData || []);
      setAppointments(aData || []);
    } catch (err) {
      console.error('Erro ao buscar reuniões:', err);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  const displayMeetings: Meeting[] = meetings;
  const currentMeeting = displayMeetings[selectedMeetingIndex] || displayMeetings[0];

  const handleVote = (slotId: string) => {
    if (!currentMeeting) return;
    setMeetings((prev) =>
      prev.map((m) =>
        m.id !== currentMeeting.id
          ? m
          : {
              ...m,
              slots: (m.slots || []).map((s) =>
                s.id === slotId ? { ...s, votes_count: (s.votes_count || 0) + 1 } : s
              ),
            }
      )
    );
  };

  const handleCopyLink = () => {
    if (!currentMeeting) return;
    const url = currentMeeting.short_url || currentMeeting.public_url || `https://vito.s.gy/m/${currentMeeting.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const slots = currentMeeting?.slots || [];
  const totalVotes = slots.reduce((sum, s) => sum + (s.votes_count || 0), 0);
  const confirmedCount = displayMeetings.filter((m) => m.status === 'confirmed').length;

  return (
    <div className="flex-1 h-screen flex flex-col bg-[var(--bg)] text-[var(--ink)] overflow-hidden select-none">
      <header className="h-16 px-6 border-b border-[var(--line)] flex items-center justify-between bg-[var(--bg)] shrink-0">
        <div>
          <h1 className="text-[20px] font-extrabold tracking-tight leading-tight">Vito Booking</h1>
          <p className="text-[12px] text-[var(--muted)]">Links públicos e enquetes de reunião</p>
        </div>

        <Button variant="pri" size="sm" pill onClick={() => setModalOpen(true)} leftIcon={<Plus size={14} />}>
          Novo link
        </Button>
      </header>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <aside className="w-[400px] shrink-0 border-r border-[var(--line)] overflow-y-auto p-4 space-y-4 bg-[var(--bg)]">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-2xl border border-[var(--line)] bg-[var(--bg)]">
              <div className="text-xs text-[var(--muted)] font-semibold">Links</div>
              <div className="text-[28px] font-extrabold text-[var(--ink)] mt-0.5 tabular-nums">
                {bookings.length}
              </div>
            </div>
            <div className="p-3 rounded-2xl border border-[var(--line)] bg-[var(--bg)]">
              <div className="text-xs text-[var(--muted)] font-semibold">Confirmadas</div>
              <div className="text-[28px] font-extrabold text-[var(--acc)] mt-0.5 tabular-nums">
                {confirmedCount}
              </div>
            </div>
            <div className="p-3 rounded-2xl border border-[var(--line)] bg-[var(--bg)]">
              <div className="text-xs text-[var(--muted)] font-semibold">Recebidos</div>
              <div className="text-[28px] font-extrabold text-[var(--blue)] mt-0.5 tabular-nums">
                {appointments.length}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {displayMeetings.length === 0 ? (
              <p className="text-sm text-[var(--muted)] p-4">Nenhuma enquete ou reunião criada ainda.</p>
            ) : (
              displayMeetings.map((item, index) => {
                const isSelected = index === selectedMeetingIndex;
                const isConfirmed = item.status === 'confirmed';
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedMeetingIndex(index)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[var(--surf)] border-[var(--ink)]'
                        : 'border-transparent hover:bg-[var(--surf)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <b className="text-base text-[var(--ink)] truncate max-w-[240px]">{item.title}</b>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[var(--surf)] text-[var(--muted)]">
                        {item.duration_minutes} min
                      </span>
                    </div>
                    <div className="mt-2">
                      <span
                        className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          isConfirmed
                            ? 'bg-[var(--green-bg)] text-[var(--acc)]'
                            : 'bg-[var(--orange-bg)] text-[var(--orange)]'
                        }`}
                      >
                        {isConfirmed ? 'Confirmada' : 'Aguardando'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-8 bg-[var(--surf)] space-y-5">
          {currentMeeting ? (
            <>
              <Card padding="lg" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-[var(--ink)] m-0">{currentMeeting.title}</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    pill
                    onClick={handleCopyLink}
                    leftIcon={copied ? <Check size={16} className="text-[var(--acc)]" /> : <Copy size={16} />}
                  >
                    {copied ? 'Link copiado' : 'Copiar link'}
                  </Button>
                </div>

                {currentMeeting.status === 'confirmed' ? (
                  <div className="p-4 rounded-xl border border-[var(--line)] border-l-4 border-l-[var(--acc)] bg-[var(--bg)]">
                    <b className="text-base text-[var(--ink)] block">Horário definido</b>
                    <div className="text-sm text-[var(--muted)] mt-1">
                      Evento confirmado e adicionado à sua agenda.
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--muted)] m-0">
                    Aguardando votação dos convidados para definição do consenso.
                  </p>
                )}
              </Card>

              {slots.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-[var(--muted)] uppercase tracking-wider">
                    Horários propostos ({slots.length})
                  </h3>

                  <div className="space-y-2.5">
                    {slots.map((slot) => {
                      const voters: string[] = (slot as { voter_names?: string[] }).voter_names || [];
                      const votes = Math.max(slot.votes_count || 0, voters.length);
                      const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                      const isWinner = Boolean(slot.is_winner || currentMeeting.confirmed_slot_id === slot.id);
                      const dateLabel = new Date(slot.start_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        weekday: 'short',
                      });
                      const timeLabel = `${new Date(slot.start_at).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })} – ${new Date(slot.end_at).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}`;
                      const shown = voters.slice(0, 4);
                      const extra = Math.max(0, voters.length - 4);

                      return (
                        <div
                          key={slot.id}
                          onClick={() => handleVote(slot.id)}
                          className={`rounded-[22px] p-4 border cursor-pointer transition-all ${
                            isWinner
                              ? 'bg-[var(--green-bg)] border-[var(--acc)]'
                              : 'bg-[var(--bg)] border-[var(--line)]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <b className={`text-[15.5px] font-semibold ${isWinner ? 'text-[var(--acc)]' : 'text-[var(--ink)]'}`}>
                                  {dateLabel}
                                </b>
                                {isWinner && (
                                  <span className="px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-[var(--bg)] text-[var(--acc)]">
                                    ✓ Confirmado
                                  </span>
                                )}
                              </div>
                              <div className="text-[13.5px] text-[var(--muted)] mt-0.5 tabular-nums">
                                {timeLabel}
                              </div>
                            </div>
                            <span className="text-[13px] font-semibold text-[var(--muted)] tabular-nums">
                              {votes} {votes === 1 ? 'voto' : 'votos'} · {pct}%
                            </span>
                          </div>

                          <div className="h-1.5 rounded-full bg-[var(--btn)] mt-3 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${
                                isWinner ? 'bg-[var(--acc)]' : 'bg-[var(--ink)]'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>

                          {voters.length > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setVotersModal({ title: `${dateLabel} · ${timeLabel}`, voters });
                              }}
                              className="mt-3 pt-3 border-t border-[var(--line)] w-full flex items-center gap-2.5 text-left"
                            >
                              <div className="flex items-center">
                                {shown.map((vName, i) => (
                                  <span
                                    key={`${slot.id}-${i}`}
                                    className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white border-2 border-[var(--bg)] -ml-2 first:ml-0"
                                    style={{ backgroundColor: VOTER_COLORS[i % VOTER_COLORS.length] }}
                                  >
                                    {getVoterInitials(vName)}
                                  </span>
                                ))}
                                {extra > 0 && (
                                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10.5px] font-semibold bg-[var(--ink)] text-[var(--bg)] border-2 border-[var(--bg)] -ml-2">
                                    +{extra}
                                  </span>
                                )}
                              </div>
                              <span className="flex-1 text-xs text-[var(--muted)] truncate">
                                {voters.slice(0, 2).join(', ')}
                                {voters.length > 2 ? ` e +${voters.length - 2} pessoas` : ''}
                              </span>
                              <ChevronRight size={16} className="text-[var(--muted)]" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-[var(--muted)]">Selecione ou crie um link de agendamento.</p>
          )}
        </main>
      </div>

      <BookingModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={fetchMeetings} />
      <VotersModal
        open={!!votersModal}
        onClose={() => setVotersModal(null)}
        title={votersModal?.title || ''}
        voters={votersModal?.voters || []}
      />
    </div>
  );
};
