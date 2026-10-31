import React from 'react';

export interface PersonaStyleOption {
  id: string;
  label: string;
  desc: string;
}

export const PERSONA_STYLES: PersonaStyleOption[] = [
  { id: 'balanced', label: 'Equilibrado', desc: 'Claro, cordial e objetivo (padrão)' },
  { id: 'direct', label: 'Direto', desc: 'Respostas concisas sem saudações' },
  { id: 'warm', label: 'Caloroso', desc: 'Empático, atencioso e acolhedor' },
  { id: 'professional', label: 'Profissional', desc: 'Formal, executivo e estruturado' },
  { id: 'relaxed', label: 'Descontraído', desc: 'Casual, bem-humorado e flexível' },
];

interface PersonaStyleSelectorProps {
  value: string;
  onChange: (styleId: string) => void;
}

export const PersonaStyleSelector: React.FC<PersonaStyleSelectorProps> = ({ value, onChange }) => {
  return (
    <div className="grid grid-cols-2 gap-2.5 pt-1">
      {PERSONA_STYLES.map((style) => (
        <button
          key={style.id}
          onClick={() => onChange(style.id)}
          className={`p-3 rounded-xl text-left border transition-all ${
            value === style.id
              ? 'border-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/20 shadow-xs'
              : 'border-zinc-200 dark:border-[#262B33] hover:border-zinc-400'
          }`}
        >
          <p className="text-xs font-bold text-zinc-900 dark:text-white mb-0.5">{style.label}</p>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{style.desc}</p>
        </button>
      ))}
    </div>
  );
};
