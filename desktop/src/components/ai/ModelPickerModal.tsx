import React, { useMemo, useState } from 'react';
import { X, Check, Settings2, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { AiModelGroup, AiProviderKey, AiReasoningEffort } from '../../types';
import {
  AI_PROVIDERS_CATALOG,
  EFFORT_OPTIONS,
  getResolvedModelDisplay,
  isModelSelectable,
  resolveModelRef,
} from './aiProvidersCatalog';
import { AiProviderLogo } from './AiProviderLogo';

interface ModelPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  scope: string;
  allowInherit: boolean;
  selectedModel: string | null;
  selectedEffort: AiReasoningEffort;
  inheritedModel?: string;
  groups: AiModelGroup[];
  onSelectModel: (modelRef: string | null) => void;
  onSelectEffort: (effort: AiReasoningEffort) => void;
  onManageProviders: () => void;
}

export const ModelPickerModal: React.FC<ModelPickerModalProps> = ({
  isOpen,
  onClose,
  scope,
  allowInherit,
  selectedModel,
  selectedEffort,
  inheritedModel = 'srv:auto',
  groups,
  onSelectModel,
  onSelectEffort,
  onManageProviders,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | AiProviderKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const okGroups = useMemo(
    () =>
      groups.filter(
        (g) => g.provider_key === 'srv' || !g.status || g.status === 'ok'
      ),
    [groups]
  );

  const totalModels = useMemo(
    () => okGroups.reduce((acc, g) => acc + g.models.length, 0),
    [okGroups]
  );

  const visibleGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return okGroups
      .filter((g) => activeTab === 'all' || g.provider_key === activeTab)
      .map((g) => ({
        ...g,
        models: q
          ? g.models.filter(
              (m) =>
                m.name.toLowerCase().includes(q) ||
                m.id.toLowerCase().includes(q) ||
                (g.provider_name || '').toLowerCase().includes(q)
            )
          : g.models,
      }))
      .filter((g) => g.models.length > 0);
  }, [okGroups, activeTab, searchQuery]);

  if (!isOpen) return null;

  const hasExplicitSelection = isModelSelectable(selectedModel, okGroups);
  const resolvedRef = resolveModelRef(
    [selectedModel, allowInherit ? inheritedModel : null],
    okGroups
  );
  const resolvedDisplay = getResolvedModelDisplay(resolvedRef, okGroups);
  const inheritedDisplay = getResolvedModelDisplay(
    resolveModelRef([inheritedModel], okGroups),
    okGroups
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--bg)] text-[var(--ink)] rounded-[24px] border border-[var(--line)] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Modelo"
      >
        <div className="px-5 py-3.5 border-b border-[var(--line)] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[var(--ink)]">Modelo</h3>
            <p className="text-xs text-[var(--muted)]">{scope}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-full text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surf)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {(totalModels > 5 || okGroups.length > 1) && (
          <div className="px-4 pt-3 space-y-2">
            {totalModels > 5 && (
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar modelo…"
                  aria-label="Buscar modelo"
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[var(--surf)] border border-[var(--line)] text-xs text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--ink)]"
                />
              </div>
            )}
            {okGroups.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 transition-colors ${
                    activeTab === 'all'
                      ? 'bg-[var(--ink)] text-[var(--bg)]'
                      : 'bg-[var(--surf)] text-[var(--muted)] border border-[var(--line)] hover:text-[var(--ink)]'
                  }`}
                >
                  Todos ({totalModels})
                </button>
                {okGroups.map((g) => {
                  const meta = AI_PROVIDERS_CATALOG[g.provider_key];
                  const active = activeTab === g.provider_key;
                  return (
                    <button
                      key={g.provider_key}
                      type="button"
                      onClick={() => setActiveTab(g.provider_key)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 transition-colors ${
                        active
                          ? 'bg-[var(--ink)] text-[var(--bg)]'
                          : 'bg-[var(--surf)] text-[var(--muted)] border border-[var(--line)] hover:text-[var(--ink)]'
                      }`}
                    >
                      <span>{g.provider_name || meta?.name}</span>
                      <span className="opacity-70">{g.models.length}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="p-4 overflow-y-auto space-y-3">
          {allowInherit && !searchQuery.trim() && activeTab === 'all' && (
            <button
              type="button"
              onClick={() => {
                onSelectModel(null);
                onClose();
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--surf)] hover:border-[var(--ink)] flex items-center justify-between gap-3 text-left transition-colors"
            >
              <div className="min-w-0">
                <b className="text-xs font-semibold text-[var(--ink)] block truncate">
                  Padrão ({inheritedDisplay.model.name})
                </b>
                <span className="text-[11px] text-[var(--muted)] block">
                  Segue a configuração mais geral
                </span>
              </div>
              {!hasExplicitSelection && (
                <Check size={15} className="text-[var(--acc)] shrink-0" />
              )}
            </button>
          )}

          {visibleGroups.map((group) => {
            const meta = AI_PROVIDERS_CATALOG[group.provider_key];
            const isCollapsed =
              activeTab === 'all' && !searchQuery.trim() && Boolean(collapsed[group.provider_key]);
            return (
              <div key={group.provider_key} className="space-y-1">
                <button
                  type="button"
                  onClick={() =>
                    activeTab === 'all' &&
                    setCollapsed((prev) => ({
                      ...prev,
                      [group.provider_key]: !prev[group.provider_key],
                    }))
                  }
                  className="w-full flex items-center justify-between px-1 py-0.5 text-left"
                >
                  <div className="flex items-center gap-1.5">
                    <AiProviderLogo providerKey={group.provider_key} size={14} />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                      {group.provider_name || meta?.name}
                    </span>
                    <span className="text-[11px] text-[var(--muted)]">· {group.models.length}</span>
                  </div>
                  {activeTab === 'all' &&
                    (isCollapsed ? (
                      <ChevronRight size={14} className="text-[var(--muted)]" />
                    ) : (
                      <ChevronDown size={14} className="text-[var(--muted)]" />
                    ))}
                </button>

                {!isCollapsed && (
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] divide-y divide-[var(--line)] overflow-hidden">
                    {group.models.map((model) => {
                      const value = `${group.provider_key}:${model.id}`;
                      const isSelected = hasExplicitSelection
                        ? selectedModel === value
                        : !allowInherit && resolvedRef === value;

                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            onSelectModel(value);
                            onClose();
                          }}
                          className={`w-full px-3 py-2 flex items-center justify-between gap-2 text-left hover:bg-[var(--surf)] transition-colors ${
                            isSelected ? 'bg-[var(--surf)]' : ''
                          }`}
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <b className="text-xs font-semibold text-[var(--ink)] truncate">
                              {model.name}
                            </b>
                            {model.reasoning && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--surf)] border border-[var(--line)] text-[var(--muted)] shrink-0">
                                raciocínio
                              </span>
                            )}
                          </div>
                          {isSelected && (
                            <Check size={15} className="text-[var(--acc)] shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {resolvedDisplay.model.reasoning && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] px-1 block">
                Raciocínio
              </span>
              <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-[var(--surf)] border border-[var(--line)]">
                {EFFORT_OPTIONS.map((opt) => {
                  const active = selectedEffort === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onSelectEffort(opt.value)}
                      className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        active
                          ? 'bg-[var(--ink)] text-[var(--bg)] shadow-xs'
                          : 'text-[var(--muted)] hover:text-[var(--ink)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="p-3.5 border-t border-[var(--line)] bg-[var(--surf)]/50">
          <button
            type="button"
            onClick={() => {
              onClose();
              onManageProviders();
            }}
            className="w-full py-2 px-4 rounded-xl border border-[var(--line)] bg-[var(--bg)] hover:bg-[var(--surf)] text-xs font-semibold text-[var(--ink)] flex items-center justify-center gap-2 transition-colors"
          >
            <Settings2 size={14} />
            <span>Gerenciar provedores</span>
          </button>
        </div>
      </div>
    </div>
  );
};
