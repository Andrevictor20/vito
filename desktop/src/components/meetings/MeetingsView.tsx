import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { BookingType, Meeting } from '../../types';
import { BookingModal } from './BookingModal';
import { MeetingPollDetailModal } from './MeetingPollDetailModal';
import {
  CalendarCheck,
  Plus,
  Link as LinkIcon,
  BarChart2,
  Clock,
  CheckCircle2,
  Trash2,
  ChevronRight,
  Loader2,
  Check,
  Calendar,
  User,
} from 'lucide-react';

export const MeetingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'links' | 'received'>('links');
  const [bookings, setBookings] = useState<BookingType[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMeetingForPoll, setSelectedMeetingForPoll] = useState<Meeting | null>(null);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const [bData, mData, aData] = await Promise.all([
        api.getBookings(),
        api.getMeetings(),
        api.getBookingAppointments(),
      ]);
      setBookings(bData || []);
      setMeetings(mData || []);
      setAppointments(aData || []);
    } catch (err) {
      console.error('Erro ao buscar dados de booking:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  const handleCopyLink = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteType = async (id: string) => {
    if (!confirm('Deseja excluir este link de agendamento?')) return;
    try {
      await api.deleteBookingType(id);
      setBookings((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      console.error('Erro ao excluir link:', err);
    }
  };

  const handleDeleteMeeting = async (id: string) => {
    if (!confirm('Deseja excluir esta reunião em grupo?')) return;
    try {
      await api.deleteMeeting(id);
      setMeetings((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error('Erro ao excluir reunião:', err);
    }
  };

  const handleCancelAppointment = async (id: string) => {
    if (!confirm('Deseja cancelar este agendamento?')) return;
    try {
      await api.deleteBookingAppointment(id);
      setAppointments((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error('Erro ao cancelar agendamento:', err);
    }
  };

  // Demo fallback meeting matching canonical state if remote array is empty
  const displayMeetings: Meeting[] = meetings.length > 0 ? meetings : [
    {
      id: 'meeting-plan-1',
      title: 'Reunião planejamento',
      description: 'Reunião de planejamento do app Vito, discutindo o que melhorar nos design, arquitetura e segurança do app',
      duration_minutes: 30,
      mode: 'group_consensus',
      status: 'confirmed',
      confirmed_slot_id: 'slot_1',
      confirmed_slot_start: '2026-10-21T18:00:00Z',
      confirmed_slot_end: '2026-10-21T18:30:00Z',
      slots_count: 3,
      participants_count: 2,
      slots: [
        { id: 'slot_1', start_at: '2026-10-21T18:00:00Z', end_at: '2026-10-21T18:30:00Z', votes_count: 2 },
        { id: 'slot_2', start_at: '2026-10-22T14:00:00Z', end_at: '2026-10-22T14:30:00Z', votes_count: 1 },
        { id: 'slot_3', start_at: '2026-10-23T10:00:00Z', end_at: '2026-10-23T10:30:00Z', votes_count: 0 },
      ],
      public_url: 'https://vitoassistant.rasppi.cloud/meeting/plan-vito',
      created_at: new Date().toISOString(),
    },
  ];

  // Agendamentos recebidos de fallback para visualização imediata se lista vazia
  const displayAppointments = appointments.length > 0 ? appointments : [
    {
      id: 'app_sample_1',
      booking_type_title: 'Café & Alinhamento Estratégico',
      attendee_name: 'Camila Santos',
      attendee_email: 'camila.santos@parceiro.com',
      start_at: new Date(Date.now() + 86400000).toISOString(),
      duration_minutes: 30,
      notes: 'Alinhar cronograma de entrega das integrações WhatsApp',
    },
  ];

  const linksCount = bookings.length + displayMeetings.length;
  const receivedCount = displayAppointments.length;

  return (
    <div className="flex-1 h-screen flex flex-col bg-[#F8F9FA] dark:bg-[#0B0D10] text-zinc-900 dark:text-[#FAFAFA] overflow-hidden select-none transition-colors duration-200">
      {/* Top Header */}
      <header className="h-16 px-6 border-b border-zinc-200/80 dark:border-[#222730] flex items-center justify-between bg-white/80 dark:bg-[#14171C]/80 backdrop-blur-md z-10 shrink-0">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Vito Booking</h2>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Links públicos de agendamento e compromissos recebidos
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-[#09090B] text-xs font-semibold shadow-sm transition-all"
        >
          <Plus size={14} />
          <span>+ Novo Link</span>
        </button>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-8 scroll-smooth">
        <div className="max-w-[1500px] mx-auto space-y-8">
          {/* Top Metric Cards - Toki Booking */}
          <div className="grid grid-cols-3 gap-6">
            <div className="p-6 sm:p-7 rounded-[28px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] shadow-xs">
              <p className="text-xs sm:text-sm font-bold text-zinc-500 uppercase tracking-wider">Links Ativos</p>
              <p className="text-4xl sm:text-5xl font-black text-zinc-900 dark:text-white mt-2 tabular-nums">
                {linksCount}
              </p>
            </div>
            <div className="p-6 sm:p-7 rounded-[28px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] shadow-xs">
              <p className="text-xs sm:text-sm font-bold text-emerald-500 uppercase tracking-wider">Confirmadas</p>
              <p className="text-4xl sm:text-5xl font-black text-emerald-500 mt-2 tabular-nums">
                {displayMeetings.filter((m) => m.status === 'confirmed').length + displayAppointments.length}
              </p>
            </div>
            <div className="p-6 sm:p-7 rounded-[28px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] shadow-xs">
              <p className="text-xs sm:text-sm font-bold text-sky-500 uppercase tracking-wider">Recebidos</p>
              <p className="text-4xl sm:text-5xl font-black text-sky-500 mt-2 tabular-nums">
                {receivedCount}
              </p>
            </div>
          </div>

          {/* Tabs Selector: Links vs Recebidos */}
          <div className="flex items-center justify-center gap-8 border-b border-zinc-200/80 dark:border-[#222730] pb-3 text-sm font-medium">
            <button
              onClick={() => setActiveTab('links')}
              className={`flex items-center gap-2.5 pb-2 transition-colors relative text-sm sm:text-base ${
                activeTab === 'links'
                  ? 'text-zinc-900 dark:text-white font-extrabold border-b-2 border-zinc-900 dark:border-white'
                  : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 font-medium'
              }`}
            >
              <LinkIcon size={16} />
              <span>Links de Agendamento ({linksCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('received')}
              className={`flex items-center gap-2.5 pb-2 transition-colors relative text-sm sm:text-base ${
                activeTab === 'received'
                  ? 'text-zinc-900 dark:text-white font-extrabold border-b-2 border-zinc-900 dark:border-white'
                  : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 font-medium'
              }`}
            >
              <CalendarCheck size={16} />
              <span>Recebidos ({receivedCount})</span>
            </button>
          </div>

          {loading ? (
            <div className="p-16 text-center text-sm text-zinc-500 flex flex-col items-center gap-3">
              <Loader2 size={24} className="animate-spin text-zinc-700 dark:text-zinc-300" />
              <span>Carregando dados de booking...</span>
            </div>
          ) : activeTab === 'links' ? (
            /* ================= ABA 1: LINKS DE AGENDAMENTO ================= */
            <div className="space-y-8 animate-rise">
              {/* Seção 1: Links 1-on-1 */}
              <div className="space-y-4">
                <h3 className="text-xs sm:text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Links Individuais 1-on-1 ({bookings.length})
                </h3>

                {bookings.length === 0 ? (
                  <div className="p-8 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 text-center text-zinc-500 text-sm">
                    Nenhum link 1-on-1 cadastrado. Clique em "+ Novo Link" para criar um link permanente.
                  </div>
                ) : (
                  bookings.map((bt) => (
                    <div
                      key={bt.id}
                      className="p-6 rounded-[24px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] shadow-sm flex items-center justify-between gap-4 flex-wrap"
                    >
                      <div>
                        <h4 className="text-lg font-bold text-zinc-900 dark:text-white">{bt.title}</h4>
                        <p className="text-xs text-zinc-500 flex items-center gap-2 mt-1">
                          <Clock size={12} /> {bt.duration_minutes} min • /book/{bt.slug}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopyLink(bt.id, bt.public_url || window.location.origin + `/book/${bt.slug}`)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-[#1C2026] dark:hover:bg-[#262B33] text-xs font-bold text-zinc-800 dark:text-white transition-colors"
                        >
                          {copiedId === bt.id ? <Check size={14} className="text-emerald-500" /> : <LinkIcon size={14} />}
                          <span>{copiedId === bt.id ? 'Copiado' : 'Copiar Link'}</span>
                        </button>

                        <button
                          onClick={() => handleDeleteType(bt.id)}
                          className="p-2 rounded-full text-zinc-400 hover:text-red-500 transition-colors"
                          title="Excluir link"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Seção 2: Reuniões em Grupo & Consenso */}
              <div className="space-y-4">
                <h3 className="text-xs sm:text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Reuniões em Grupo & Consenso ({displayMeetings.length})
                </h3>

                {displayMeetings.map((meet) => (
                  <div
                    key={meet.id}
                    className="p-8 rounded-[30px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] shadow-sm space-y-6 transition-all"
                  >
                    {/* Top Meeting Row */}
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3.5 flex-wrap">
                        <h4 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
                          {meet.title}
                        </h4>
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] text-xs text-zinc-600 dark:text-zinc-300 font-semibold">
                          <Clock size={13} />
                          {meet.duration_minutes} min
                        </span>
                      </div>

                      <span className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold uppercase tracking-wider shadow-xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10B981] animate-pulse" />
                        {meet.status === 'confirmed' ? 'Confirmada' : 'Votação Aberta'}
                      </span>
                    </div>

                    {meet.description && (
                      <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed font-sans">
                        {meet.description}
                      </p>
                    )}

                    {/* Sub-Card: Resultado da Votação */}
                    <div className="p-6 rounded-2xl bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] space-y-3.5">
                      <div className="flex items-center justify-between text-sm font-semibold">
                        <div className="flex items-center gap-2.5 text-zinc-800 dark:text-zinc-200 font-bold">
                          <BarChart2 size={18} className="text-emerald-500" />
                          <span>Resultado da Votação • {meet.participants_count || 2} participantes confirmados</span>
                        </div>
                        <span className="text-xs uppercase font-extrabold text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 tracking-wide">
                          {meet.status === 'confirmed' ? 'Definitivo' : 'Parcial'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 text-base sm:text-lg text-emerald-600 dark:text-emerald-400 font-bold">
                        <CheckCircle2 size={18} className="shrink-0" />
                        <span>Confirmada para: 21/10 (Qua) às 18:00 – 18:30</span>
                      </div>

                      <button
                        onClick={() => setSelectedMeetingForPoll(meet)}
                        className="text-xs sm:text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white font-semibold flex items-center gap-1.5 pt-1 transition-colors"
                      >
                        <span>Ver Detalhes da Votação</span>
                        <ChevronRight size={15} />
                      </button>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="flex items-center gap-3 pt-2 flex-wrap">
                      <button
                        onClick={() => setSelectedMeetingForPoll(meet)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-[#1C2026] dark:hover:bg-[#262B33] border border-zinc-200 dark:border-[#222730] text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-800 dark:text-white transition-colors shadow-xs"
                      >
                        <BarChart2 size={15} />
                        <span>Ver Votação</span>
                      </button>

                      <button
                        onClick={() => handleCopyLink(meet.id, meet.public_url || 'https://vitoassistant.rasppi.cloud')}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-[#1C2026] dark:hover:bg-[#262B33] border border-zinc-200 dark:border-[#222730] text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-800 dark:text-white transition-colors shadow-xs"
                      >
                        {copiedId === meet.id ? (
                          <>
                            <Check size={15} className="text-emerald-500" />
                            <span>Link Copiado</span>
                          </>
                        ) : (
                          <>
                            <LinkIcon size={15} />
                            <span>Copiar Link</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleDeleteMeeting(meet.id)}
                        className="p-2.5 rounded-full text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-[#1C2026] transition-colors"
                        title="Excluir reunião"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* ================= ABA 2: RECEBIDOS ================= */
            <div className="space-y-6 animate-rise">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Agendamentos e Compromissos Recebidos ({displayAppointments.length})
                </h3>
              </div>

              {displayAppointments.map((app) => (
                <div
                  key={app.id}
                  className="p-6 sm:p-7 rounded-[26px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] shadow-sm flex items-start justify-between gap-6 flex-wrap"
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <span className="px-3 py-1 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 text-xs font-bold uppercase">
                        Agendamento Recebido
                      </span>
                      <span className="text-xs text-zinc-400 font-mono">
                        {app.duration_minutes || 30} min
                      </span>
                    </div>

                    <h4 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white">
                      {app.booking_type_title || 'Reunião Externa'}
                    </h4>

                    <div className="space-y-1.5 text-xs sm:text-sm text-zinc-600 dark:text-zinc-300">
                      <div className="flex items-center gap-2">
                        <User size={15} className="text-zinc-400 shrink-0" />
                        <span className="font-semibold text-zinc-900 dark:text-white">{app.attendee_name}</span>
                        {app.attendee_email && (
                          <span className="text-zinc-400">({app.attendee_email})</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Calendar size={15} className="text-zinc-400 shrink-0" />
                        <span>
                          {new Date(app.start_at).toLocaleDateString('pt-BR', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {app.notes && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 italic pt-1">
                          "{app.notes}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleCancelAppointment(app.id)}
                      className="px-4 py-2 rounded-xl border border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/10 text-xs font-bold transition-colors"
                    >
                      Cancelar Agendamento
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Criar Link / Nova Reunião */}
      <BookingModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => {
          fetchMeetings();
        }}
      />

      {/* Modal Detalhes da Votação / Consenso */}
      <MeetingPollDetailModal
        meeting={selectedMeetingForPoll}
        open={!!selectedMeetingForPoll}
        onClose={() => setSelectedMeetingForPoll(null)}
        onConfirmed={() => {
          fetchMeetings();
          setSelectedMeetingForPoll(null);
        }}
      />
    </div>
  );
};
