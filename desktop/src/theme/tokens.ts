/**
 * Design Tokens Canônicos do Vito Desktop
 * Espelhados fielmente de Vito Desktop.html e mobile/src/theme/tokens.ts
 */

export const MD3Shapes = {
  none: 0,
  extraSmall: 4,      // Badges, mini tags
  small: 8,           // Chips, campos de entrada compactos
  medium: 12,         // Alertas inline, cards secundários, inputs
  large: 16,          // Cards principais, células de calendário
  largeIncreased: 20, // Quick actions, balões de diálogo, docks
  extraLarge: 28,     // Modais principais, painéis de configurações
  full: 9999,         // Pílulas de ação, botões (.pri, .sm), switches (.sw), avatares
} as const;

export type ShapeToken = keyof typeof MD3Shapes;

export const lightColors = {
  // Paleta Semântica Canônica Vito Desktop (Light)
  page: '#dde1df',
  bg: '#ffffff',
  surf: '#f2f4f3',
  ink: '#17191b',
  muted: '#69706d',
  line: '#d2d7d4',

  // Acentos Funcionais e Categorias Tonais
  blue: '#2b7fd4',
  blueBg: '#e4effb',
  red: '#d6355a',
  redBg: '#fde6ec',
  purple: '#7a4fe0',
  purpleBg: '#eee8fd',
  acc: '#0b9a5f',       // Verde Esmeralda Canônico Vito
  greenBg: '#ddf4e8',
  orange: '#d9681a',
  orangeBg: '#fbebdb',
  teal: '#0e8f9b',
  tealBg: '#dff3f5',

  // Sombra Canônica
  sh: '0 6px 22px rgba(20, 25, 22, 0.14)',

  // Material Design 3 Mapping
  primary: '#17191b',
  onPrimary: '#ffffff',
  primaryContainer: '#f2f4f3',
  onPrimaryContainer: '#17191b',
  outline: '#69706d',
  outlineVariant: '#d2d7d4',
  error: '#d6355a',
  onError: '#ffffff',
  errorContainer: '#fde6ec',
  onErrorContainer: '#d6355a',
  success: '#0b9a5f',
  warning: '#d9681a',
} as const;

export const darkColors = {
  // Paleta Semântica Canônica Vito Desktop (Dark Executivo)
  page: '#050606',
  bg: '#0d0f10',
  surf: '#191c1e',
  ink: '#f1f3f2',
  muted: '#98a19d',
  line: '#2c3134',

  // Acentos Funcionais e Categorias Tonais
  blue: '#5aa2ee',
  blueBg: '#16283b',
  red: '#ff6b8a',
  redBg: '#3a1620',
  purple: '#a58bff',
  purpleBg: '#241a42',
  acc: '#34d399',       // Esmeralda Vibrante Dark
  greenBg: '#12302a',
  orange: '#ff9a52',
  orangeBg: '#35230f',
  teal: '#3cc4d0',
  tealBg: '#10343a',

  // Sombra Canônica Dark
  sh: '0 6px 22px rgba(0, 0, 0, 0.60)',

  // Material Design 3 Mapping
  primary: '#f1f3f2',
  onPrimary: '#0d0f10',
  primaryContainer: '#191c1e',
  onPrimaryContainer: '#f1f3f2',
  outline: '#98a19d',
  outlineVariant: '#2c3134',
  error: '#ff6b8a',
  onError: '#3a1620',
  errorContainer: '#3a1620',
  onErrorContainer: '#ff6b8a',
  success: '#34d399',
  warning: '#ff9a52',
} as const;

export type ThemeColors = typeof lightColors;

/**
 * Variáveis CSS mapeadas em Vito Desktop.html (:root e [data-theme=dark])
 */
export const cssTokens = {
  bg: 'var(--bg)',
  surf: 'var(--surf)',
  ink: 'var(--ink)',
  muted: 'var(--muted)',
  line: 'var(--line)',
  blue: 'var(--blue)',
  blueBg: 'var(--blue-bg)',
  red: 'var(--red)',
  redBg: 'var(--red-bg)',
  purple: 'var(--purple)',
  purpleBg: 'var(--purple-bg)',
  acc: 'var(--acc)',
  greenBg: 'var(--green-bg)',
  orange: 'var(--orange)',
  orangeBg: 'var(--orange-bg)',
  teal: 'var(--teal)',
  tealBg: 'var(--teal-bg)',
  sh: 'var(--sh)',
} as const;

export const tokens = {
  colors: { ...lightColors },
  css: cssTokens,
  typography: {
    fontSans: 'Inter, system-ui, -apple-system, sans-serif',
    fontDisplay: 'Montserrat, Inter, system-ui, sans-serif',
    fontMono: 'JetBrains Mono, Menlo, monospace',
    tabularNums: {
      fontVariantNumeric: 'tabular-nums' as const,
    },
    weights: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
    },
  },
  radii: MD3Shapes,
  shadows: {
    hairline: '0 1px 2px rgba(20, 25, 22, 0.04)',
    card: '0 6px 22px rgba(20, 25, 22, 0.14)',
    elevated: '0 20px 48px -10px rgba(0, 0, 0, 0.35)',
    glowEmerald: '0 0 24px -4px rgba(0, 229, 153, 0.25)',
  },
};

export const getThemeTokens = (isDark: boolean) => ({
  ...tokens,
  colors: isDark ? darkColors : lightColors,
});
