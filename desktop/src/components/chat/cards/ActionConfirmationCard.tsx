import React, { useState } from 'react';
import { Check, ShieldCheck, X } from 'lucide-react';
import type { ChatCardPayload } from '../../../types';

export interface ActionConfirmationCardProps {
  pendingId: string;
  card?: ChatCardPayload;
  status?: 'pending' | 'confirmed' | 'cancelled';
  disabled?: boolean;
  onResolve?: (pendingId: string, reject: boolean) => Promise<void> | void;
}

export const ActionConfirmationCard: React.FC<ActionConfirmationCardProps> = ({
  pendingId,
  card,
  status = 'pending',
  disabled = false,
  onResolve,
}) => {
  const [submitting, setSubmitting] = useState<'confirm' | 'cancel' | null>(null);
  const [localStatus, setLocalStatus] = useState<'pending' | 'confirmed' | 'cancelled'>(status);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const effectiveStatus = status !== 'pending' ? status : localStatus;

  const handleResolve = async (reject: boolean) => {
    if (disabled || submitting || effectiveStatus !== 'pending' || !pendingId) return;
    setErrorMsg(null);
    setSubmitting(reject ? 'cancel' : 'confirm');
    try {
      await onResolve?.(pendingId, reject);
      setLocalStatus(reject ? 'cancelled' : 'confirmed');
    } catch {
      setErrorMsg('Não foi possível processar. Tente novamente.');
    } finally {
      setSubmitting(null);
    }
  };

  if (effectiveStatus === 'confirmed') {
    return (
      <div className="mt-2 px-3.5 py-2.5 rounded-2xl bg-[var(--surf)] border border-[var(--line)] max-w-lg flex items-center gap-2 text-xs text-[var(--ink)]">
        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
        <span>Ação confirmada</span>
      </div>
    );
  }

  if (effectiveStatus === 'cancelled') {
    return (
      <div className="mt-2 px-3.5 py-2.5 rounded-2xl bg-[var(--surf)] border border-[var(--line)] max-w-lg flex items-center gap-2 text-xs text-[var(--muted)]">
        <X className="w-4 h-4 shrink-0" />
        <span>Ação cancelada</span>
      </div>
    );
  }

  const title = card?.title || 'Confirmar ação';
  const subtitle = card?.subtitle;
  const confirmLabel = card?.action_label || 'Confirmar';

  return (
    <div className="mt-2 p-4 rounded-2xl bg-[var(--surf)] border border-[var(--line)] max-w-lg shadow-sm space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-[var(--bg)] border border-[var(--line)] flex items-center justify-center shrink-0 text-[var(--ink)]">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[var(--ink)]">{title}</div>
          {subtitle && (
            <p className="text-xs text-[var(--muted)] mt-0.5 leading-relaxed">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void handleResolve(true)}
          disabled={disabled || submitting !== null}
          className="flex-1 min-h-[40px] px-3 py-2 rounded-xl bg-[var(--bg)] border border-[var(--line)] text-xs font-medium text-[var(--ink)] hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          {submitting === 'cancel' ? 'Cancelando...' : 'Cancelar'}
        </button>
        <button
          type="button"
          onClick={() => void handleResolve(false)}
          disabled={disabled || submitting !== null}
          className="flex-[1.3] min-h-[40px] px-3.5 py-2 rounded-xl bg-[var(--ink)] text-[var(--bg)] text-xs font-medium flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Check className="w-3.5 h-3.5" />
          <span>{submitting === 'confirm' ? 'Confirmando...' : confirmLabel}</span>
        </button>
      </div>

      {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}
    </div>
  );
};
