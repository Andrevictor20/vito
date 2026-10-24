/**
 * Design Tokens Canônicos do Vito Desktop
 * Espelhados fielmente de mobile/src/theme/tokens.ts e login-vito.html
 */

export const MD3Shapes = {
  none: 0,
  extraSmall: 4,      // Badges, mini tags
  small: 8,           // Chips, campos de entrada compactos
  medium: 12,         // Alertas inline, cards secundários
  large: 16,          // Cards de chat, painéis modais secundários
  largeIncreased: 20, // Quick actions, balões de diálogo
  extraLarge: 28,     // Modais principais, cartões de login, docks
  full: 9999,         // Pílulas de ação, botões circulares, avatares
} as const;

export const lightColors = {
  // Paleta Vito Canônica (Light)
  page: '#dde1df',
  bg: '#ffffff',
  surf: '#f2f4f3',
  ink: '#17191b',
  muted: '#69706d',
  line: '#d2d7d4',

  // Acentos Funcionais e Categorias
  blue: '#2b7fd4',
  blueBg: '#e4effb',
  red: '#d6355a',
  redBg: '#fde6ec',
  purple: '#7a4fe0',
  purpleBg: '#eee8fd',
  acc: '#0b9a5f',       // Esmeralda Vito Canônico (#0b9a5f / #00E599)
  greenBg: '#ddf4e8',
  orange: '#d9681a',
  orangeBg: '#fbebdb',
  teal: '#0e8f9b',
  tealBg: '#dff3f5',

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
};

export const darkColors = {
  // Paleta Vito Canônica (Dark Executivo)
  page: '#050606',
  bg: '#0d0f10',
  surf: '#191c1e',
  ink: '#f1f3f2',
  muted: '#98a19d',
  line: '#2c3134',

  // Acentos Funcionais e Categorias
  blue: '#5aa2ee',
  blueBg: '#16283b',
  red: '#ff6b8a',
  redBg: '#3a1620',
  purple: '#a58bff',
  purpleBg: '#241a42',
  acc: '#34d399',       // Esmeralda vibrante no dark theme
  greenBg: '#12302a',
  orange: '#ff9a52',
  orangeBg: '#35230f',
  teal: '#3cc4d0',
  tealBg: '#10343a',

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
};

export type ThemeColors = typeof lightColors;

export const tokens = {
  colors: { ...lightColors },
  typography: {
    fontSans: 'Inter, system-ui, -apple-system, sans-serif',
    fontDisplay: 'Montserrat, Inter, system-ui, sans-serif',
    fontMono: 'JetBrains Mono, Menlo, monospace',
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
    subtle: '0 2px 8px rgba(20, 25, 22, 0.06)',
    card: '0 6px 22px rgba(20, 25, 22, 0.14)',
    elevated: '0 20px 48px -10px rgba(0, 0, 0, 0.35)',
    glowEmerald: '0 0 24px -4px rgba(0, 229, 153, 0.25)',
  },
};

export const getThemeTokens = (isDark: boolean) => ({
  ...tokens,
  colors: isDark ? darkColors : lightColors,
});
