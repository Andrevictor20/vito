export type MascotAnimationState =
  | 'blink'
  | 'idle'
  | 'gentleman'
  | 'happy'
  | 'thinking'
  | 'curious'
  | 'surprised'
  | 'sleeping'
  | 'dance'
  | 'interactive';

export type MascotPart = 'hat' | 'bowtie' | 'eyes';

export interface MascotSkin {
  preset?: string;
  fill?: string;
  stroke?: string;
  eyes?: string;
  bowtie?: string;
  hat?: string;
  band?: string;
}

export interface MascotPreset extends Required<MascotSkin> {
  id: string;
  name: string;
  tag: string;
  darkStage: boolean;
}

export const MASCOT_PRESETS: MascotPreset[] = [
  { id: 'vito', preset: 'vito', name: 'Clássico', tag: 'Branco & preto', fill: 'auto', stroke: 'auto', eyes: 'auto', bowtie: 'auto', hat: 'auto', band: 'auto', darkStage: false },
  { id: 'noir', preset: 'noir', name: 'Noir & Rubi', tag: 'Grafite & vermelho', fill: '#141416', stroke: '#F5F5F5', eyes: '#F5F5F5', bowtie: '#FF3B30', hat: '#09090B', band: '#FF3B30', darkStage: true },
  { id: 'cyber', preset: 'cyber', name: 'Ciano Neon', tag: 'Marinho & rosa', fill: '#0D1322', stroke: '#00F5D4', eyes: '#00F5D4', bowtie: '#FF2A85', hat: '#1E293B', band: '#FF2A85', darkStage: true },
  { id: 'ocean', preset: 'ocean', name: 'Azul Oceano', tag: 'Celeste & coral', fill: '#E0F2FE', stroke: '#0369A1', eyes: '#0C4A6E', bowtie: '#F43F5E', hat: '#0C4A6E', band: '#38BDF8', darkStage: false },
  { id: 'amethyst', preset: 'amethyst', name: 'Lavanda & Ouro', tag: 'Roxo & dourado', fill: '#F3E8FF', stroke: '#581C87', eyes: '#3B0764', bowtie: '#D97706', hat: '#3B0764', band: '#FACC15', darkStage: false },
  { id: 'coral', preset: 'coral', name: 'Pêssego & Rubi', tag: 'Rosa suave & rubi', fill: '#FFE4E6', stroke: '#9F1239', eyes: '#4C0519', bowtie: '#0D9488', hat: '#881337', band: '#FDA4AF', darkStage: false },
  { id: 'mint', preset: 'mint', name: 'Menta & Verde', tag: 'Fresh esmeralda', fill: '#D1FAE5', stroke: '#065F46', eyes: '#064E3B', bowtie: '#10B981', hat: '#064E3B', band: '#6EE7B7', darkStage: false },
  { id: 'gold', preset: 'gold', name: 'Preto & Ouro', tag: 'Chumbo & amarelo', fill: '#18181B', stroke: '#EAB308', eyes: '#FACC15', bowtie: '#E11D48', hat: '#27272A', band: '#FACC15', darkStage: true },
  { id: 'espresso', preset: 'espresso', name: 'Creme & Caramelo', tag: 'Bege & marrom', fill: '#FEF3C7', stroke: '#451A03', eyes: '#451A03', bowtie: '#B45309', hat: '#451A03', band: '#FCD34D', darkStage: false },
  { id: 'galaxy', preset: 'galaxy', name: 'Índigo Estrelado', tag: 'Azul noite & lilás', fill: '#1E1B4B', stroke: '#818CF8', eyes: '#C7D2FE', bowtie: '#F472B6', hat: '#312E81', band: '#38BDF8', darkStage: true },
];

export const EXTRA_RANDOM_PALETTES: MascotPreset[] = [
  { id: 'limao', preset: 'custom', name: 'Limão Siciliano', tag: 'Citrus Pop', fill: '#FEF9C3', stroke: '#365314', eyes: '#1A2E05', bowtie: '#84CC16', hat: '#365314', band: '#FDE047', darkStage: false },
  { id: 'framboesa', preset: 'custom', name: 'Framboesa Elétrica', tag: 'Berry Vibe', fill: '#FFE4E6', stroke: '#881337', eyes: '#4C0519', bowtie: '#E11D48', hat: '#4C0519', band: '#FB7185', darkStage: false },
  { id: 'abismo', preset: 'custom', name: 'Abismo Bioluminescente', tag: 'Deep Sea', fill: '#082F49', stroke: '#38BDF8', eyes: '#7DD3FC', bowtie: '#22D3EE', hat: '#0C4A6E', band: '#A5F3FC', darkStage: true },
  { id: 'matcha', preset: 'custom', name: 'Matcha Latte', tag: 'Zen Green', fill: '#ECFCCB', stroke: '#14532D', eyes: '#052E16', bowtie: '#D97706', hat: '#14532D', band: '#BEF264', darkStage: false },
  { id: 'vampiro', preset: 'custom', name: 'Vampiro Elegante', tag: 'Gothic Chic', fill: '#27272A', stroke: '#F4F4F5', eyes: '#EF4444', bowtie: '#DC2626', hat: '#09090B', band: '#DC2626', darkStage: true },
];

export const ALL_RANDOMIZER_PALETTES: MascotPreset[] = [
  ...MASCOT_PRESETS,
  ...EXTRA_RANDOM_PALETTES,
];

