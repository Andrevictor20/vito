import tokensData from '../prototype/tokens.json'
import rulesData from '../prototype/rules.json'
import {
  parseColor,
  parseCssDeclarations,
  parseCubicBezier,
  type RnStyleResult,
  type TokenMap,
} from '../prototype/cssToRn'

export type ProtoTokenName = keyof typeof tokensData.light

export function getRawTokens(isDark: boolean): TokenMap {
  return isDark ? { ...tokensData.light, ...tokensData.dark } : { ...tokensData.light }
}

/** Retorna valor resolvido (hex/rgba/ms/bezier) de qualquer CSS var do protótipo. */
export function token(name: ProtoTokenName | (string & {}), isDark = false): string {
  const map = getRawTokens(isDark)
  const raw = map[name] ?? ''
  if (!raw) return ''
  if (raw.startsWith('#') || raw.startsWith('rgb') || raw.includes('color-mix')) {
    return parseColor(raw, map)
  }
  return raw
}

/** Pontos [x1, y1, x2, y2] extraídos de `--ease-q`, `--ease-std`, `--ease-in`, `--ease-out`. */
export function getBezier(
  name: '--ease-q' | '--ease-std' | '--ease-in' | '--ease-out',
): [number, number, number, number] {
  return parseCubicBezier(tokensData.light[name]) ?? [0.4, 0, 0.2, 1]
}

/**
 * Aplica cascata CSS fiel para um seletor de `rules.json` na ordem do protótipo
 * e traduz as declarações mescladas para React Native via `cssToRn`.
 */
export function resolveRule(selector: string, isDark = false): RnStyleResult {
  const merged: Record<string, string> = {}
  for (const r of rulesData as Array<{ selector: string; decls: Record<string, string> }>) {
    if (r.selector === selector) {
      Object.assign(merged, r.decls)
    }
  }
  return parseCssDeclarations(merged, getRawTokens(isDark))
}
