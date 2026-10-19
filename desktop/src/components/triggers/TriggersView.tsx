import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { Trigger, TriggerLog } from '../../types';
import { extractReportParagraphs, parseReportPayload, buildRadarChatPrompt } from '../../utils/radarReportUtils';
import { CreateTriggerModal } from './CreateTriggerModal';
import {
  Sparkles,
  Clock,
  Loader2,
  ArrowLeft,
  MoreVertical,
  Play,
  MessageSquare,
  CheckCircle2,
  Lightbulb,
  FileText,
  Plus,
} from 'lucide-react';

interface TriggersViewProps {
  onOpenChatWithPrompt?: (prompt: string) => void;
}

export const TriggersView: React.FC<TriggersViewProps> = ({ onOpenChatWithPrompt }) => {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [selectedTrigger, setSelectedTrigger] = useState<Trigger | null>(null);
  const [logs, setLogs] = useState<TriggerLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [runningTest, setRunningTest] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const fetchTriggers = async () => {
    try {
      const data = await api.getTriggers();
      setTriggers(data);
      if (data.length > 0 && !selectedTrigger) {
        setSelectedTrigger(data[0]);
      }
    } catch (err) {
      console.error('Erro ao buscar radares:', err);
    }
  };

  useEffect(() => {
    fetchTriggers();
  }, []);

  const activeItem = selectedTrigger || triggers[0] || {
    id: 'demo-1',
    title: 'Monitoramento Ativo',
    category: 'Geral',
    query: 'Acompanhar atualizações importantes',
    frequency: 'Diário às 08:30',
    status: 'active' as const,
  };

  const fetchLogs = useCallback(async (triggerId: string) => {
    if (!triggerId || triggerId === 'demo-1') {
      setLogs([]);
      return;
    }
    setLoadingLogs(true);
    try {
      const data = await api.getTriggerLogs(triggerId);
      setLogs(data);
    } catch (err) {
      console.warn('Falha ao carregar logs da vigília:', err);
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    if (activeItem.id) {
      fetchLogs(activeItem.id);
    }
  }, [activeItem.id, fetchLogs]);

  const handleToggleActive = async (tr: Trigger) => {
    const nextStatus = tr.status === 'active' ? 'paused' : 'active';
    setSelectedTrigger({ ...tr, status: nextStatus });
    setTriggers((prev) => prev.map((item) => (item.id === tr.id ? { ...item, status: nextStatus } : item)));
    try {
      await api.toggleTrigger(tr.id, nextStatus === 'active');
    } catch {
      fetchTriggers();
    }
  };

  const handleRunVerifyNow = async (tr: Trigger) => {
    if (runningTest) return;
    setRunningTest(true);
    try {
      const newLog = await api.runTrigger(tr.id);
      if (newLog) {
        setLogs((prev) => [newLog, ...prev]);
      }
    } catch {
      try {
        await api.testTrigger(tr.id);
        await fetchLogs(tr.id);
      } catch {
        alert('Falha ao verificar radar no momento.');
      }
    } finally {
      setRunningTest(false);
    }
  };

  return (
    <div className="flex-1 h-screen flex flex-col bg-[#F8F9FA] dark:bg-[#0B0D10] text-zinc-900 dark:text-[#FAFAFA] overflow-hidden select-none transition-colors duration-200">
      {/* Top Header */}
      <header className="h-16 px-6 border-b border-zinc-200/80 dark:border-[#222730] flex items-center justify-between bg-white/80 dark:bg-[#14171C]/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {}}
            className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <h2 className="text-base font-bold tracking-tight text-zinc-900 dark:text-white leading-tight">
              {activeItem.title}
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 capitalize">
              {activeItem.category} • {activeItem.frequency || 'Diário às 08:00'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Botão + Novo Radar */}
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-[#09090B] text-xs font-semibold shadow-xs transition-all"
          >
            <Plus size={14} />
            <span>+ Novo Radar</span>
          </button>

          {/* Toggle Switch */}
          <button
            type="button"
            onClick={() => handleToggleActive(activeItem)}
            className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
              activeItem.status === 'active' ? 'bg-[#10B981]' : 'bg-zinc-300 dark:bg-zinc-700'
            }`}
            title={activeItem.status === 'active' ? 'Pausar monitoramento' : 'Ativar monitoramento'}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                activeItem.status === 'active' ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>

          <button
            className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
            title="Mais opções"
          >
            <MoreVertical size={18} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-8 scroll-smooth">
        <div className="max-w-[1500px] mx-auto flex flex-col lg:flex-row gap-7">
          {/* Coluna 1: Lista de Vigílias Ampliada */}
          <div className="w-full lg:w-[420px] xl:w-[460px] shrink-0 space-y-3.5">
            <div className="flex items-center justify-between pb-1">
              <h3 className="text-xs sm:text-sm font-bold text-zinc-500 uppercase tracking-wider">
                Vigílias Ativas ({triggers.length || 1})
              </h3>
            </div>

            <div className="space-y-3">
              {(triggers.length > 0 ? triggers : [activeItem]).map((tr) => {
                const isSelected = activeItem.id === tr.id;
                return (
                  <button
                    key={tr.id}
                    onClick={() => setSelectedTrigger(tr)}
                    className={`w-full text-left p-5 rounded-[22px] border transition-all ${
                      isSelected
                        ? 'bg-white dark:bg-[#1C2026] border-zinc-900 dark:border-white shadow-md'
                        : 'bg-white/60 dark:bg-[#14171C]/60 border-zinc-200 dark:border-[#222730] hover:border-zinc-400 dark:hover:border-zinc-600 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-[#0B0D10] text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-[#222730]">
                        {tr.category}
                      </span>
                      {tr.status === 'active' ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10B981]" />
                      ) : (
                        <span className="w-2.5 h-2.5 rounded-full bg-zinc-400" />
                      )}
                    </div>
                    <h4 className="text-base font-bold text-zinc-900 dark:text-white leading-snug">
                      {tr.title}
                    </h4>
                    <p className="text-xs text-zinc-500 mt-1.5 flex items-center gap-1.5 font-medium">
                      <Clock size={13} />
                      <span>{tr.frequency || 'Diário às 08:00'}</span>
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Coluna 2: Detalhes do Radar Selecionado Ampliada */}
          <div className="flex-1 space-y-7">
            {/* Card de Monitoramento M3 */}
            <div className="p-7 rounded-[28px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                  {logs.length > 0
                    ? `Última verificação ${new Date(logs[0].triggered_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`
                    : 'Aguardando verificação'}
                </span>

                {activeItem.status === 'active' ? (
                  <span className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold tracking-wide uppercase">
                    <CheckCircle2 size={14} />
                    MONITORANDO
                  </span>
                ) : (
                  <span className="px-3.5 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-xs font-bold uppercase">
                    PAUSADO
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] text-xs text-zinc-600 dark:text-zinc-300 font-semibold">
                  <Sparkles size={14} className="text-amber-500" />
                  {activeItem.category}
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] text-xs text-zinc-600 dark:text-zinc-300 font-semibold">
                  <Clock size={14} className="text-zinc-400" />
                  {activeItem.frequency || '08:30'}
                </span>
              </div>

              <p className="text-base sm:text-lg text-zinc-800 dark:text-zinc-200 font-semibold leading-relaxed">
                {activeItem.query || activeItem.title}
              </p>

              {/* Botão Primário Full Pill: Verificar Agora */}
              <button
                onClick={() => handleRunVerifyNow(activeItem)}
                disabled={runningTest}
                className="w-full h-14 rounded-full bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-[#09090B] font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all shadow-md disabled:opacity-50"
              >
                {runningTest ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Play size={15} className="fill-current" />
                )}
                <span>Verificar Agora</span>
              </button>
            </div>

            {/* Histórico de Relatórios Ampliado */}
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                <Clock size={17} />
                <span>Histórico de Relatórios ({logs.length})</span>
              </div>

              {loadingLogs ? (
                <div className="p-16 text-center rounded-[28px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] flex flex-col items-center justify-center gap-3 text-zinc-400">
                  <Loader2 size={26} className="animate-spin text-zinc-600 dark:text-zinc-300" />
                  <p className="text-sm font-medium">Carregando relatórios do radar...</p>
                </div>
              ) : logs.length > 0 ? (
                <div className="space-y-5">
                  {logs.map((log) => {
                    const paragraphs = extractReportParagraphs(log.message, log.payload);
                    const parsed = parseReportPayload(log.payload, log.message);
                    const formattedDate = new Date(log.triggered_at).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    });

                    return (
                      <div
                        key={log.id}
                        className="p-7 rounded-[28px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] shadow-sm space-y-5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                            {formattedDate} {parsed?.confidence ? `• ${parsed.confidence}% relevância` : ''}
                          </span>
                          <button className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white p-1">
                            <MoreVertical size={18} />
                          </button>
                        </div>

                        {/* Parágrafos do relatório com tamanho confortável */}
                        <div className="space-y-3.5 text-base text-zinc-800 dark:text-zinc-200 leading-relaxed font-sans">
                          {paragraphs.length > 0 ? (
                            paragraphs.map((p, idx) => <p key={idx}>{p}</p>)
                          ) : (
                            <p>{log.message}</p>
                          )}
                        </div>

                        {/* Callout de relevância */}
                        {parsed?.why_relevant && (
                          <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300 italic">
                            <Lightbulb size={18} className="text-amber-500 shrink-0" />
                            <span>{parsed.why_relevant}</span>
                          </div>
                        )}

                        {/* Botão Conversar com Vito */}
                        <div className="pt-2 flex justify-end">
                          <button
                            onClick={() => {
                              if (onOpenChatWithPrompt) {
                                const prompt = buildRadarChatPrompt(activeItem.title, log.message);
                                onOpenChatWithPrompt(prompt);
                              }
                            }}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-[#1C2026] dark:hover:bg-[#262B33] border border-zinc-200 dark:border-[#222730] text-xs sm:text-sm font-semibold text-zinc-800 dark:text-white transition-colors shadow-xs"
                          >
                            <MessageSquare size={16} className="text-[#10B981]" />
                            <span>Conversar com Vito</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
              <div className="p-10 text-center rounded-[24px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] shadow-sm space-y-3">
                <div className="w-10 h-10 mx-auto rounded-xl bg-zinc-100 dark:bg-white/5 flex items-center justify-center text-zinc-400">
                  <FileText size={20} />
                </div>
                <div className="space-y-1">
                  <h5 className="text-sm font-bold text-zinc-900 dark:text-white">Nenhum relatório gerado ainda</h5>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                    Esta vigília ainda não possui relatórios gravados. Clique no botão "Verificar Agora" acima para rodar a análise imediata com a IA.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Modal de Criação de Radar */}
    <CreateTriggerModal
      open={createModalOpen}
      onClose={() => setCreateModalOpen(false)}
      onCreated={fetchTriggers}
    />
  </div>
  );
};
