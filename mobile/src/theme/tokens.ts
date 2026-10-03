// Google Material Design 3 (M3 / Material You) Design Tokens
// Paleta tonal calibrada para Dark Theme Executivo (WCAG AA)

export const MD3Shapes = {
  none: 0,
  extraSmall: 4,  // Badges pequenos, tags de prioridade
  small: 8,       // Chips de filtro, caixas de seleção
  medium: 12,     // Cards de tarefas, alertas inline
  large: 16,      // Cards de eventos, balões de chat, FAB regular
  extraLarge: 28, // Bottom sheets, Search Bars, Modais principais, Input Dock
  full: 9999,     // Pílulas de navegação, botões circulares, avatares
};

export const lightColors = {
  // M3 System Primary & Tonal Containers (Executive Black & White Light)
  primary: '#18181B',              // md.sys.color.primary (Preto / grafite profundo)
  onPrimary: '#FFFFFF',            // md.sys.color.on-primary (Branco sobre preto)
  primaryContainer: '#27272A',     // md.sys.color.primary-container
  onPrimaryContainer: '#FAFAFA',   // md.sys.color.on-primary-container
  primaryHover: '#27272A',
  primaryLight: 'rgba(24, 24, 27, 0.08)',
  cobalt: '#18181B',
  cobaltGlow: 'rgba(24, 24, 27, 0.12)',

  // M3 System Secondary & Tertiary
  secondary: '#3F3F46',            // md.sys.color.secondary (Ações secundárias, chips)
  onSecondary: '#FFFFFF',          // md.sys.color.on-secondary
  secondaryContainer: '#F4F4F5',   // md.sys.color.secondary-container
  onSecondaryContainer: '#18181B', // md.sys.color.on-secondary-container
  tertiary: '#52525B',             // md.sys.color.tertiary
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#F4F4F5',
  onTertiaryContainer: '#18181B',

  // M3 Surface & Tonal Surface Containers (Pure Clean White & Soft Neutrals)
  bg: '#FFFFFF',                   // Fundo base puro
  canvas: '#FFFFFF',
  surface: '#FFFFFF',              // Superfície branca limpa (sem lilás)
  surfaceDim: '#F4F4F5',
  surfaceBright: '#FFFFFF',
  surfaceSubtle: '#FAFAFA',
  surfaceElevated: '#FFFFFF',

  // Camadas de Profundidade por Tonalidade (M3 Surface Containers)
  surfaceContainerLowest: '#FFFFFF', // Nível 0
  surfaceContainerLow: '#FAFAFA',    // Nível 1 (Fundos de listas agrupadas, cartões sutis)
  surfaceContainer: '#F4F4F5',       // Nível 2 (Fundo de cards e containers padrão neutros)
  surfaceContainerHigh: '#E4E4E7',   // Nível 3 (Fundo de balões, modais)
  surfaceContainerHighest: '#D4D4D8',// Nível 4 (Hover, estados pressionados, chips)

  // M3 Typography & Content Colors (WCAG AA Contrast)
  onSurface: '#09090B',              // Texto primário em superfícies (preto nítido)
  onSurfaceVariant: '#3F3F46',       // Texto secundário/apoio
  textPrimary: '#09090B',            // Retrocompatibilidade
  textSecondary: '#52525B',          // Retrocompatibilidade
  textMuted: '#71717A',              // Texto desativado / metadados

  // M3 Outlines & Borders
  outline: '#71717A',                // md.sys.color.outline
  outlineVariant: '#E4E4E7',         // md.sys.color.outline-variant (Divisores neutros sutis)
  surfaceBorder: '#E4E4E7',          // Retrocompatibilidade
  structuralBorder: '#D4D4D8',       // Retrocompatibilidade

  // M3 Error & Status
  error: '#EF4444',
  onError: '#FFFFFF',
  errorContainer: '#FEE2E2',
  onErrorContainer: '#7F1D1D',
  danger: '#EF4444',
  dangerContainer: '#FEE2E2',
  dangerLight: 'rgba(239, 68, 68, 0.12)',

  // Status Semânticos e Badges de Categoria M3
  success: '#10B981',
  onSuccess: '#FFFFFF',
  successContainer: '#D1FAE5',
  onSuccessContainer: '#064E3B',
  successLight: 'rgba(16, 185, 129, 0.12)',
  warning: '#F59E0B',
  warningLight: 'rgba(245, 158, 11, 0.12)',
  statusOnline: '#10B981',
  categoryBirthdayBg: '#FEF3C7',
  categoryBirthdayText: '#92400E',
  categoryPartyBg: '#E0E7FF',
  categoryPartyText: '#3730A3',
  categoryBbqBg: '#FEE2E2',
  categoryBbqText: '#991B1B',

  // Retrocompatibilidade adicional
  accent: '#18181B',
  accentLight: 'rgba(24, 24, 27, 0.08)',
};

