import React, { useState } from 'react';
import { X, Palette, Sparkles, Lock, Check, Puzzle } from 'lucide-react';
import {
  ACTION_CATALOG,
  Bot,
  BotAppStatus,
  BotSkin,
  BotTemplate,
  SkillPackage,
} from '../../types/bot';
import { BotMascotRig } from './BotMascotRig';
import { MASCOT_PRESETS } from './mascotPalettes';
import { getAppMeta } from './botHelpers';

interface NewBotSheetProps {
  onClose: () => void;
  onConfigureMascot: () => void;
  onAskVito: () => void;
}

export const NewBotSheet: React.FC<NewBotSheetProps> = ({
  onClose,
  onConfigureMascot,
  onAskVito,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
    <div
      className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-[var(--bg)] p-5 space-y-4 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-extrabold text-[var(--ink)]">Novo bot</h3>
        <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--ink)]">
          <X size={18} />
        </button>
      </div>

      <div className="space-y-2.5">
        <button
          type="button"
          onClick={() => {
            onClose();
            onConfigureMascot();
          }}
          className="w-full text-left p-4 rounded-2xl border border-[var(--line)] bg-[var(--surf)] hover:border-[var(--ink)] transition-colors flex items-center gap-3.5"
        >
          <div className="w-10 h-10 rounded-xl bg-[var(--green-bg)] text-[var(--acc)] flex items-center justify-center shrink-0">
            <Palette size={20} />
          </div>
          <div>
            <div className="text-sm font-bold text-[var(--ink)]">Configurar mascote e função</div>
            <div className="text-xs text-[var(--muted)] mt-0.5">
              Escolha cores, nome e objetivo manualmente.
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            onClose();
            onAskVito();
          }}
          className="w-full text-left p-4 rounded-2xl border border-[var(--line)] bg-[var(--surf)] hover:border-[var(--ink)] transition-colors flex items-center gap-3.5"
        >
          <div className="w-10 h-10 rounded-xl bg-[var(--blue-bg)] text-[var(--blue)] flex items-center justify-center shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="text-sm font-bold text-[var(--ink)]">Pedir ao Vito IA</div>
            <div className="text-xs text-[var(--muted)] mt-0.5">
              Descreva o que quer acompanhar em linguagem natural.
            </div>
          </div>
        </button>
      </div>
    </div>
  </div>
);

interface TemplateSheetProps {
  template: BotTemplate;
  apps: BotAppStatus[];
  skills: SkillPackage[];
  onClose: () => void;
  onActivate: (templateKey: string, skin: BotSkin) => Promise<void>;
  onCustomizeMascot: (template: BotTemplate, skin: BotSkin) => void;
}

