import { CalendarCheck, Link as LinkIcon, Users } from 'lucide-react';

export const MeetingsView: React.FC = () => {
  return (
    <div className="flex-1 h-screen flex flex-col bg-[#0B0D10] overflow-hidden select-none">
      <header className="h-16 px-6 border-b border-white/10 flex items-center justify-between bg-[#14171C]">
        <div className="flex items-center gap-3">
          <CalendarCheck size={20} className="text-indigo-400" />
          <h2 className="text-lg font-bold text-white tracking-tight">Reuniões & Vito Booking</h2>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 max-w-4xl w-full mx-auto space-y-6">
        <div className="p-6 bg-[#14171C] border border-white/10 rounded-2xl flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Seu Link Público de Agendamento</h3>
            <p className="text-xs text-slate-400 font-mono">https://vito.s.gy/book/meu-link</p>
          </div>
          <button
            onClick={() => navigator.clipboard.writeText('https://vito.s.gy/book/')}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow transition-colors"
          >
            <LinkIcon size={14} />
            <span>Copiar Link</span>
          </button>
        </div>

        <div className="p-8 text-center bg-[#14171C]/50 border border-white/5 rounded-2xl">
          <Users size={32} className="mx-auto text-slate-500 mb-2" />
          <h4 className="text-xs font-semibold text-white">Coordenação de Reuniões</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Crie enquetes e sincronize votos com convidados pelo WhatsApp ou encontre horários livres mútuos com outros usuários Vito.
          </p>
        </div>
      </div>
    </div>
  );
};
