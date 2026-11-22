import React, { useState } from 'react';
import { Palette, Sparkles, Puzzle, Plus, Send } from 'lucide-react';
import { BotTemplate, SkillPackage } from '../../types/bot';
import { BotMascotRig } from './BotMascotRig';
import { MASCOT_PRESETS } from './mascotPalettes';

interface BotCatalogTabProps {
  templates: BotTemplate[];
  skills: SkillPackage[];
  onOpenMascotCreate: () => void;
  onSelectTemplate: (template: BotTemplate) => void;
  onSelectSkill: (skill: SkillPackage) => void;
  onSuggestApp: (name: string, reason: string) => Promise<void>;
}

export const BotCatalogTab: React.FC<BotCatalogTabProps> = ({
  templates,
  skills,
  onOpenMascotCreate,
  onSelectTemplate,
  onSelectSkill,
  onSuggestApp,
}) => {
  const [subTab, setSubTab] = useState<'templates' | 'skills'>('templates');
  const [showSuggest, setShowSuggest] = useState(false);
  const [appName, setAppName] = useState('');
  const [appReason, setAppReason] = useState('');
  const [suggestSent, setSuggestSent] = useState(false);

  const handleSuggest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appName.trim()) return;
    await onSuggestApp(appName.trim(), appReason.trim());
    setAppName('');
    setAppReason('');
    setSuggestSent(true);
    setTimeout(() => {
      setSuggestSent(false);
      setShowSuggest(false);
    }, 1800);
  };

  return (
    <div className="space-y-4">
      {/* Sub-abas: Bots prontos | Habilidades */}
      <div className="inline-flex rounded-xl bg-[var(--surf)] p-1 border border-[var(--line)]">
        <button
          type="button"
          onClick={() => setSubTab('templates')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            subTab === 'templates'
              ? 'bg-[var(--bg)] text-[var(--ink)] shadow-2xs'
              : 'text-[var(--muted)] hover:text-[var(--ink)]'
          }`}
        >
          Bots prontos ({templates.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('skills')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            subTab === 'skills'
              ? 'bg-[var(--bg)] text-[var(--ink)] shadow-2xs'
              : 'text-[var(--muted)] hover:text-[var(--ink)]'
          }`}
        >
          Habilidades ({skills.length})
        </button>
      </div>

      {subTab === 'templates' ? (
        <div className="space-y-3">
          {/* Card destaque: Criar bot e escolher mascote */}
          <button
            type="button"
            onClick={onOpenMascotCreate}
            className="w-full text-left p-4 rounded-2xl border border-dashed border-[var(--acc)]/60 bg-[var(--green-bg)]/50 hover:bg-[var(--green-bg)] transition-colors flex items-center gap-3.5"
          >
            <div className="w-12 h-12 rounded-2xl bg-[var(--bg)] border border-[var(--line)] flex items-center justify-center shrink-0">
              <Palette size={22} className="text-[var(--acc)]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-[var(--ink)] flex items-center gap-1.5">
                Criar bot e escolher mascote
                <Sparkles size={14} className="text-[var(--acc)]" />
              </div>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                Defina nome, função e personalize as 6 cores do seu bot do zero.
              </p>
            </div>
          </button>

          {/* Grade de Bots Prontos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {templates.map((tpl, idx) => {
              const preset = MASCOT_PRESETS[(idx + 1) % MASCOT_PRESETS.length];
              return (
                <button
                  key={tpl.key}
                  type="button"
                  onClick={() => onSelectTemplate(tpl)}
                  className="text-left p-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)] hover:border-[var(--ink)]/50 transition-all flex items-start gap-3"
                >
                  <div className="w-12 h-12 rounded-xl bg-[var(--surf)] border border-[var(--line)] flex items-center justify-center shrink-0">
                    <BotMascotRig skin={preset} state="idle" size={44} animated={false} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                      {tpl.category}
                    </span>
                    <h4 className="text-sm font-bold text-[var(--ink)] truncate">{tpl.name}</h4>
                    <p className="text-xs text-[var(--muted)] mt-1 line-clamp-2">{tpl.goal}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {skills.map((skill) => (
            <button
              key={skill.key}
              type="button"
              onClick={() => onSelectSkill(skill)}
              className="w-full text-left p-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)] hover:border-[var(--ink)]/50 transition-all flex items-start gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-[var(--purple-bg)] text-[var(--purple)] flex items-center justify-center shrink-0">
                <Puzzle size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-[var(--ink)]">{skill.name}</h4>
                  <span className="text-[10px] font-mono text-[var(--muted)]">v{skill.version}</span>
                </div>
                <p className="text-xs text-[var(--muted)] mt-0.5 line-clamp-2">{skill.description}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {skill.actions.map((act) => (
                    <span
                      key={act}
                      className="px-2 py-0.5 rounded-md bg-[var(--surf)] border border-[var(--line)] text-[10px] font-semibold text-[var(--muted)]"
                    >
                      {act}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Rodapé: Sugerir um app */}
      <div className="pt-2 border-t border-[var(--line)]">
        {!showSuggest ? (
          <button
            type="button"
            onClick={() => setShowSuggest(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
          >
            <Plus size={14} />
            Sugerir um app para integrar aos bots
          </button>
        ) : (
          <form onSubmit={handleSuggest} className="p-3.5 rounded-2xl border border-[var(--line)] bg-[var(--surf)] space-y-2.5">
            <div className="text-xs font-bold text-[var(--ink)]">Sugerir novo app</div>
            <input
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="Nome do app (ex: Notion, Slack)"
              className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-xs text-[var(--ink)]"
              required
            />
            <input
              type="text"
              value={appReason}
              onChange={(e) => setAppReason(e.target.value)}
              placeholder="Como você gostaria de usar com um bot?"
              className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-xs text-[var(--ink)]"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSuggest(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--ink)] text-[var(--bg)] text-xs font-semibold"
              >
                <Send size={12} />
                {suggestSent ? 'Enviado!' : 'Enviar sugestão'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
