import keyframesJson from '../prototype/keyframes.json'
import rulesJson from '../prototype/rules.json'
import { parseCubicBezier } from '../prototype/cssToRn'

export type ProtoMascotState =
  | 'idle'
  | 'blink'
  | 'gentleman'
  | 'happy'
  | 'thinking'
  | 'curious'
  | 'surprised'
  | 'sleeping'
  | 'dance'

export interface MascotSkinInput {
  preset?: string
  fill?: string
  stroke?: string
  eyes?: string
  bowtie?: string
  hat?: string
  band?: string
}

export interface MascotPreset extends Required<MascotSkinInput> {
  id: string
  name: string
  tag: string
  darkStage: boolean
}

export const MASCOT_PRESETS: readonly MascotPreset[] = [
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
] as const

export function resolveMascotSkin(skin: MascotSkinInput | undefined, isDark: boolean) {
  const base = skin ?? MASCOT_PRESETS[0]
  const df = {
    fill: isDark ? '#171717' : '#FFFFFF',
    stroke: isDark ? '#F5F5F5' : '#0A0A0A',
    eyes: isDark ? '#F5F5F5' : '#0A0A0A',
    bowtie: isDark ? '#F5F5F5' : '#0A0A0A',
    hat: isDark ? '#F5F5F5' : '#0A0A0A',
    band: isDark ? '#171717' : '#FFFFFF',
  }
  const pick = (v: string | undefined, fb: string) => (!v || v === 'auto' ? fb : v)
  return {
    preset: base.preset || 'vito',
    fill: pick(base.fill, df.fill),
    stroke: pick(base.stroke, df.stroke),
    eyes: pick(base.eyes, df.eyes),
    bowtie: pick(base.bowtie, df.bowtie),
    hat: pick(base.hat, df.hat),
    band: pick(base.band, df.band),
  }
}

export interface PartAnimationTrack {
  part: string
  keyframe: string
  durationMs: number
  delayMs: number
  bezier: [number, number, number, number]
  stops: Record<string, Record<string, string>>
}

const EASE_MAP: Record<string, [number, number, number, number]> = {
  'ease-in-out': [0.42, 0, 0.58, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in': [0.42, 0, 1, 1],
  linear: [0, 0, 1, 1],
}

function parseAnimationDecl(decl: string): Omit<PartAnimationTrack, 'part' | 'stops'> | null {
  const kfMatch = decl.match(/^(anim-[a-z0-9-]+)\s+calc\(([\d.]+)s/i)
  if (!kfMatch) return null
  const keyframe = kfMatch[1]
  const durationMs = Math.round(parseFloat(kfMatch[2]) * 1000)
  const delayMatch = decl.match(/\binfinite\s+(\.?\d+(?:\.\d+)?)s\b/i)
  const delayMs = delayMatch ? Math.round(parseFloat(delayMatch[1]) * 1000) : 0
  const bezier =
    parseCubicBezier(decl.match(/cubic-bezier\([^)]+\)/)?.[0] ?? '') ??
    EASE_MAP[decl.match(/\b(ease-in-out|ease-out|ease-in|linear)\b/)?.[1] ?? ''] ??
    [0.4, 0, 0.2, 1]
  return { keyframe, durationMs, delayMs, bezier }
}

export type MascotTracksByState = Record<ProtoMascotState, PartAnimationTrack[]>

/** Gera todas as trilhas de animação dos 9 estados direto de `rules.json` + `keyframes.json`. */
export function buildMascotTracks(): MascotTracksByState {
  const states: ProtoMascotState[] = [
    'idle',
    'blink',
    'gentleman',
    'happy',
    'thinking',
    'curious',
    'surprised',
    'sleeping',
    'dance',
  ]
  const out = Object.fromEntries(states.map((s) => [s, [] as PartAnimationTrack[]])) as MascotTracksByState
  const kfMap = keyframesJson as Record<string, { stops: Record<string, Record<string, string>> }>

  for (const r of rulesJson as Array<{ selector: string; decls: Record<string, string> }>) {
    const anim = r.decls.animation
    if (!anim) continue
    const parsed = parseAnimationDecl(anim)
    if (!parsed) continue
    for (const sel of r.selector.split(',').map((s) => s.trim())) {
      const m = sel.match(/^\.state-([a-z]+)\s+\.([a-z0-9-]+)$/)
      if (!m) continue
      const st = m[1] as ProtoMascotState
      const part = m[2]
      if (st in out) {
        out[st].push({
          part,
          ...parsed,
          stops: kfMap[parsed.keyframe]?.stops ?? {},
        })
      }
    }
  }
  return out
}

export const MASCOT_TRACKS: MascotTracksByState = buildMascotTracks()
