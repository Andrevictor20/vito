/**
 * tokens.ts — Vito Design System v5 (Desktop)
 * Espelha integralmente os tokens de Vito-telas-atualizadas.html e mobile/src/theme/tokens.ts.
 */

export const v5LightColors = {
  page: '#efefef',
  bg: '#ffffff',
  surf: '#f4f4f4',
  btn: '#ececec',
  ink: '#0a0a0a',
  muted: '#595959',
  line: '#e6e6e6',
  blue: '#0a7cff',
  blueBg: '#e6f1ff',
  red: '#ff2d46',
  redBg: '#ffe8ec',
  purple: '#ff2fa0',
  purpleBg: '#ffe6f4',
  acc: '#0aa55c',
  greenBg: '#e3f6ec',
  orange: '#f08300',
  orangeBg: '#fff0d9',
  teal: '#0aa5b5',
  tealBg: '#dff4f6',
  fin: '#d98a00',
  finBg: '#fff2d6',
  hairline: 'rgba(10, 10, 10, 0.065)',
} as const;

export const v5DarkColors = {
  page: '#000000',
  bg: '#0a0a0a',
  surf: '#171717',
  btn: '#262626',
  ink: '#f5f5f5',
  muted: '#8c8c8c',
  line: '#262626',
  blue: '#3b93ff',
  blueBg: '#0f2540',
  red: '#ff5468',
  redBg: '#3a1219',
  purple: '#ff55b0',
  purpleBg: '#3a1229',
  acc: '#2dd17f',
  greenBg: '#0f2f22',
  orange: '#ffa733',
  orangeBg: '#35230f',
  teal: '#3cc4d0',
  tealBg: '#10343a',
  fin: '#ffb938',
  finBg: '#3a2b0b',
  hairline: 'rgba(255, 255, 255, 0.07)',
} as const;

export const v5Radii = {
  xs: 4,
  sm: 10,
  md: 14,
  evc: 20,
  card: 22,
  sheet: 28,
  dock: 40,
  pill: 999,
} as const;

export const v5Fonts = {
  sans: "'Geist', system-ui, -apple-system, sans-serif",
  mono: "'Geist Mono', ui-monospace, Menlo, monospace",
} as const;
