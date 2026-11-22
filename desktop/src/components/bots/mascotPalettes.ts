import { Bot, BotAnimState, BotSkin } from '../../types/bot';

export interface MascotPreset extends BotSkin {
  id: string;
  name: string;
  tag: string;
  darkStage: boolean;
}

export const MASCOT_PRESETS: MascotPreset[] = [
  { id: 'vito', name: 'Clássico', tag: 'Branco & preto', fill: 'auto', stroke: 'auto', eyes: 'auto', bowtie: 'auto', hat: 'auto', band: 'auto', darkStage: false },
  { id: 'noir', name: 'Noir & Rubi', tag: 'Grafite & vermelho', fill: '#141416', stroke: '#F5F5F5', eyes: '#F5F5F5', bowtie: '#FF3B30', hat: '#09090B', band: '#FF3B30', darkStage: true },
  { id: 'cyber', name: 'Ciano Neon', tag: 'Marinho & rosa', fill: '#0D1322', stroke: '#00F5D4', eyes: '#00F5D4', bowtie: '#FF2A85', hat: '#1E293B', band: '#FF2A85', darkStage: true },
  { id: 'ocean', name: 'Azul Oceano', tag: 'Celeste & coral', fill: '#E0F2FE', stroke: '#0369A1', eyes: '#0C4A6E', bowtie: '#F43F5E', hat: '#0C4A6E', band: '#38BDF8', darkStage: false },
  { id: 'amethyst', name: 'Lavanda & Ouro', tag: 'Roxo & dourado', fill: '#F3E8FF', stroke: '#581C87', eyes: '#3B0764', bowtie: '#D97706', hat: '#3B0764', band: '#FACC15', darkStage: false },
  { id: 'coral', name: 'Pêssego & Rubi', tag: 'Rosa suave & rubi', fill: '#FFE4E6', stroke: '#9F1239', eyes: '#4C0519', bowtie: '#0D9488', hat: '#881337', band: '#FDA4AF', darkStage: false },
  { id: 'mint', name: 'Menta & Verde', tag: 'Fresh esmeralda', fill: '#D1FAE5', stroke: '#065F46', eyes: '#064E3B', bowtie: '#10B981', hat: '#064E3B', band: '#6EE7B7', darkStage: false },
  { id: 'gold', name: 'Preto & Ouro', tag: 'Chumbo & amarelo', fill: '#18181B', stroke: '#EAB308', eyes: '#FACC15', bowtie: '#E11D48', hat: '#27272A', band: '#FACC15', darkStage: true },
  { id: 'espresso', name: 'Creme & Caramelo', tag: 'Bege & marrom', fill: '#FEF3C7', stroke: '#451A03', eyes: '#451A03', bowtie: '#B45309', hat: '#451A03', band: '#FCD34D', darkStage: false },
  { id: 'galaxy', name: 'Índigo Estrelado', tag: 'Azul noite & lilás', fill: '#1E1B4B', stroke: '#818CF8', eyes: '#C7D2FE', bowtie: '#F472B6', hat: '#312E81', band: '#38BDF8', darkStage: true },
];

export const DEFAULT_BOT_SKIN: BotSkin = {
  preset: 'vito',
  fill: 'auto',
  stroke: 'auto',
  eyes: 'auto',
  bowtie: 'auto',
  hat: 'auto',
  band: 'auto',
};

export function presetById(id?: string): MascotPreset {
  return MASCOT_PRESETS.find((p) => p.id === id) || MASCOT_PRESETS[0];
}

export function parseBotSkin(bot?: Pick<Bot, 'skin' | 'skin_json'>): BotSkin {
  if (bot?.skin && Object.keys(bot.skin).length > 0) {
    return { ...DEFAULT_BOT_SKIN, ...bot.skin };
  }
  if (bot?.skin_json) {
    try {
      const parsed = JSON.parse(bot.skin_json);
      if (parsed && typeof parsed === 'object') {
        return { ...DEFAULT_BOT_SKIN, ...parsed };
      }
    } catch {
      // Fallback silencioso para skin padrão
    }
  }
  return { ...DEFAULT_BOT_SKIN };
}

export function resolveSkin(skin: BotSkin | undefined, isDark: boolean): Required<BotSkin> {
  const base = skin || DEFAULT_BOT_SKIN;
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

export function getBotAnimState(
  bot?: Pick<Bot, 'status' | 'pending'>,
  options?: { busy?: boolean; happy?: boolean }
): BotAnimState {
  if (!bot) return 'idle';
  if (bot.status === 'paused') return 'sleeping';
  if (options?.busy) return 'thinking';
  if (options?.happy) return 'happy';
  if (bot.pending && bot.pending.length > 0) return 'surprised';
  return 'idle';
}
