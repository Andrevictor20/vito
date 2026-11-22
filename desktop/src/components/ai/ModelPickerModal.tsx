import React from 'react';
import { X, Check, Settings2 } from 'lucide-react';
import { AiModelGroup, AiReasoningEffort } from '../../types';
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
  if (!isOpen) return null;

  const okGroups = groups.filter(
    (g) => g.provider_key === 'srv' || !g.status || g.status === 'ok'
  );
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
        <div className="px-5 py-4 border-b border-[var(--line)] flex items-center justify-between">
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

        <div className="p-4 overflow-y-auto space-y-4">
          {allowInherit && (
            <button
              type="button"
              onClick={() => {
                onSelectModel(null);
                onClose();
              }}
              className="w-full px-3.5 py-3 rounded-2xl border border-[var(--line)] bg-[var(--surf)] hover:border-[var(--ink)] flex items-center justify-between gap-3 text-left transition-colors"
            >
              <div className="min-w-0">
                <b className="text-sm text-[var(--ink)] block truncate">
                  Padrão ({inheritedDisplay.model.name})
                </b>
                <span className="text-xs text-[var(--muted)] block">
                  Segue a configuração mais geral
                </span>
              </div>
              {!hasExplicitSelection && (
                <Check size={16} className="text-[var(--acc)] shrink-0" />
              )}
            </button>
          )}

          {okGroups.map((group) => {
            const meta = AI_PROVIDERS_CATALOG[group.provider_key];
            return (
              <div key={group.provider_key} className="space-y-1.5">
                <div className="flex items-center gap-2 px-1">
                  <AiProviderLogo providerKey={group.provider_key} size={16} />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    {group.provider_name || meta?.name}
                  </span>
                </div>

                <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] divide-y divide-[var(--line)] overflow-hidden">
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
                        className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-[var(--surf)] transition-colors"
                      >
                        <div className="min-w-0">
                          <b className="text-sm text-[var(--ink)] block truncate">
                            {model.name}
                          </b>
                          <span className="text-xs text-[var(--muted)] block truncate">
                            {model.note || 'Modelo disponível'}
                            {model.reasoning ? ' · raciocínio' : ''}
                          </span>
                        </div>
                        {isSelected && (
                          <Check size={16} className="text-[var(--acc)] shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {resolvedDisplay.model.reasoning && (
            <div className="space-y-2 pt-1">
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

        <div className="p-4 border-t border-[var(--line)] bg-[var(--surf)]/50">
          <button
            type="button"
            onClick={() => {
              onClose();
              onManageProviders();
            }}
            className="w-full py-2.5 px-4 rounded-xl border border-[var(--line)] bg-[var(--bg)] hover:bg-[var(--surf)] text-xs font-semibold text-[var(--ink)] flex items-center justify-center gap-2 transition-colors"
          >
            <Settings2 size={14} />
            <span>Gerenciar provedores</span>
          </button>
        </div>
      </div>
    </div>
  );
};
