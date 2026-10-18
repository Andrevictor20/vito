import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Trigger } from '../../types';
import { Radar, Sparkles, Clock, RefreshCw, Loader2, ArrowUpRight } from 'lucide-react';

export const TriggersView: React.FC = () => {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTriggers = async () => {
    try {
      setLoading(true);
      const data = await api.getTriggers();
      setTriggers(data);
    } catch (err) {
      console.error('Erro ao buscar radares:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTriggers();
  }, []);

  return (
    <div className="flex-1 h-screen flex flex-col bg-[#0B0D10] overflow-hidden select-none">
      {/* Top Header */}
      <header className="h-16 px-6 border-b border-white/10 flex items-center justify-between bg-[#14171C]">
        <div className="flex items-center gap-3">
          <Radar size={20} className="text-amber-400" />
          <h2 className="text-lg font-bold text-white tracking-tight">Vigílias Proativas & Radares</h2>
        </div>

        <button
          onClick={fetchTriggers}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 border border-white/5 transition-colors"
          title="Recarregar radares"
        >
          <RefreshCw size={15} />
        </button>
      </header>

      {/* Main Grid */}
      <div className="flex-1 overflow-y-auto p-6 max-w-5xl w-full mx-auto space-y-6">
        <div className="p-4 bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-transparent border border-amber-500/20 rounded-2xl">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold mb-1">
            <Sparkles size={14} />
            <span>Monitoramento Contínuo com IA & Web Search</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            O Vito rastreia oportunidades, editais de concursos, preços de passagens e notícias críticas em segundo plano, alertando você no instante exato.
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
            <Loader2 size={18} className="animate-spin text-amber-400" />
            <span>Consultando vigílias ativas...</span>
          </div>
        ) : triggers.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 bg-[#14171C] rounded-2xl border border-white/5">
            Nenhum radar configurado no momento. Use o app móvel ou peça ao Vito no chat para criar uma vigília!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {triggers.map((tr) => (
              <div
                key={tr.id}
                className="p-5 rounded-2xl bg-[#14171C] border border-white/10 hover:border-white/20 transition-all shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-white leading-snug">{tr.title}</h3>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                        tr.status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                      }`}
                    >
                      {tr.status === 'active' ? 'Ativo' : 'Pausado'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400 mb-4">
                    <span className="capitalize">{tr.category}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {tr.frequency}
                    </span>
                  </div>

                  {tr.last_report ? (
                    <div className="p-3 bg-[#0B0D10] border border-white/5 rounded-xl text-xs text-slate-300 leading-relaxed">
                      <p className="line-clamp-3">{tr.last_report.summary}</p>
                    </div>
                  ) : (
                    <div className="p-3 bg-[#0B0D10]/50 border border-white/5 rounded-xl text-xs text-slate-500 italic">
                      Aguardando primeira rodada de varredura...
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Atualizado recentemente</span>
                  <span className="text-amber-400 hover:text-amber-300 font-medium flex items-center gap-0.5 cursor-pointer">
                    Ver relatório <ArrowUpRight size={12} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
