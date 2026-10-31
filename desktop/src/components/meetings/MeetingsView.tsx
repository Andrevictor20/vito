import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { BookingType, Meeting } from '../../types';
import { BookingModal } from './BookingModal';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import {
  Plus,
  Copy,
  Check,
} from 'lucide-react';

export const MeetingsView: React.FC = () => {
  const [bookings, setBookings] = useState<BookingType[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [selectedMeetingIndex, setSelectedMeetingIndex] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

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

  // Dados canônicos do protótipo caso o backend ainda não tenha registros
  const displayMeetings: Meeting[] = meetings.length > 0 ? meetings : [
    {
      id: 'meeting-val-1',
      title: 'Visita técnica Vale',
      description: 'Visita técnica de alinhamento com a equipe da Vale',
      duration_minutes: 60,
      mode: 'group_consensus',
      status: 'confirmed',
      confirmed_slot_id: 'slot_1',
      confirmed_slot_start: '2026-10-27T08:00:00Z',
      confirmed_slot_end: '2026-10-27T09:00:00Z',
      slots: [
        { id: 's1', start_at: '2026-10-27T08:00:00Z', end_at: '2026-10-27T09:00:00Z', votes_count: 2, is_winner: true },
        { id: 's2', start_at: '2026-10-27T09:00:00Z', end_at: '2026-10-27T10:00:00Z', votes_count: 0 },
        { id: 's3', start_at: '2026-10-27T10:00:00Z', end_at: '2026-10-27T11:00:00Z', votes_count: 0 },
        { id: 's4', start_at: '2026-10-27T11:00:00Z', end_at: '2026-10-27T12:00:00Z', votes_count: 0 },
        { id: 's5', start_at: '2026-10-27T13:00:00Z', end_at: '2026-10-27T14:00:00Z', votes_count: 0 },
      ],
    },
    {
      id: 'meeting-plan-2',
      title: 'Reunião planejamento',
      description: 'Reunião de planejamento do app Vito',
      duration_minutes: 30,
      mode: 'group_consensus',
      status: 'confirmed',
      confirmed_slot_id: 'slot_2',
      confirmed_slot_start: '2026-10-22T15:15:00Z',
      confirmed_slot_end: '2026-10-22T15:45:00Z',
      slots: [
        { id: 'p1', start_at: '2026-10-22T14:00:00Z', end_at: '2026-10-22T14:30:00Z', votes_count: 0 },
        { id: 'p2', start_at: '2026-10-22T15:15:00Z', end_at: '2026-10-22T15:45:00Z', votes_count: 1, is_winner: true },
        { id: 'p3', start_at: '2026-10-22T16:00:00Z', end_at: '2026-10-22T16:30:00Z', votes_count: 3 },
      ],
    },
    {
      id: 'meeting-xp-3',
      title: 'Reunião Projeto XP (1:1)',
      description: 'Alinhamento executivo 1:1',
      duration_minutes: 15,
      mode: 'one_on_one',
      status: 'open',
      slots: [],
    },
  ];

  const currentMeeting = displayMeetings[selectedMeetingIndex] || displayMeetings[0];

  const handleVote = (slotId: string) => {
    // Feedback visual otimista
    setMeetings((prev) =>
      prev.map((m) => {
        if (m.id !== currentMeeting.id) return m;
        return {
          ...m,
          slots: (m.slots || []).map((s) =>
            s.id === slotId ? { ...s, votes_count: (s.votes_count || 0) + 1 } : s
          ),
        };
      })
    );
  };

  const handleCopyLink = () => {
    const url = `https://vito.s.gy/m/${currentMeeting.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const slots = currentMeeting?.slots || [];
  const maxVotes = Math.max(1, ...slots.map((s) => s.votes_count || 0));

  const confirmedCount = displayMeetings.filter((m) => m.status === 'confirmed').length;
  const linksCount = bookings.length > 0 ? bookings.length : 2;
  const receivedCount = appointments.length > 0 ? appointments.length : 1;

  return (
    <div className="flex-1 h-screen flex flex-col bg-[var(--bg)] text-[var(--ink)] overflow-hidden select-none transition-colors duration-200">
      {/* Header Fiel ao Vito Desktop.html */}
      <header className="h-16 px-6 border-b border-[var(--line)] flex items-center justify-between bg-[var(--bg)] z-10 shrink-0">
        <div>
          <h1 className="text-[20px] font-extrabold tracking-tight leading-tight">
            Vito Booking
          </h1>
          <p className="text-[12px] text-[var(--muted)]">
            Links públicos e enquetes de reunião
          </p>
        </div>

        <Button
          variant="pri"
          size="sm"
          pill
          onClick={() => setModalOpen(true)}
          leftIcon={<Plus size={14} />}
        >
          Novo link
        </Button>
      </header>

      {/* Split-Pane Master-Detail (400px lista + flex painel) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Coluna Esquerda: Lista Mestre (.lst com 400px) */}
        <aside className="w-[400px] shrink-0 border-r border-[var(--line)] overflow-y-auto p-4 space-y-4 bg-[var(--bg)]">
          {/* Grid Métrico Superior (3 colunas compactas) */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-2xl border border-[var(--line)] bg-[var(--bg)]">
              <div className="text-xs text-[var(--muted)] font-semibold">Links</div>
              <div className="text-[28px] font-extrabold text-[var(--ink)] leading-tight mt-0.5">
                {linksCount}
              </div>
            </div>
            <div className="p-3 rounded-2xl border border-[var(--line)] bg-[var(--bg)]">
              <div className="text-xs text-[var(--muted)] font-semibold">Confirmadas</div>
              <div className="text-[28px] font-extrabold text-[var(--acc)] leading-tight mt-0.5">
                {confirmedCount}
              </div>
            </div>
            <div className="p-3 rounded-2xl border border-[var(--line)] bg-[var(--bg)]">
              <div className="text-xs text-[var(--muted)] font-semibold">Recebidos</div>
              <div className="text-[28px] font-extrabold text-[var(--blue)] leading-tight mt-0.5">
                {receivedCount}
              </div>
            </div>
          </div>

          {/* Lista de Reuniões e Enquetes */}
          <div className="space-y-2">
            {displayMeetings.map((item, index) => {
              const isSelected = index === selectedMeetingIndex;
              const isConfirmed = item.status === 'confirmed';

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedMeetingIndex(index)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[var(--surf)] border-[var(--ink)] shadow-xs'
                      : 'border-transparent hover:bg-[var(--surf)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <b className="text-base text-[var(--ink)] truncate max-w-[240px]">
                      {item.title}
                    </b>
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
            })}
          </div>
        </aside>

        {/* Coluna Direita: Detalhes e Apuração (.bd com background var(--surf)) */}
        <main className="flex-1 overflow-y-auto p-8 bg-[var(--surf)] space-y-5">
          {currentMeeting && (
            <>
              {/* Card Superior da Reunião Selecionada */}
              <Card padding="lg" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-[var(--ink)] m-0">
                    {currentMeeting.title}
                  </h2>
                  <div className="flex items-center gap-2">
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
                </div>

                {currentMeeting.status === 'confirmed' ? (
                  <div className="p-4 rounded-xl border border-[var(--line)] border-l-4 border-l-[var(--acc)] bg-[var(--bg)]">
                    <b className="text-base text-[var(--ink)] block">
                      Consenso definido: {currentMeeting.confirmed_slot_start ? 'ter., 27/10 às 08:00' : 'Confirmado'}
                    </b>
                    <div className="text-sm text-[var(--muted)] mt-1">
                      Gravado na sua agenda e sincronizado com os participantes.
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--muted)] m-0">
                    Aguardando votação dos convidados para definição do consenso.
                  </p>
                )}
              </Card>

              {/* Seção de Horários Propostos e Apuração de Votos */}
              {slots.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-[var(--muted)] uppercase tracking-wider mb-2">
                    Horários propostos ({slots.length})
                  </h3>

                  <div className="space-y-2.5">
                    {slots.map((slot) => {
                      const votes = slot.votes_count || 0;
                      const pct = Math.round((votes / maxVotes) * 100);
                      const isWinner = slot.is_winner || (votes === maxVotes && maxVotes > 0);

                      const timeLabel = new Date(slot.start_at).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <Card
                          key={slot.id}
                          interactive
                          padding="md"
                          onClick={() => handleVote(slot.id)}
                          className="cursor-pointer space-y-2.5 hover:border-[var(--ink)] transition-colors"
                          title="Clique para votar neste horário"
                        >
                          <div className="flex items-center justify-between">
                            <b className="text-base text-[var(--ink)]">{timeLabel}</b>
                            <div className="flex items-center gap-2">
                              {isWinner && currentMeeting.status === 'confirmed' && (
                                <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-bold bg-[var(--green-bg)] text-[var(--acc)]">
                                  Escolhido
                                </span>
                              )}
                              <span className="text-sm text-[var(--muted)] font-semibold">
                                {votes} {votes === 1 ? 'voto' : 'votos'}
                              </span>
                            </div>
                          </div>

                          {/* Barra de Progresso Horizontal Proporcional (.bar i) */}
                          <div className="h-2.5 rounded-full bg-[var(--surf)] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isWinner ? 'bg-[var(--acc)]' : 'bg-[var(--blue)]'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Modal de Criação de Link */}
      <BookingModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={fetchMeetings}
      />
    </div>
  );
};
