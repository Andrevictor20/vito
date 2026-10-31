import React, { useState } from 'react';

export interface DestructiveConfirmation {
  id?: string;
  pending_id?: string;
  toolset: string;
  operation: string;
  preview?: Record<string, any>;
  summary?: string;
  impact_count?: number;
}

export interface DestructiveConfirmationCardProps {
  confirmation: DestructiveConfirmation;
  onConfirm?: (pendingID: string) => void;
  onCancel?: () => void;
  disabled?: boolean;
}

export const DestructiveConfirmationCard: React.FC<DestructiveConfirmationCardProps> = ({
  confirmation,
  onConfirm,
  onCancel,
  disabled = false,
}) => {
  const [confirmed, setConfirmed] = useState(false);
  const pendingID = confirmation.pending_id || confirmation.id || '';

  const handleConfirm = () => {
    if (disabled || confirmed) return;
    setConfirmed(true);
    onConfirm?.(pendingID);
  };

  return (
    <div className="mt-3 p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 max-w-lg shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center shrink-0 text-amber-700 dark:text-amber-400 font-bold text-sm">
          ⚠️
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-amber-950 dark:text-amber-200">
            Ação Requer Confirmação
          </div>
          <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
            {confirmation.summary ||
              `Deseja realmente executar a operação ${confirmation.operation} em ${confirmation.toolset}?`}
          </p>
        </div>
      </div>

      {!confirmed ? (
        <div className="mt-3 flex items-center justify-end gap-2">
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={disabled}
              className="text-xs px-3 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
            >
              Cancelar
            </button>
          )}
          <button
            onClick={handleConfirm}
            disabled={disabled}
            className="text-xs px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium transition-colors shadow-2xs"
          >
            Confirmar e Executar
          </button>
        </div>
      ) : (
        <div className="mt-3 text-right">
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            ✓ Ação autorizada
          </span>
        </div>
      )}
    </div>
  );
};