export const DEFAULT_MASCOT_SKIN: MascotSkin = {
  preset: 'vito',
  fill: 'auto',
  stroke: 'auto',
  eyes: 'auto',
  bowtie: 'auto',
  hat: 'auto',
  band: 'auto',
};

export const HERO_TAP_SEQUENCE: MascotAnimationState[] = [
  'gentleman',
  'happy',
  'curious',
  'dance',
  'idle',
];

export function nextHeroAnimState(current: MascotAnimationState): MascotAnimationState {
  const idx = HERO_TAP_SEQUENCE.indexOf(current);
  return HERO_TAP_SEQUENCE[(idx + 1) % HERO_TAP_SEQUENCE.length];
}

export function normalizeMascotState(
  state?: MascotAnimationState | 'success'
): MascotAnimationState {
  if (!state) return 'idle';
  if (state === 'success') return 'happy';
  return state;
}

export function presetById(id?: string): MascotPreset {
  return (
    MASCOT_PRESETS.find((p) => p.id === id) ||
    EXTRA_RANDOM_PALETTES.find((p) => p.id === id) ||
    MASCOT_PRESETS[0]
  );
}

export function pickRandomMascotPreset(excludeId?: string): MascotPreset {
  const pool = excludeId
    ? ALL_RANDOMIZER_PALETTES.filter((p) => p.id !== excludeId)
    : ALL_RANDOMIZER_PALETTES;
  const list = pool.length > 0 ? pool : ALL_RANDOMIZER_PALETTES;
  return list[Math.floor(Math.random() * list.length)];
}

export function parseMascotSkin(skinJson?: string | null, fallbackSkin?: MascotSkin): MascotSkin {
  if (fallbackSkin && (fallbackSkin.fill || fallbackSkin.stroke || fallbackSkin.preset)) {
    return { ...DEFAULT_MASCOT_SKIN, ...fallbackSkin };
  }
  const legacyFallback = fallbackSkin as Record<string, unknown> | undefined;
  if (legacyFallback && typeof legacyFallback.bodyColor === 'string') {
    return {
      preset: typeof legacyFallback.preset === 'string' ? legacyFallback.preset : 'custom',
      fill: legacyFallback.bodyColor,
      stroke: String(legacyFallback.tentacleColor || '#0A0A0A'),
      eyes: String(legacyFallback.eyeColor || '#0A0A0A'),
      bowtie: String(legacyFallback.accentColor || '#0A0A0A'),
      hat: String(legacyFallback.tentacleColor || '#0A0A0A'),
      band: String(legacyFallback.bellyColor || '#FFFFFF'),
    };
  }
  if (skinJson) {
    try {
      const parsed = JSON.parse(skinJson) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.fill === 'string' || typeof parsed.stroke === 'string') {
          return { ...DEFAULT_MASCOT_SKIN, ...(parsed as MascotSkin) };
        }
        if (typeof parsed.bodyColor === 'string') {
          return {
            preset: typeof parsed.preset === 'string' ? parsed.preset : 'custom',
            fill: parsed.bodyColor,
            stroke: String(parsed.tentacleColor || '#0A0A0A'),
            eyes: String(parsed.eyeColor || '#0A0A0A'),
            bowtie: String(parsed.accentColor || '#0A0A0A'),
            hat: String(parsed.tentacleColor || '#0A0A0A'),
            band: String(parsed.bellyColor || '#FFFFFF'),
          };
        }
      }
    } catch {
      // Fallback silencioso para skin padrão
    }
  }
  return { ...DEFAULT_MASCOT_SKIN };
}

export function resolveSkin(
  skin: MascotSkin | undefined,
  isDark: boolean
): Required<MascotSkin> {
  const base = skin || DEFAULT_MASCOT_SKIN;
  const defaults = {
    fill: isDark ? '#171717' : '#FFFFFF',
    stroke: isDark ? '#F5F5F5' : '#0A0A0A',
    eyes: isDark ? '#F5F5F5' : '#0A0A0A',
    bowtie: isDark ? '#F5F5F5' : '#0A0A0A',
    hat: isDark ? '#F5F5F5' : '#0A0A0A',
    band: isDark ? '#171717' : '#FFFFFF',
  };
  return {
    preset: base.preset || 'vito',
    fill: !base.fill || base.fill === 'auto' ? defaults.fill : base.fill,
    stroke: !base.stroke || base.stroke === 'auto' ? defaults.stroke : base.stroke,
    eyes: !base.eyes || base.eyes === 'auto' ? defaults.eyes : base.eyes,
    bowtie: !base.bowtie || base.bowtie === 'auto' ? defaults.bowtie : base.bowtie,
    hat: !base.hat || base.hat === 'auto' ? defaults.hat : base.hat,
    band: !base.band || base.band === 'auto' ? defaults.band : base.band,
  };
}

export function voiceStateToMascotAnim(
  voiceState: 'listen' | 'think' | 'speak' | 'mute' | 'idle' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'IDLE' | 'MINI',
  isMuted = false
): MascotAnimationState {
  if (isMuted) return 'sleeping';
  const normalized = voiceState.toLowerCase();
  if (normalized === 'think' || normalized === 'thinking') return 'thinking';
  if (normalized === 'speak' || normalized === 'speaking') return 'happy';
  if (normalized === 'mute' || normalized === 'idle' || normalized === 'mini') return 'sleeping';
  return 'curious';
}
