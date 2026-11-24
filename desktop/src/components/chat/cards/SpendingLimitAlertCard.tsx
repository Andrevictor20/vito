import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface SpendingLimitAlertCardProps {
  title?: string;
  data?: Record<string, unknown>;
  onNavigateTab?: (tab: string) => void;
}

const fmt = (v: unknown) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));

export const SpendingLimitAlertCard: React.FC<SpendingLimitAlertCardProps> = ({
  title = 'Limite de Gasto',
  data = {},
  onNavigateTab,
}) => {
  const spent = Number(data.spent_amount || 0);
  const target = Number(data.target_amount || 1);
  const pct = Math.min(100, Math.round((spent / Math.max(1, target)) * 100));
  const barCls = pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-[var(--fin)]' : 'bg-emerald-500';

  return (
    <div className="v5-card p-4 space-y-2 max-w-md">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 font-semibold text-[var(--ink)]">
          <ShieldAlert size={15} className="text-[var(--fin)]" />
          <span>{title}</span>
        </div>
        <span className="text-xs font-semibold tabular-nums">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--surf)] overflow-hidden">
        <div className={`h-full ${barCls}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs text-[var(--muted)]">
        <span className="tabular-nums">{fmt(spent)} / {fmt(target)}</span>
        {onNavigateTab && (
          <button onClick={() => onNavigateTab('finance')} className="text-[var(--fin)] font-medium hover:underline">
            Ver gastos
          </button>
        )}
      </div>
    </div>
  );
};
