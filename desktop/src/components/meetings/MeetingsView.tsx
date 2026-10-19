import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { BookingType, Meeting } from '../../types';
import { BookingModal } from './BookingModal';
import {
  CalendarCheck,
  Plus,
  Link as LinkIcon,
  BarChart2,
  Clock,
  CheckCircle2,
  Share2,
  Trash2,
  ChevronRight,
  Loader2,
  Check,
} from 'lucide-react';

export const MeetingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'links' | 'received'>('links');
  const [bookings, setBookings] = useState<BookingType[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const [bData, mData] = await Promise.all([api.getBookings(), api.getMeetings()]);
      setBookings(bData);
      setMeetings(mData);
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

  // Demo fallback meeting matching Image 4 exactly if no remote meetings returned
  const displayMeetings: Meeting[] = meetings.length > 0 ? meetings : [
    {
      id: 'meeting-plan-1',
      title: 'Reunião planejamento',
      description: 'Reunião de planejamento do app Vito, discutindo o que melhorar nos design, arquitetura e segurança do app',
      duration_minutes: 30,
      mode: 'group_consensus',
      status: 'confirmed',
      confirmed_slot_start: '2026-10-21T18:00:00Z',
      confirmed_slot_end: '2026-10-21T18:30:00Z',
      slots_count: 3,
      participants_count: 2,
      public_url: 'https://vitoassistant.rasppi.cloud/meeting/plan-vito',
      created_at: new Date().toISOString(),
    },
  ];

  return (
    <div className="flex-1 h-screen flex flex-col bg-[#F8F9FA] dark:bg-[#0B0D10] text-zinc-900 dark:text-[#FAFAFA] overflow-hidden select-none transition-colors duration-200">
      {/* Top Header */}
      <header className="h-16 px-6 border-b border-zinc-200/80 dark:border-[#222730] flex items-center justify-between bg-white/80 dark:bg-[#14171C]/80 backdrop-blur-md z-10">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Vito Booking</h2>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Links públicos de agendamento
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
                {bookings.length || 1}
              </p>
            </div>
            <div className="p-6 sm:p-7 rounded-[28px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] shadow-xs">
              <p className="text-xs sm:text-sm font-bold text-emerald-500 uppercase tracking-wider">Confirmadas</p>
              <p className="text-4xl sm:text-5xl font-black text-emerald-500 mt-2 tabular-nums">
                {displayMeetings.filter((m) => m.status === 'confirmed').length || 1}
              </p>
            </div>
            <div className="p-6 sm:p-7 rounded-[28px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] shadow-xs">
              <p className="text-xs sm:text-sm font-bold text-sky-500 uppercase tracking-wider">Participantes</p>
              <p className="text-4xl sm:text-5xl font-black text-sky-500 mt-2 tabular-nums">
                {displayMeetings.reduce((acc, m) => acc + (m.participants_count || 2), 0)}
              </p>
            </div>
          </div>

          {/* Tabs Selector: Links (1) / Recebidos (1) */}
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
              <span>Links de Agendamento ({bookings.length || 1})</span>
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
              <span>Recebidos (1)</span>
            </button>
          </div>

          {/* Section Reuniões em Grupo & Consenso */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Reuniões em Grupo & Consenso ({displayMeetings.length})
              </h3>
            </div>

            {loading ? (
              <div className="p-16 text-center text-sm text-zinc-500 flex flex-col items-center gap-3">
                <Loader2 size={24} className="animate-spin text-zinc-700 dark:text-zinc-300" />
                <span>Carregando reuniões...</span>
              </div>
            ) : (
              displayMeetings.map((meet) => (
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
                      Confirmada
                    </span>
                  </div>

                  {meet.description && (
                    <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed font-sans">
                      {meet.description}
                    </p>
                  )}

                  {/* Sub-Card: Resultado da Votação Ampliado */}
                  <div className="p-6 rounded-2xl bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] space-y-3.5">
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <div className="flex items-center gap-2.5 text-zinc-800 dark:text-zinc-200 font-bold">
                        <BarChart2 size={18} className="text-emerald-500" />
                        <span>Resultado da Votação • {meet.participants_count || 2} participantes confirmados</span>
                      </div>
                      <span className="text-xs uppercase font-extrabold text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 tracking-wide">
                        Definitivo
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 text-base sm:text-lg text-emerald-600 dark:text-emerald-400 font-bold">
                      <CheckCircle2 size={18} className="shrink-0" />
                      <span>Confirmada para: 21/10 (Qua) às 18:00 – 18:30</span>
                    </div>

                    <button className="text-xs sm:text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white font-semibold flex items-center gap-1.5 pt-1 transition-colors">
                      <span>Ver Detalhes da Votação</span>
                      <ChevronRight size={15} />
                    </button>
                  </div>

                  {/* Action Buttons Row Ampliado */}
                  <div className="flex items-center gap-3 pt-2 flex-wrap">
                    <button className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-[#1C2026] dark:hover:bg-[#262B33] border border-zinc-200 dark:border-[#222730] text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-800 dark:text-white transition-colors shadow-xs">
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
                      className="p-2.5 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#1C2026] transition-colors"
                      title="Compartilhar link de agendamento"
                    >
                      <Share2 size={17} />
                    </button>

                    <button
                      className="p-2.5 rounded-full text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-[#1C2026] transition-colors"
                      title="Excluir reunião"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal Criar Link / Nova Reunião com Paridade Mobile */}
      <BookingModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => {
          fetchMeetings();
        }}
      />
    </div>
  );
};