export const TemplateSheet: React.FC<TemplateSheetProps> = ({
  template,
  apps,
  skills,
  onClose,
  onActivate,
  onCustomizeMascot,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<BotSkin>(MASCOT_PRESETS[1]);
  const [activating, setActivating] = useState(false);

  const templateSkills = template.skills
    .map((skKey) => skills.find((s) => s.key === skKey))
    .filter((s): s is SkillPackage => Boolean(s));

  const actionKeys = Array.from(
    new Set([
      ...(template.actions || []),
      ...templateSkills.flatMap((s) => s.actions),
      'notify',
    ])
  );

  const actionItems = actionKeys.map((key) => {
    const spec = ACTION_CATALOG.find((a) => a.action_key === key);
    const appKey = spec?.app_key || 'vito';
    const appStatus = apps.find((a) => a.app_key === appKey);
    const connected = appStatus ? appStatus.connected : appKey === 'vito' || appKey === 'web';
    return {
      key,
      label: spec?.label || key,
      appName: getAppMeta(appKey).label,
      connected,
    };
  });

  const lockedApps = Array.from(new Set(actionItems.filter((a) => !a.connected).map((a) => a.appName)));

  const handleActivate = async () => {
    setActivating(true);
    try {
      await onActivate(template.key, selectedPreset);
      onClose();
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-3xl border border-[var(--line)] bg-[var(--bg)] p-5 space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[var(--surf)] border border-[var(--line)] flex items-center justify-center shrink-0">
              <BotMascotRig skin={selectedPreset} state="idle" size={48} animated={true} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                {template.category}
              </span>
              <h3 className="text-lg font-extrabold text-[var(--ink)]">{template.name}</h3>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--ink)]">
            <X size={18} />
          </button>
        </div>

        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Função</div>
          <p className="text-sm text-[var(--ink)] mt-1">{template.goal}</p>
        </div>

        {template.skills.length > 0 && (
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Habilidades</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {template.skills.map((sk) => {
                const pkg = skills.find((s) => s.key === sk);
                return (
                  <span
                    key={sk}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--purple-bg)] text-[var(--purple)] text-xs font-bold"
                  >
                    <Puzzle size={12} />
                    {pkg?.name || sk}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Ações incluídas</div>
          <div className="mt-1.5 space-y-1.5">
            {actionItems.map((act) => (
              <div
                key={act.key}
                className="flex items-center justify-between px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--surf)] text-xs"
              >
                <span className="font-semibold text-[var(--ink)]">
                  {act.label} <span className="text-[var(--muted)]">· {act.appName}</span>
                </span>
                {act.connected ? (
                  <span className="inline-flex items-center gap-1 text-[var(--acc)] font-bold">
                    <Check size={12} /> Pronto
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[var(--orange)] font-bold">
                    <Lock size={12} /> Precisa conectar
                  </span>
                )}
              </div>
            ))}
          </div>

          {lockedApps.length > 0 && (
            <p className="mt-2 text-xs text-[var(--orange)] bg-[var(--orange-bg)] px-3 py-2 rounded-xl">
              Dá para ativar agora. As ações de {lockedApps.join(' e ')} ficam travadas até você conectar o app.
            </p>
          )}
        </div>

        {/* Aparência na criação */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
              Aparência na criação
            </span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onCustomizeMascot(template, selectedPreset);
              }}
              className="text-xs font-bold text-[var(--blue)] hover:underline"
            >
              Personalizar cores do bot
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {MASCOT_PRESETS.slice(0, 8).map((p) => (
              <button
                key={p.id}
                type="button"
                title={p.name}
                onClick={() => setSelectedPreset(p)}
                className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${
                  selectedPreset.preset === p.id
                    ? 'border-[var(--ink)] bg-[var(--surf)] scale-105'
                    : 'border-[var(--line)] bg-[var(--bg)]'
                }`}
              >
                <BotMascotRig skin={p} state="idle" size={32} animated={false} />
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={activating}
          onClick={handleActivate}
          className="w-full py-3 rounded-2xl bg-[var(--ink)] text-[var(--bg)] text-sm font-bold hover:opacity-90 disabled:opacity-50"
        >
          {activating ? 'Ativando...' : 'Ativar bot'}
        </button>
      </div>
    </div>
  );
};

interface SkillDetailSheetProps {
  skill: SkillPackage;
  bots: Bot[];
  apps: BotAppStatus[];
  onClose: () => void;
  onAddToBot: (botId: string, skillKey: string) => Promise<void>;
}

export const SkillDetailSheet: React.FC<SkillDetailSheetProps> = ({
  skill,
  bots,
  apps,
  onClose,
  onAddToBot,
}) => {
  const [pickingBot, setPickingBot] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  const handlePick = async (botId: string) => {
    setAddingId(botId);
    try {
      await onAddToBot(botId, skill.key);
      onClose();
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-3xl border border-[var(--line)] bg-[var(--bg)] p-5 space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--purple)]">
              Habilidade · v{skill.version}
            </span>
            <h3 className="text-lg font-extrabold text-[var(--ink)]">{skill.name}</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--ink)]">
            <X size={18} />
          </button>
        </div>

        {!pickingBot ? (
          <>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Quando usar</div>
              <p className="text-sm text-[var(--ink)] mt-1">{skill.when}</p>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Como faz</div>
              <ol className="mt-1.5 space-y-1.5 list-decimal list-inside text-xs text-[var(--ink)]">
                {skill.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Ações que usa</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {skill.actions.map((actKey) => {
                  const spec = ACTION_CATALOG.find((a) => a.action_key === actKey);
                  const appKey = spec?.app_key || 'vito';
                  const appStatus = apps.find((a) => a.app_key === appKey);
                  const connected = appStatus ? appStatus.connected : appKey === 'vito' || appKey === 'web';
                  return (
                    <span
                      key={actKey}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                        connected
                          ? 'bg-[var(--surf)] border-[var(--line)] text-[var(--ink)]'
                          : 'bg-[var(--surf)] border-[var(--line)] text-[var(--muted)] opacity-60'
                      }`}
                    >
                      {spec?.label || actKey}
                      {!connected && ' (app desconectado)'}
                    </span>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPickingBot(true)}
              className="w-full py-3 rounded-2xl bg-[var(--ink)] text-[var(--bg)] text-sm font-bold hover:opacity-90"
            >
              Adicionar a um bot
            </button>
          </>
        ) : (
          <div className="space-y-2">
            <div className="text-xs font-bold text-[var(--muted)]">Escolha o bot que vai aprender "{skill.name}":</div>
            {bots.length === 0 ? (
              <p className="text-xs text-[var(--muted)] py-4 text-center">Nenhum bot criado ainda.</p>
            ) : (
              bots.map((bot) => {
                const alreadyHas = (bot.skills || []).some((s) => s.skill_key === skill.key);
                return (
                  <button
                    key={bot.id}
                    type="button"
                    disabled={alreadyHas || addingId === bot.id}
                    onClick={() => handlePick(bot.id)}
                    className="w-full text-left px-3.5 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--surf)] hover:border-[var(--ink)] disabled:opacity-50 flex items-center justify-between"
                  >
                    <span className="text-sm font-bold text-[var(--ink)]">{bot.title}</span>
                    <span className="text-xs font-semibold text-[var(--muted)]">
                      {alreadyHas ? 'Já possui' : addingId === bot.id ? 'Adicionando...' : 'Selecionar'}
                    </span>
                  </button>
                );
              })
            )}
            <button
              type="button"
              onClick={() => setPickingBot(false)}
              className="w-full py-2 text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Voltar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
