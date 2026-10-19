import React from 'react';
import { AlertTriangle, Trash2, Loader2, X } from 'lucide-react';

export type DeleteModalType = 'radar' | 'clear_logs' | 'log';

interface DeleteTriggerModalProps {
  open: boolean;
  type: DeleteModalType;
  targetTitle?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteTriggerModal: React.FC<DeleteTriggerModalProps> = ({
  open,
  type,
  targetTitle,
  loading = false,
  onClose,
  onConfirm,
}) => {
  if (!open) return null;

  const contentMap: Record<DeleteModalType, { title: string; desc: string; confirmLabel: string }> = {
    radar: {
      title: 'Excluir Radar',
      desc: targetTitle
        ? `Deseja parar de monitorar e excluir permanentemente o radar "${targetTitle}" e todo o histórico de relatórios? Essa ação não pode ser desfeita.`
        : 'Deseja parar de monitorar e excluir este radar e todo o histórico de relatórios?',
      confirmLabel: 'Excluir Radar',
    },
    clear_logs: {
      title: 'Limpar Histórico',
      desc: 'Deseja excluir todos os relatórios gerados por este radar? O monitoramento continuará ativo normalmente, mas os relatórios antigos serão apagados.',
      confirmLabel: 'Limpar Histórico',
    },
    log: {
      title: 'Excluir Relatório',
      desc: 'Deseja remover este relatório individual do histórico do radar?',
      confirmLabel: 'Excluir Relatório',
    },
  };

  const current = contentMap[type];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] rounded-[24px] p-6 shadow-2xl text-zinc-900 dark:text-[#FAFAFA] transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 rounded-full bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} />
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2 mb-6">
          <h3 className="text-base font-bold text-zinc-900 dark:text-white">
            {current.title}
          </h3>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {current.desc}
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-full border border-zinc-200 dark:border-[#222730] text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            <span>{current.confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