export const darkColors = {
  // M3 System Primary & Tonal Containers (Executive Slate / ChatGPT Dark Style)
  primary: '#FFFFFF',              // md.sys.color.primary (Branco puro sobre botão escuro)
  onPrimary: '#171717',            // md.sys.color.on-primary (Preto suave sobre botão branco)
  primaryContainer: '#2F2F2F',     // md.sys.color.primary-container (Cinza grafite estilo ChatGPT)
  onPrimaryContainer: '#ECECEC',   // md.sys.color.on-primary-container
  primaryHover: '#E4E4E7',
  primaryLight: 'rgba(255, 255, 255, 0.08)',
  cobalt: '#FFFFFF',
  cobaltGlow: 'rgba(255, 255, 255, 0.12)',

  // M3 System Secondary & Tertiary
  secondary: '#B4B4B4',            // md.sys.color.secondary
  onSecondary: '#171717',
  secondaryContainer: '#2A2A2A',
  onSecondaryContainer: '#ECECEC',
  tertiary: '#D4D4D8',
  onTertiary: '#171717',
  tertiaryContainer: '#2A2A2A',
  onTertiaryContainer: '#ECECEC',

  // M3 Surface & Tonal Surface Containers (Cinza Escuro estilo ChatGPT + Preto suave)
  bg: '#212121',                   // Cinza escuro ChatGPT base (sem full black agressivo)
  canvas: '#212121',
  surface: '#212121',              // Fundo principal suave
  surfaceDim: '#171717',           // Preto suave para barras ou áreas profundas
  surfaceBright: '#2F2F2F',        // Cinza médio-escuro
  surfaceSubtle: '#1C1C1E',        // Superfície intermediária
  surfaceElevated: '#2A2A2A',      // Cards elevados e modais

  surfaceContainerLowest: '#171717',
  surfaceContainerLow: '#1E1E1E',
  surfaceContainer: '#262626',     // Cards padrão de eventos e tarefas
  surfaceContainerHigh: '#2F2F2F', // Balões de mensagem, modais
  surfaceContainerHighest: '#383838', // Chips selecionados, botões

  // M3 Typography & Content Colors (WCAG AA Contrast)
  onSurface: '#ECECEC',            // Texto nítido confortável estilo ChatGPT
  onSurfaceVariant: '#B4B4B4',     // Texto secundário claro
  textPrimary: '#ECECEC',          // Retrocompatibilidade
  textSecondary: '#B4B4B4',        // Retrocompatibilidade
  textMuted: '#8E8E93',            // Metadados

  // M3 Outlines & Borders
  outline: '#8E8E93',
  outlineVariant: '#383838',       // Bordas sutis e nítidas no tema escuro
  surfaceBorder: '#383838',
  structuralBorder: '#484848',

  // M3 Error & Status
  error: '#F87171',
  onError: '#450A0A',
  errorContainer: '#7F1D1D',
  onErrorContainer: '#FEE2E2',
  danger: '#F87171',
  dangerContainer: '#7F1D1D',
  dangerLight: 'rgba(248, 113, 113, 0.16)',

  // Status Semânticos e Badges de Categoria M3
  success: '#34D399',
  onSuccess: '#064E3B',
  successContainer: '#065F46',
  onSuccessContainer: '#A7F3D0',
  successLight: 'rgba(52, 211, 153, 0.16)',
  warning: '#FBBF24',
  warningLight: 'rgba(251, 191, 36, 0.16)',
  statusOnline: '#34D399',
  categoryBirthdayBg: '#451A03',
  categoryBirthdayText: '#FDE68A',
  categoryPartyBg: '#1E1B4B',
  categoryPartyText: '#C7D2FE',
  categoryBbqBg: '#450A0A',
  categoryBbqText: '#FECACA',

  accent: '#FAFAFA',
  accentLight: 'rgba(250, 250, 250, 0.12)',
};

