import React, { useState } from 'react';
import { Trigger, TriggerLog } from '../../types';
import { extractReportParagraphs, parseReportPayload, buildRadarChatPrompt } from '../../utils/radarReportUtils';
import {
  Sparkles,
  Clock,
  Loader2,
  MoreVertical,
  Play,
  MessageSquare,
  CheckCircle2,
  Lightbulb,
  FileText,
  Trash2,
} from 'lucide-react';

interface TriggerDetailViewProps {
  trigger: Trigger;
  logs: TriggerLog[];
  loadingLogs: boolean;
  runningTest: boolean;
  onRunVerifyNow: (trigger: Trigger) => void;
  onRequestDeleteLog: (logId: string) => void;
  onRequestClearLogs: () => void;
  onOpenChatWithPrompt?: (prompt: string) => void;
}

export const TriggerDetailView: React.FC<TriggerDetailViewProps> = ({
  trigger,
  logs,
  loadingLogs,
  runningTest,
  onRunVerifyNow,
  onRequestDeleteLog,
  onRequestClearLogs,
  onOpenChatWithPrompt,
}) => {
  const [activeLogMenuId, setActiveLogMenuId] = useState<string | null>(null);

  return (
    <div className="space-y-7">
      {/* Card de Monitoramento M3 */}
      <div className="p-7 rounded-[28px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-xs sm:text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            {logs.length > 0
              ? `Última verificação ${new Date(logs[0].triggered_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`
              : 'Aguardando verificação'}
          </span>

          {trigger.status === 'active' ? (
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
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] text-xs text-zinc-600 dark:text-zinc-300 font-semibold capitalize">
            <Sparkles size={14} className="text-amber-500" />
            {trigger.category}
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] text-xs text-zinc-600 dark:text-zinc-300 font-semibold">
            <Clock size={14} className="text-zinc-400" />
            {trigger.frequency || '08:30'}
          </span>
        </div>

        <p className="text-base sm:text-lg text-zinc-800 dark:text-zinc-200 font-semibold leading-relaxed">
          {trigger.query || trigger.title}
        </p>

        {/* Botão Primário: Verificar Agora */}
        <button
          onClick={() => onRunVerifyNow(trigger)}
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

      {/* Histórico de Relatórios */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
            <Clock size={17} />
            <span>Histórico de Relatórios ({logs.length})</span>
          </div>
          {logs.length > 0 && (
            <button
              onClick={onRequestClearLogs}
              className="text-xs font-semibold text-zinc-400 hover:text-red-500 transition-colors"
            >
              Limpar histórico
            </button>
          )}
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
                  className="p-7 rounded-[28px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] shadow-sm space-y-5 relative"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                      {formattedDate} {parsed?.confidence ? `• ${parsed.confidence}% relevância` : ''}
                    </span>
                    <div className="relative">
                      <button
                        onClick={() => setActiveLogMenuId(activeLogMenuId === log.id ? null : log.id)}
                        className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white p-1 rounded-full"
                      >
                        <MoreVertical size={18} />
                      </button>
                      {activeLogMenuId === log.id && (
                        <>
                          <div
                            className="fixed inset-0 z-20"
                            onClick={() => setActiveLogMenuId(null)}
                          />
                          <div className="absolute right-0 top-7 z-30 w-36 py-1.5 rounded-2xl bg-white dark:bg-[#1C2026] border border-zinc-200 dark:border-[#2A313C] shadow-xl text-xs font-semibold">
                            <button
                              onClick={() => {
                                setActiveLogMenuId(null);
                                onRequestDeleteLog(log.id);
                              }}
                              className="w-full px-3.5 py-2 text-left flex items-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                            >
                              <Trash2 size={13} />
                              <span>Excluir</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3.5 text-base text-zinc-800 dark:text-zinc-200 leading-relaxed font-sans">
                    {paragraphs.length > 0 ? (
                      paragraphs.map((p, idx) => <p key={idx}>{p}</p>)
                    ) : (
                      <p>{log.message}</p>
                    )}
                  </div>

                  {parsed?.why_relevant && (
                    <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50 dark:bg-[#0B0D10] border border-zinc-200 dark:border-[#222730] flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300 italic">
                      <Lightbulb size={18} className="text-amber-500 shrink-0" />
                      <span>{parsed.why_relevant}</span>
                    </div>
                  )}

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => {
                        if (onOpenChatWithPrompt) {
                          const prompt = buildRadarChatPrompt(trigger.title, log.message);
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
                Esta vigília ainda não possui relatórios gravados. Clique em "Verificar Agora" acima para rodar a análise imediata com a IA.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
