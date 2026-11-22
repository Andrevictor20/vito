import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { api } from '../../services/api';
import {
  DEFAULT_NOTIFICATION_PREFS,
  NotificationCategoryPreferences,
} from '../../services/api/inboxNotificationsApi';
import {
  BillingCycle,
  DEFAULT_PRIVACY_SETTINGS,
  PrivacyPermissionsState,
  PrivacySettingsState,
  UserSubscriptionState,
} from '../../services/api/storeComplianceApi';
import {
  DEVICE_PERMISSION_ROWS,
  formatBrl,
  NOTIFICATION_CATEGORY_ROWS,
  STORE_PLANS,
} from './StoreCatalogData';
import { StoreAboutView, StoreHelpView } from './StoreHelpAboutViews';
import { Button } from '../ui/Button';

export type StorePage = 'pro' | 'priv' | 'notif' | 'help' | 'about';

interface StorePanelProps {
  initialPage?: StorePage;
  onLogout?: () => void;
}

export const StorePanel: React.FC<StorePanelProps> = ({ initialPage = 'pro', onLogout }) => {
  const [page, setPage] = useState<StorePage>(initialPage);
  const [subscription, setSubscription] = useState<UserSubscriptionState>({
    plan: 'free',
    billing_cycle: 'year',
    status: 'inactive',
  });
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'ultra'>('pro');
  const [billing, setBilling] = useState<BillingCycle>('year');
  const [privacy, setPrivacy] = useState<PrivacySettingsState>(DEFAULT_PRIVACY_SETTINGS);
  const [notifPrefs, setNotifPrefs] = useState<NotificationCategoryPreferences>(
    DEFAULT_NOTIFICATION_PREFS
  );
  const [deleteText, setDeleteText] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    setPage(initialPage);
  }, [initialPage]);

  useEffect(() => {
    api.store.getSubscription().then(setSubscription).catch(() => {});
    api.store.getPrivacySettings().then(setPrivacy).catch(() => {});
    api.inbox.getPreferences().then(setNotifPrefs).catch(() => {});
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((p) => (p === msg ? '' : p)), 2600);
  };

  const isYearly = billing === 'year';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['pro', 'Planos Pro e Ultra'],
            ['priv', 'Privacidade e dados'],
            ['notif', 'Notificações'],
            ['help', 'Ajuda e suporte'],
            ['about', 'Sobre o Vito'],
          ] as Array<[StorePage, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPage(id)}
            className={`h-9 px-4 rounded-full text-xs font-semibold border transition-colors ${
              page === id
                ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]'
                : 'bg-[var(--bg)] text-[var(--ink)] border-[var(--line)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {page === 'pro' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-[var(--bg)] p-4 rounded-2xl border border-[var(--line)]">
            <div>
              <h3 className="text-base font-bold">Vito Pro e Ultra</h3>
              <p className="text-xs text-[var(--muted)]">
                Teste grátis por 7 dias. Cancele quando quiser.
              </p>
            </div>
            <div className="flex rounded-full bg-[var(--surf)] p-1 border border-[var(--line)]">
              {[
                ['month', 'Mensal'],
                ['year', 'Anual · -30%'],
              ].map(([id, lbl]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setBilling(id as BillingCycle)}
                  className={`px-3 h-7 rounded-full text-xs font-semibold ${
                    billing === id ? 'bg-[var(--ink)] text-[var(--bg)]' : 'text-[var(--muted)]'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {STORE_PLANS.map((p) => {
              const selected = selectedPlan === p.id;
              const price = isYearly ? p.yearlyPrice : p.monthlyPrice;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPlan(p.id)}
                  className={`text-left p-5 rounded-2xl border-2 transition-all ${
                    selected
                      ? 'border-[var(--ink)] bg-[var(--bg)]'
                      : 'border-[var(--line)] bg-[var(--bg)] opacity-85'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <b className="text-lg font-bold">{p.name}</b>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--acc)] text-white">
                      {p.badge}
                    </span>
                  </div>
                  <div className="text-2xl font-bold mt-2 tabular-nums">
                    {formatBrl(price)}
                    <span className="text-xs font-medium text-[var(--muted)]">
                      {isYearly ? ' /ano' : ' /mês'}
                    </span>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs">
                        <Check size={14} className="text-[var(--acc)] shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="pri"
              size="md"
              pill
              onClick={async () => {
                const sub = await api.store
                  .subscribe(selectedPlan, billing)
                  .catch(() => ({ plan: selectedPlan, billing_cycle: billing, status: 'trialing' }));
                setSubscription(sub);
                showToast(`Teste grátis do Vito ${selectedPlan === 'pro' ? 'Pro' : 'Ultra'} ativado`);
              }}
            >
              {subscription.plan === selectedPlan
                ? `Plano ${selectedPlan.toUpperCase()} ativo`
                : `Testar ${selectedPlan === 'pro' ? 'Pro' : 'Ultra'} por 7 dias grátis`}
            </Button>
            <Button
              variant="outline"
              size="md"
              pill
              onClick={async () => {
                await api.store.restorePurchases().catch(() => {});
                showToast('Verificação de compras concluída');
              }}
            >
              Restaurar compras
            </Button>
          </div>
        </div>
      )}

      {page === 'priv' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-[var(--blue-bg)] text-xs leading-relaxed">
            Seus dados são criptografados e nunca vendidos. O Vito é uma IA e pode errar: confira informações importantes.
          </div>

          <div className="rounded-2xl bg-[var(--bg)] border border-[var(--line)] divide-y divide-[var(--line)]">
            {DEVICE_PERMISSION_ROWS.map((r) => {
              const on = !!privacy.permissions[r.key];
              return (
                <div key={r.key} className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <b className="text-sm block">{r.label}</b>
                    <span className="text-xs text-[var(--muted)]">{r.desc}</span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const next: PrivacySettingsState = {
                        ...privacy,
                        permissions: {
                          ...privacy.permissions,
                          [r.key]: !on,
                        } as PrivacyPermissionsState,
                      };
                      setPrivacy(next);
                      await api.store.updatePrivacySettings(next).catch(() => {});
                    }}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors ${
                      on ? 'bg-[var(--acc)]' : 'bg-[var(--line)]'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        on ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl bg-[var(--bg)] border border-[var(--line)] divide-y divide-[var(--line)]">
            {[
              {
                label: 'Processar com provedores de IA',
                desc: 'Seu texto e voz são enviados a OpenAI, Google ou Anthropic para gerar respostas',
                on: privacy.ai_processing_enabled,
                toggle: async () => {
                  const next = { ...privacy, ai_processing_enabled: !privacy.ai_processing_enabled };
                  setPrivacy(next);
                  await api.store.updatePrivacySettings(next).catch(() => {});
                },
              },
              {
                label: 'Análises e diagnósticos',
                desc: 'Dados anônimos para corrigir erros',
                on: privacy.analytics_enabled,
                toggle: async () => {
                  const next = { ...privacy, analytics_enabled: !privacy.analytics_enabled };
                  setPrivacy(next);
                  await api.store.updatePrivacySettings(next).catch(() => {});
                },
              },
            ].map((row) => (
              <div key={row.label} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <b className="text-sm block">{row.label}</b>
                  <span className="text-xs text-[var(--muted)]">{row.desc}</span>
                </div>
                <button
                  type="button"
                  onClick={row.toggle}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors ${
                    row.on ? 'bg-[var(--acc)]' : 'bg-[var(--line)]'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      row.on ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="md"
              pill
              onClick={async () => {
                const res = await api.store.exportAccountData().catch(() => null);
                if (res?.data) {
                  const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'vito-dados-lgpd.json';
                  a.click();
                  URL.revokeObjectURL(url);
                }
                showToast('Exportação LGPD JSON pronta');
              }}
            >
              Baixar meus dados (LGPD JSON)
            </Button>

            <Button
              variant="outline"
              size="md"
              pill
              onClick={() => setDeleteOpen((v) => !v)}
              className="text-[var(--red)] border-[var(--red)]"
            >
              Excluir minha conta
            </Button>
          </div>

          {deleteOpen && (
            <div className="p-4 rounded-2xl bg-[var(--red-bg)] border border-[var(--red)] space-y-3">
              <p className="text-xs font-medium">
                Esta ação remove conversas, agenda, tarefas, bots e integrações em até 30 dias. Digite{' '}
                <b>EXCLUIR</b> para confirmar:
              </p>
              <div className="flex gap-2">
                <input
                  value={deleteText}
                  onChange={(e) => setDeleteText(e.target.value)}
                  placeholder="Digite EXCLUIR"
                  className="flex-1 h-10 px-3 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-sm"
                />
                <Button
                  variant="pri"
                  size="sm"
                  pill
                  disabled={deleteText.trim().toUpperCase() !== 'EXCLUIR'}
                  onClick={async () => {
                    await api.store.deleteAccount(deleteText.trim().toUpperCase()).catch(() => {});
                    showToast('Conta agendada para exclusão em 30 dias');
                    setDeleteOpen(false);
                    setTimeout(() => onLogout?.(), 800);
                  }}
                >
                  Confirmar exclusão
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {page === 'notif' && (
        <div className="rounded-2xl bg-[var(--bg)] border border-[var(--line)] divide-y divide-[var(--line)]">
          {NOTIFICATION_CATEGORY_ROWS.map((r) => {
            const on = !!notifPrefs[r.key];
            return (
              <div key={r.key} className="p-4 flex items-center justify-between">
                <div>
                  <b className="text-sm block">{r.label}</b>
                  <span className="text-xs text-[var(--muted)]">{r.desc}</span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const next = { ...notifPrefs, [r.key]: !on };
                    setNotifPrefs(next);
                    await api.inbox.updatePreferences({ [r.key]: !on }).catch(() => {});
                  }}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors ${
                    on ? 'bg-[var(--acc)]' : 'bg-[var(--line)]'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      on ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {page === 'help' && <StoreHelpView onToast={showToast} />}

      {page === 'about' && <StoreAboutView />}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-[var(--ink)] text-[var(--bg)] text-xs font-semibold shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
};
