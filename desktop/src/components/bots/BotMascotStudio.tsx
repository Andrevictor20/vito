import React, { useState } from 'react';
import { ArrowLeft, Dices, Sparkles, Sun, Moon } from 'lucide-react';
import { BotSkin } from '../../types/bot';
import { MascotVectorRig } from '../mascot/MascotVectorRig';
import {
  MASCOT_PRESETS,
  MascotPart,
  pickRandomMascotPreset,
  presetById,
  resolveSkin,
} from '../mascot/mascotPalettes';

interface BotMascotStudioProps {
  initialTitle?: string;
  initialGoal?: string;
  initialSkin?: BotSkin;
  isEditing?: boolean;
  onCancel: () => void;
  onSave: (data: { title: string; goal: string; skin: BotSkin }) => Promise<void> | void;
}

const COLOR_PICKER_PARTS: Array<{ key: keyof Omit<BotSkin, 'preset'>; label: string }> = [
  { key: 'fill', label: 'Corpo' },
  { key: 'stroke', label: 'Contorno' },
  { key: 'eyes', label: 'Olhos' },
  { key: 'bowtie', label: 'Gravata' },
  { key: 'hat', label: 'Chapéu' },
  { key: 'band', label: 'Fita chapéu' },
];

export const BotMascotStudio: React.FC<BotMascotStudioProps> = ({
  initialTitle = 'Novo bot',
  initialGoal = 'Acompanhar o que você pedir com a sua identidade visual.',
  initialSkin,
  isEditing = false,
  onCancel,
  onSave,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [goal, setGoal] = useState(initialGoal);
  const [skin, setSkin] = useState<BotSkin>(initialSkin || MASCOT_PRESETS[1]);
  const [lastRandomName, setLastRandomName] = useState<string | null>(null);
  const [darkStage, setDarkStage] = useState<boolean>(
    () => presetById(initialSkin?.preset || MASCOT_PRESETS[1].id).darkStage
  );
  const [reaction, setReaction] = useState<MascotPart | null>(null);
  const [saving, setSaving] = useState(false);

  const activePreset = presetById(skin.preset);
  const resolved = resolveSkin(skin, darkStage);

  const handleRandomize = () => {
    const pick = pickRandomMascotPreset(skin.preset);
    setSkin({
      preset: pick.preset,
      fill: pick.fill,
      stroke: pick.stroke,
      eyes: pick.eyes,
      bowtie: pick.bowtie,
      hat: pick.hat,
      band: pick.band,
    });
    setLastRandomName(pick.preset === 'custom' ? pick.name : null);
    setDarkStage(pick.darkStage);
  };

  const handleTestReaction = () => {
    const options: MascotPart[] = ['hat', 'bowtie', 'eyes'];
    const next = options[Math.floor(Math.random() * options.length)];
    setReaction(next);
    setTimeout(() => setReaction(null), 580);
  };

  const handleSelectPreset = (presetId: string) => {
    const p = presetById(presetId);
    setSkin({
      preset: p.id,
      fill: p.fill,
      stroke: p.stroke,
      eyes: p.eyes,
      bowtie: p.bowtie,
      hat: p.hat,
      band: p.band,
    });
    setLastRandomName(null);
    setDarkStage(p.darkStage);
  };

  const handleColorChange = (part: keyof Omit<BotSkin, 'preset'>, value: string) => {
    setLastRandomName(null);
    setSkin((prev) => ({
      ...prev,
      preset: 'custom',
      [part]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        title: title.trim() || 'Novo bot',
        goal: goal.trim() || 'Assistente dedicado.',
        skin,
      });
    } finally {
      setSaving(false);
    }
  };

  const badgeLabel =
    skin.preset === 'custom' ? lastRandomName || 'Personalizado' : activePreset.name;

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] hover:bg-[var(--surf)]"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-lg font-extrabold text-[var(--ink)]">Aparência do bot</h2>
            <p className="text-xs text-[var(--muted)]">
              {title} · {isEditing ? 'Editar cores e acessórios' : 'Cores e acessórios na criação'}
            </p>
          </div>
        </div>

        <button
          id="mascot-rand"
          type="button"
          onClick={handleRandomize}
          aria-label="Sortear estilo"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-xs font-bold text-[var(--ink)] hover:bg-[var(--surf)]"
        >
          <Dices size={15} />
          Sortear cores
        </button>
      </div>

      {/* Palco do Mascote */}
      <div
        className={`rounded-3xl border border-[var(--line)] p-5 transition-colors ${
          darkStage ? 'bg-[#0f1318] text-[#f5f5f5]' : 'bg-[var(--surf)] text-[var(--ink)]'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-black/10 dark:bg-white/10">
            <Sparkles size={12} />
            {badgeLabel}
          </span>
          <button
            id="mc-bg-tgl"
            type="button"
            onClick={() => setDarkStage((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-black/10 dark:bg-white/10 hover:opacity-80"
          >
            {darkStage ? <Moon size={12} /> : <Sun size={12} />}
            {darkStage ? 'Fundo escuro' : 'Fundo claro'}
          </button>
        </div>

        <div id="mc-stage-rig" className="py-4 flex justify-center">
          <MascotVectorRig
            skin={skin}
            state="idle"
            size={152}
            animated={true}
            darkStage={darkStage}
            reaction={reaction}
            interactiveParts={true}
          />
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleTestReaction}
            className="px-4 py-1.5 rounded-full text-xs font-bold border border-current/20 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            Testar reação
          </button>
        </div>
      </div>

      {/* Identificação do bot */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4 space-y-3">
        <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
          {isEditing ? 'Identificação do bot' : 'Identificação do novo bot'}
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Nome</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl border border-[var(--line)] bg-[var(--surf)] text-sm text-[var(--ink)]"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Função</label>
          <input
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl border border-[var(--line)] bg-[var(--surf)] text-sm text-[var(--ink)]"
            required
          />
        </div>
      </div>

      {/* 10 Presets de cores */}
      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
          Presets de cores
        </div>
        <div className="grid grid-cols-2 gap-2">
          {MASCOT_PRESETS.map((p) => {
            const selected = skin.preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPreset(p.id)}
                className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                  selected
                    ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)]'
                    : 'border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] hover:border-[var(--muted)]'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    selected ? 'bg-white/15' : 'bg-[var(--surf)]'
                  }`}
                >
                  <MascotVectorRig skin={p} state="idle" size={28} animated={false} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate">{p.name}</div>
                  <div className="text-[11px] opacity-70 truncate">{p.tag}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 6 Pickers peça por peça */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4 space-y-3">
        <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
          Cores gerais, chapéu e gravata
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {COLOR_PICKER_PARTS.map((part) => {
            const val = resolved[part.key];
            return (
              <label
                key={part.key}
                className="flex items-center gap-2.5 p-2 rounded-xl border border-[var(--line)] bg-[var(--surf)] cursor-pointer"
              >
                <input
                  type="color"
                  value={val}
                  onChange={(e) => handleColorChange(part.key, e.target.value)}
                  className="w-7 h-7 rounded-md border-0 bg-transparent cursor-pointer shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[var(--ink)]">{part.label}</div>
                  <div className="text-[10px] font-mono text-[var(--muted)]">{val.toUpperCase()}</div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Salvar */}
      <button
        type="submit"
        disabled={saving}
        className="w-full py-3 rounded-2xl bg-[var(--ink)] text-[var(--bg)] text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {saving
          ? 'Salvando...'
          : isEditing
          ? 'Salvar aparência'
          : 'Ativar bot com esta aparência'}
      </button>
    </form>
  );
};
