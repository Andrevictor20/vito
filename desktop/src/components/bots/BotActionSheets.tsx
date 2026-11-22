import React, { useState } from 'react';
import { X, ShieldAlert, Cpu } from 'lucide-react';
import { ACTION_CATALOG, ActionPolicy, SkillPackage } from '../../types/bot';

interface AddActionSheetProps {
  existingActionKeys: string[];
  onClose: () => void;
  onAdd: (actionKey: string, policy: ActionPolicy) => Promise<void>;
}

export const AddActionSheet: React.FC<AddActionSheetProps> = ({
  existingActionKeys,
  onClose,
  onAdd,
}) => {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const available = ACTION_CATALOG.filter((a) => !existingActionKeys.includes(a.action_key));

  const handleSelect = async (actionKey: string, policy: ActionPolicy) => {
    setBusyKey(actionKey);
    try {
      await onAdd(actionKey, policy);
      onClose();
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[82vh] overflow-y-auto rounded-3xl border border-[var(--line)] bg-[var(--bg)] p-5 space-y-3 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-[var(--ink)]">Adicionar ação</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--ink)]">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-[var(--muted)]">
          Enviar mensagens, compartilhar, publicar, excluir e pagar sempre pedem sua aprovação.
        </p>

        <div className="space-y-2">
          {available.length === 0 ? (
            <p className="text-xs text-[var(--muted)] py-4 text-center">
              Todas as ações disponíveis já estão neste bot.
            </p>
          ) : (
            available.map((act) => (
              <button
                key={act.action_key}
                type="button"
                disabled={busyKey === act.action_key}
                onClick={() => handleSelect(act.action_key, act.default_policy)}
                className="w-full text-left p-3 rounded-2xl border border-[var(--line)] bg-[var(--surf)] hover:border-[var(--ink)] transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-[var(--ink)]">{act.label}</span>
                  <span className="text-[10px] font-bold uppercase text-[var(--muted)]">
                    {act.app_name}
                  </span>
                </div>
                <p className="text-xs text-[var(--muted)] mt-0.5">{act.description}</p>
                {act.always_ask && (
                  <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-[var(--orange)]">
                    <ShieldAlert size={11} /> Sempre pede aprovação antes
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

interface AddSkillSheetProps {
  skills: SkillPackage[];
  existingSkillKeys: string[];
  onClose: () => void;
  onAdd: (skillKey: string) => Promise<void>;
}

export const AddSkillSheet: React.FC<AddSkillSheetProps> = ({
  skills,
  existingSkillKeys,
  onClose,
  onAdd,
}) => {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const available = skills.filter((s) => !existingSkillKeys.includes(s.key));
  const atLimit = existingSkillKeys.length >= 6;

  const handleSelect = async (skillKey: string) => {
    setBusyKey(skillKey);
    try {
      await onAdd(skillKey);
      onClose();
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[82vh] overflow-y-auto rounded-3xl border border-[var(--line)] bg-[var(--bg)] p-5 space-y-3 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-[var(--ink)]">Adicionar habilidade</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--ink)]">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-[var(--muted)]">
          Habilidades ensinam o passo a passo e adicionam apenas as ações que faltam.
        </p>

        {atLimit ? (
          <p className="text-xs text-[var(--orange)] bg-[var(--orange-bg)] p-3 rounded-xl">
            Limite de 6 habilidades por bot atingido. Remova uma habilidade antes de adicionar outra.
          </p>
        ) : (
          <div className="space-y-2">
            {available.map((sk) => (
              <button
                key={sk.key}
                type="button"
                disabled={busyKey === sk.key}
                onClick={() => handleSelect(sk.key)}
                className="w-full text-left p-3 rounded-2xl border border-[var(--line)] bg-[var(--surf)] hover:border-[var(--ink)] transition-colors"
              >
                <div className="text-sm font-bold text-[var(--ink)]">{sk.name}</div>
                <p className="text-xs text-[var(--muted)] mt-0.5">{sk.description}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface ModelPickerSheetProps {
  currentModelPref?: string;
  onClose: () => void;
  onSave: (modelPref: string) => Promise<void>;
}

const MODEL_OPTIONS = [
  { id: '', label: 'Segue o padrão do Vito', hint: 'Herda o provedor configurado em IA & Modelos' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', hint: 'Rápido e econômico para rotinas' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', hint: 'Raciocínio avançado' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', hint: 'Via sua chave OpenAI' },
  { id: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet', hint: 'Via sua chave Anthropic' },
];

export const ModelPickerSheet: React.FC<ModelPickerSheetProps> = ({
  currentModelPref = '',
  onClose,
  onSave,
}) => {
  const [saving, setSaving] = useState(false);

  const handlePick = async (modelId: string) => {
    setSaving(true);
    try {
      await onSave(modelId);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-[var(--bg)] p-5 space-y-3 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu size={18} className="text-[var(--blue)]" />
            <h3 className="text-base font-extrabold text-[var(--ink)]">Modelo de IA deste bot</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--ink)]">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2">
          {MODEL_OPTIONS.map((opt) => {
            const active = (currentModelPref || '') === opt.id;
            return (
              <button
                key={opt.id || 'default'}
                type="button"
                disabled={saving}
                onClick={() => handlePick(opt.id)}
                className={`w-full text-left p-3 rounded-2xl border transition-colors ${
                  active
                    ? 'border-[var(--ink)] bg-[var(--surf)]'
                    : 'border-[var(--line)] bg-[var(--bg)] hover:border-[var(--muted)]'
                }`}
              >
                <div className="text-sm font-bold text-[var(--ink)]">{opt.label}</div>
                <div className="text-xs text-[var(--muted)] mt-0.5">{opt.hint}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
