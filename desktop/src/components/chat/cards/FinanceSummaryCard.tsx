import React from 'react';
import { Wallet } from 'lucide-react';

interface FinanceSummaryCardProps {
  title?: string;
  data?: Record<string, unknown>;
  onNavigateTab?: (tab: string) => void;
}

const fmt = (v: unknown) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));

export const FinanceSummaryCard: React.FC<FinanceSummaryCardProps> = ({
  title = 'Resumo Financeiro',
  data = {},
  onNavigateTab,
}) => {
  return (
    <div className="v5-card p-4 space-y-2.5 max-w-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
          <Wallet size={15} className="text-[var(--fin)]" />
          <span>{title}</span>
        </div>
        {onNavigateTab && (
          <button
            onClick={() => onNavigateTab('finance')}
            className="text-xs font-medium text-[var(--fin)] hover:underline"
          >
            Abrir Finanças
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="p-2 rounded-lg bg-[var(--surf)]">
          <div className="text-[var(--muted)]">Safe-to-Spend</div>
          <div className="font-semibold text-[var(--fin)] tabular-nums">{fmt(data.safe_to_spend_daily)}/dia</div>
        </div>
        <div className="p-2 rounded-lg bg-[var(--surf)]">
          <div className="text-[var(--muted)]">Saldo</div>
          <div className="font-semibold text-[var(--ink)] tabular-nums">{fmt(data.consolidated_balance)}</div>
        </div>
        <div className="p-2 rounded-lg bg-[var(--surf)]">
          <div className="text-[var(--muted)]">Faturas</div>
          <div className="font-semibold text-[var(--ink)] tabular-nums">{fmt(data.open_invoices_total)}</div>
        </div>
      </div>
    </div>
  );
};
