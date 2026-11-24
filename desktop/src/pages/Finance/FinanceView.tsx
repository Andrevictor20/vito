import React, { useCallback, useEffect, useState } from 'react';
import { Download, Plus, Search, ShieldAlert, VolumeX, Wallet } from 'lucide-react';
import { api } from '../../services/api';
import type {
  DesktopFinanceLimitRule,
  DesktopFinanceLimitStatus,
  DesktopFinanceSummary,
  DesktopFinanceTransaction,
} from '../../services/api/finance/financeApi';

const formatBRL = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

export const FinanceView: React.FC = () => {
  const [summary, setSummary] = useState<DesktopFinanceSummary | null>(null);
  const [limits, setLimits] = useState<DesktopFinanceLimitStatus[]>([]);
  const [transactions, setTransactions] = useState<DesktopFinanceTransaction[]>([]);
  const [query, setQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [showNewLimit, setShowNewLimit] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newScope, setNewScope] = useState<DesktopFinanceLimitRule['scope_type']>('CATEGORY');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, l, txs] = await Promise.allSettled([
        api.finance.getSummary(),
        api.finance.getLimits(),
        api.finance.searchTransactions(query, 60, 0),
      ]);
      if (s.status === 'fulfilled') setSummary(s.value);
      if (l.status === 'fulfilled') setLimits(l.value);
      if (txs.status === 'fulfilled') setTransactions(txs.value);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleCreateLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = Number(newAmount.replace(',', '.'));
    if (!newTitle.trim() || Number.isNaN(target) || target <= 0) return;
    await api.finance.createLimit({
      scope_type: newScope,
      title: newTitle.trim(),
      category_filter: newScope === 'CATEGORY' ? newTitle.trim() : undefined,
      target_amount: target,
      alert_thresholds: [80, 100],
      pace_alert_enabled: true,
      notify_channels: ['in_app', 'push'],
      is_active: true,
    });
    setNewTitle('');
    setNewAmount('');
    setShowNewLimit(false);
    void loadAll();
  };

  const handleExportCsv = () => {
    const header = 'Data,Descrição,Categoria,Valor\n';
    const rows = transactions
      .map((t) => `${t.occurred_at.slice(0, 10)},"${(t.clean_merchant_name || t.description).replace(/"/g, '""')}",${t.category},${t.amount}`)
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vito-extrato.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLimits = limits.filter((l) => (scopeFilter === 'ALL' ? true : l.rule.scope_type === scopeFilter));

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg)] text-[var(--ink)] space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Finanças</h1>
          <p className="text-sm text-[var(--muted)]">
            {summary?.connected_institutions_count ?? 0} instituições conectadas · Open Finance BYOK
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="px-3 py-2 rounded-xl border border-[var(--line)] text-xs font-medium flex items-center gap-1.5 hover:bg-[var(--surf)]"
          >
            <Download size={14} /> Exportar CSV
          </button>
          <button
            onClick={() => setShowNewLimit((v) => !v)}
            className="px-3.5 py-2 rounded-xl bg-[var(--fin)] text-black text-xs font-semibold flex items-center gap-1.5"
          >
            <Plus size={14} /> Novo limite
          </button>
        </div>
      </div>

      {/* Bento 3 colunas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="v5-card p-5 space-y-1">
          <div className="flex items-center justify-between text-xs text-[var(--muted)]">
            <span>Saldo consolidado</span>
            <Wallet size={15} className="text-[var(--fin)]" />
          </div>
          <div className="text-2xl font-semibold tabular-nums">{formatBRL(summary?.consolidated_balance ?? 0)}</div>
          <div className="text-xs text-[var(--muted)]">
            Faturas abertas: <strong className="text-[var(--ink)]">{formatBRL(summary?.open_invoices_total ?? 0)}</strong>
          </div>
        </div>

        <div className="v5-card p-5 space-y-1">
          <div className="text-xs text-[var(--muted)]">Safe-to-Spend diário</div>
          <div className="text-2xl font-semibold tabular-nums text-[var(--fin)]">
            {formatBRL(summary?.safe_to_spend_daily ?? 0)}
          </div>
          <div className="text-xs text-[var(--muted)]">
            {summary?.days_remaining_in_month ?? 0} dias restantes no mês
          </div>
        </div>

        <div className="v5-card p-5 space-y-1">
          <div className="text-xs text-[var(--muted)]">Fluxo do mês</div>
          <div className="text-sm flex justify-between pt-1">
            <span className="text-[var(--muted)]">Entradas</span>
            <span className="font-semibold text-emerald-500 tabular-nums">{formatBRL(summary?.month_income ?? 0)}</span>
          </div>
          <div className="text-sm flex justify-between">
            <span className="text-[var(--muted)]">Saídas</span>
            <span className="font-semibold text-rose-500 tabular-nums">{formatBRL(summary?.month_expenses ?? 0)}</span>
          </div>
        </div>
      </div>

      {showNewLimit && (
        <form onSubmit={(e) => void handleCreateLimit(e)} className="v5-card p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1">Escopo</label>
            <select
              value={newScope}
              onChange={(e) => setNewScope(e.target.value as DesktopFinanceLimitRule['scope_type'])}
              className="px-3 py-2 rounded-lg bg-[var(--surf)] border border-[var(--line)] text-sm"
            >
              <option value="CATEGORY">Categoria</option>
              <option value="CARD">Cartão</option>
              <option value="SUBSCRIPTIONS">Assinaturas</option>
              <option value="MERCHANT">Loja / App</option>
              <option value="GLOBAL_MONTHLY">Total Mensal</option>
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-[var(--muted)] mb-1">Nome / Categoria</label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Ex.: Delivery, Cartão Nubank"
              className="w-full px-3 py-2 rounded-lg bg-[var(--surf)] border border-[var(--line)] text-sm"
            />
          </div>
          <div className="w-36">
            <label className="block text-xs text-[var(--muted)] mb-1">Teto (R$)</label>
            <input
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="1500"
              className="w-full px-3 py-2 rounded-lg bg-[var(--surf)] border border-[var(--line)] text-sm"
            />
          </div>
          <button type="submit" className="px-4 py-2 rounded-lg bg-[var(--fin)] text-black text-sm font-semibold">
            Salvar
          </button>
        </form>
      )}

      {/* Painel de Limites Multi-Escopo */}
      <div className="v5-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-[var(--fin)]" />
            <h2 className="font-semibold">Limites de Gasto</h2>
          </div>
          <div className="flex gap-1.5 text-xs">
            {['ALL', 'CARD', 'CATEGORY', 'SUBSCRIPTIONS', 'MERCHANT'].map((sc) => (
              <button
                key={sc}
                onClick={() => setScopeFilter(sc)}
                className={`px-2.5 py-1 rounded-full border ${
                  scopeFilter === sc
                    ? 'border-[var(--fin)] bg-[var(--fin-bg)] text-[var(--fin)] font-medium'
                    : 'border-[var(--line)] text-[var(--muted)]'
                }`}
              >
                {sc === 'ALL' ? 'Todos' : sc}
              </button>
            ))}
          </div>
        </div>

        {filteredLimits.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nenhum limite configurado neste filtro.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredLimits.map((st) => {
              const pct = Math.min(100, Math.max(0, st.percent_used));
              const barCls =
                st.status_label === 'EXCEEDED'
                  ? 'bg-rose-500'
                  : st.status_label === 'WARNING' || st.status_label === 'PACE_RISK'
                    ? 'bg-[var(--fin)]'
                    : 'bg-emerald-500';
              return (
                <div key={st.rule.id || st.rule.title} className="p-3.5 rounded-xl border border-[var(--line)] space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium">{st.rule.title}</span>
                    <span className="tabular-nums text-xs">
                      {formatBRL(st.spent_amount)} / {formatBRL(st.rule.target_amount)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--surf)] overflow-hidden">
                    <div className={`h-full ${barCls}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between items-center text-xs text-[var(--muted)]">
                    <span>{Math.round(st.percent_used)}% · {st.status_label}</span>
                    {st.rule.id && (
                      <button
                        onClick={() => void api.finance.muteLimit(st.rule.id!).then(() => void loadAll())}
                        className="flex items-center gap-1 hover:text-[var(--ink)]"
                      >
                        <VolumeX size={12} /> Silenciar ciclo
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Extrato Analítico */}
      <div className="v5-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Extrato</h2>
          <div className="relative w-72">
            <Search size={14} className="absolute left-3 top-2.5 text-[var(--muted)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar lançamento..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--surf)] border border-[var(--line)] text-sm"
            />
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-[var(--muted)]">Carregando...</p>
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {transactions.slice(0, 30).map((tx) => (
              <div key={tx.id} className="py-2.5 flex justify-between items-center text-sm">
                <div>
                  <div className="font-medium">{tx.clean_merchant_name || tx.description}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {tx.category} · {tx.occurred_at.slice(0, 10)}
                  </div>
                </div>
                <div className={`font-semibold tabular-nums ${tx.amount < 0 ? '' : 'text-emerald-500'}`}>
                  {formatBRL(tx.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