export type ThemeColors = typeof lightColors;

export const tokens = {
  // 1. Paleta Tonal Ativa (inicializada com Light)
  colors: { ...lightColors },

  // 2. Escala Tipográfica Material Design 3
  typography: {
    size: {
      headlineLarge: 32,
      headlineMedium: 28,
      headlineSmall: 24,
      titleLarge: 22,
      titleMedium: 16,
      titleSmall: 14,
      bodyLarge: 16,
      bodyMedium: 14,
      bodySmall: 12,
      labelLarge: 14,
      labelMedium: 12,
      labelSmall: 11,
      // Chaves retrocompatíveis
      xs: 11,
      sm: 13,
      md: 15,
      lg: 17,
      xl: 20,
      xxl: 24,
      title: 28,
    },
    lineHeight: {
      headlineLarge: 40,
      headlineMedium: 36,
      headlineSmall: 32,
      titleLarge: 28,
      titleMedium: 24,
      titleSmall: 20,
      bodyLarge: 24,
      bodyMedium: 20,
      bodySmall: 16,
      labelLarge: 20,
      labelMedium: 16,
      labelSmall: 16,
      // Chaves retrocompatíveis
      xs: 14,
      sm: 18,
      md: 22,
      lg: 24,
      xl: 28,
      xxl: 32,
      title: 36,
    },
    weight: {
      regular: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
    },
  },

  // 3. Escala de Shapes do Material 3
  radii: {
    none: MD3Shapes.none,
    xs: MD3Shapes.extraSmall,
    sm: MD3Shapes.small,
    md: MD3Shapes.medium,
    lg: MD3Shapes.large,
    xl: MD3Shapes.extraLarge,
    full: MD3Shapes.full,
    // Aliases explícitos M3
    extraSmall: MD3Shapes.extraSmall,
    small: MD3Shapes.small,
    medium: MD3Shapes.medium,
    large: MD3Shapes.large,
    extraLarge: MD3Shapes.extraLarge,
  },

  // 4. Espaçamentos M3 (Grid de 4dp / 8dp)
  spacing: {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },

  // 5. Elevações Tonais e Sombras Sutis
  shadows: {
    level0: {
      shadowOpacity: 0,
      elevation: 0,
    },
    level1: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
      elevation: 1,
    },
    level2: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.20,
      shadowRadius: 6,
      elevation: 3,
    },
    level3: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 6,
    },
    // Chaves retrocompatíveis
    subtle: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 4,
      elevation: 2,
    },
    floating: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 6,
    },
  },

  hitSlop: {
    sm: { top: 8, bottom: 8, left: 8, right: 8 },
    md: { top: 12, bottom: 12, left: 12, right: 12 },
  },
};

export const getThemeTokens = (isDark: boolean) => ({
  ...tokens,
  colors: isDark ? darkColors : lightColors,
});

export type ThemeTokens = ReturnType<typeof getThemeTokens>;
