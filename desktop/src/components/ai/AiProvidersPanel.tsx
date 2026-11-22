import React, { useState, useMemo } from 'react';
import { Search, Plus, Cpu, ChevronRight, Check } from 'lucide-react';
import { AiProviderInfo, AiProviderKey, AiReasoningEffort } from '../../types';
import { useAiProviders } from '../../hooks/useAiProviders';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { AiProviderLogo, AiProviderLogoStack } from './AiProviderLogo';
import { AiProviderModal } from './AiProviderModal';
import { ModelPickerModal } from './ModelPickerModal';
import {
  formatKeyMask,
  getOwnOkProviderCount,
  isProviderActive,
  PROVIDER_FILTER_CHIPS,
  ProviderFilterCategory,
} from './aiProvidersCatalog';

export const AiProvidersPanel: React.FC = () => {
  const {
    providers,
    modelGroups,
    preferences,
    summaryText,
    activeProviderKeys,
    resolvedDefaultDisplay,
    connectProvider,
    testProvider,
    removeProvider,
    refreshProviderModels,
    updatePreferences,
  } = useAiProviders();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterChip, setFilterChip] = useState<ProviderFilterCategory>('Todas');
  const [modalKey, setModalKey] = useState<AiProviderKey | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const ownOkCount = useMemo(() => getOwnOkProviderCount(providers), [providers]);
  const availableTotal = useMemo(
    () => providers.filter((p) => !isProviderActive(p)).length,
    [providers]
  );

  const filteredProviders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return providers.filter((p) => {
      const active = isProviderActive(p);
      if (filterChip === 'Conectados' && !active) return false;
      if (filterChip === 'Disponíveis' && active) return false;
      if (!q) return true;
      const modelsText = (p.models || []).map((m) => `${m.name} ${m.note || ''}`).join(' ');
      return `${p.name} ${p.company} ${modelsText}`.toLowerCase().includes(q);
    });
  }, [providers, searchQuery, filterChip]);

  const activeList = useMemo(
    () => filteredProviders.filter((p) => isProviderActive(p)),
    [filteredProviders]
  );
  const ownKeyList = useMemo(
    () => filteredProviders.filter((p) => !isProviderActive(p)),
    [filteredProviders]
  );

  const selectedProvider = useMemo(
    () => providers.find((p) => p.provider_key === modalKey) || null,
    [providers, modalKey]
  );

  const renderStatusPill = (provider: AiProviderInfo) => {
    if (provider.fixed) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[var(--surf)] text-[var(--ink)] border border-[var(--line)]">
          Padrão
        </span>
      );
    }
    if (provider.status === 'invalid') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[var(--red-bg)] text-[var(--red)]">
          Inválida
        </span>
      );
    }
    if (provider.status === 'ok') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[var(--green-bg)] text-[var(--acc)]">
          <Check size={11} />
          Conectado
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--surf)] text-[var(--muted)] border border-[var(--line)]">
        Conectar
      </span>
    );
  };

  const renderProviderRow = (provider: AiProviderInfo) => {
    const count = provider.model_count ?? provider.models?.length ?? 0;
    const sub = provider.fixed
      ? `${provider.company} · seleção automática sem chave`
      : isProviderActive(provider)
      ? `${provider.company} · ${count} ${count === 1 ? 'modelo' : 'modelos'} · ${formatKeyMask(provider.key_last4)}`
      : provider.company;

    return (
      <button
        key={provider.provider_key}
        type="button"
        onClick={() => setModalKey(provider.provider_key)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-[var(--surf)]/60 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <AiProviderLogo providerKey={provider.provider_key} size={36} />
          <div className="min-w-0">
            <b className="text-sm text-[var(--ink)] block truncate">{provider.name}</b>
            <span className="text-xs text-[var(--muted)] block truncate">{sub}</span>
          </div>
        </div>
        {renderStatusPill(provider)}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--ink)]">Provedores de IA</h2>
          <p className="text-xs text-[var(--muted)]">
            {ownOkCount > 0 ? summaryText : 'Só o servidor'} · {availableTotal} disponíveis
          </p>
        </div>
        <Button
          type="button"
          variant="pri"
          size="sm"
          onClick={() => setModalKey('custom')}
          leftIcon={<Plus size={14} />}
          aria-label="Adicionar endpoint customizado"
        >
          Endpoint
        </Button>
      </div>

      {toastMsg && (
        <div className="px-3.5 py-2 rounded-xl bg-[var(--green-bg)] text-[var(--acc)] text-xs font-semibold">
          {toastMsg}
        </div>
      )}

      {/* Resumo Provedores + Modelo Padrão */}
      <Card padding="none" className="bg-[var(--bg)] divide-y divide-[var(--line)] overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <AiProviderLogoStack providerKeys={activeProviderKeys} />
            <div className="min-w-0">
              <b className="text-sm text-[var(--ink)] block">Provedores ativos</b>
              <span className="text-xs text-[var(--muted)] block truncate">{summaryText}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-[var(--surf)]/60 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[var(--surf)] text-[var(--ink)] flex items-center justify-center shrink-0">
              <Cpu size={17} />
            </div>
            <div className="min-w-0">
              <b className="text-sm text-[var(--ink)] block">Modelo padrão</b>
              <span className="text-xs text-[var(--muted)] flex items-center gap-1.5 truncate">
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: resolvedDefaultDisplay.color }}
                />
                <span className="truncate">{resolvedDefaultDisplay.model.name}</span>
              </span>
            </div>
          </div>
          <ChevronRight size={16} className="text-[var(--muted)] shrink-0" />
        </button>
      </Card>

      {/* Busca e Filtros */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar provedores ou modelos"
            aria-label="Buscar provedores ou modelos"
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[var(--bg)] border border-[var(--line)] text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--ink)]"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {PROVIDER_FILTER_CHIPS.map((chip) => {
            const active = filterChip === chip;
            return (
              <button
                key={chip}
                type="button"
                onClick={() => setFilterChip(chip)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-[var(--ink)] text-[var(--bg)]'
                    : 'bg-[var(--bg)] text-[var(--muted)] border border-[var(--line)] hover:text-[var(--ink)]'
                }`}
              >
                {chip}
              </button>
            );
          })}
        </div>
      </div>

      {/* Listas Ativos & Com chave própria */}
      {activeList.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
              Ativos
            </span>
            <span className="text-xs font-semibold text-[var(--muted)]">{activeList.length}</span>
          </div>
          <Card padding="none" className="bg-[var(--bg)] divide-y divide-[var(--line)] overflow-hidden">
            {activeList.map(renderProviderRow)}
          </Card>
        </div>
      )}

      {ownKeyList.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
              Com chave própria
            </span>
            <span className="text-xs font-semibold text-[var(--muted)]">{ownKeyList.length}</span>
          </div>
          <Card padding="none" className="bg-[var(--bg)] divide-y divide-[var(--line)] overflow-hidden">
            {ownKeyList.map(renderProviderRow)}
          </Card>
        </div>
      )}

      {activeList.length === 0 && ownKeyList.length === 0 && (
        <div className="py-8 text-center text-xs text-[var(--muted)]">
          Nenhum provedor encontrado.
        </div>
      )}

      <AiProviderModal
        provider={selectedProvider}
        onClose={() => setModalKey(null)}
        onConnect={async (key, input) => {
          const updated = await connectProvider(key, input);
          showToast(`${updated.name || key} conectado`);
          return updated;
        }}
        onTest={testProvider}
        onRemove={async (key) => {
          await removeProvider(key);
          showToast('Chave removida');
        }}
        onRefreshModels={(key) => refreshProviderModels(key, true)}
      />

      <ModelPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        scope="Padrão do Vito"
        allowInherit={false}
        selectedModel={preferences.default_model}
        selectedEffort={preferences.default_effort}
        groups={modelGroups}
        onSelectModel={async (modelRef) => {
          const nextModel = modelRef || 'srv:auto';
          await updatePreferences({ default_model: nextModel });
          showToast('Modelo padrão atualizado');
        }}
        onSelectEffort={async (effort: AiReasoningEffort) => {
          await updatePreferences({ default_effort: effort });
        }}
        onManageProviders={() => setPickerOpen(false)}
      />
    </div>
  );
};
