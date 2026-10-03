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
  // M3 System Primary & Tonal Containers (Material Design 3 Canonical Light)
  primary: '#6750A4',              // md.sys.color.primary (Acentos primários, botões ativos, FAB)
  onPrimary: '#FFFFFF',            // md.sys.color.on-primary (Texto/ícones sobre primary)
  primaryContainer: '#EADDFF',     // md.sys.color.primary-container (Pílulas ativas, balões de chat do usuário)
  onPrimaryContainer: '#21005D',   // md.sys.color.on-primary-container (Texto sobre primary-container)
  primaryHover: '#5B4495',
  primaryLight: 'rgba(103, 80, 164, 0.12)',
  cobalt: '#6750A4',
  cobaltGlow: 'rgba(103, 80, 164, 0.16)',

  // M3 System Secondary & Tertiary
  secondary: '#625B71',            // md.sys.color.secondary (Ações secundárias, chips)
  onSecondary: '#FFFFFF',          // md.sys.color.on-secondary
  secondaryContainer: '#E8DEF8',   // md.sys.color.secondary-container (Chips ativos, pílulas secundárias)
  onSecondaryContainer: '#1D192B', // md.sys.color.on-secondary-container
  tertiary: '#7D5260',             // md.sys.color.tertiary
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#FFD8E4',
  onTertiaryContainer: '#31111D',

  // M3 Surface & Tonal Surface Containers (Material 3 Tonal Elevation Light)
  bg: '#FEF7FF',                   // md.sys.color.surface
  canvas: '#FEF7FF',               // md.sys.color.surface-dim
  surface: '#FEF7FF',              // md.sys.color.surface (Fundo base)
  surfaceDim: '#DED8E1',           // md.sys.color.surface-dim
  surfaceBright: '#FEF7FF',        // md.sys.color.surface-bright
  surfaceSubtle: '#F7F2FA',
  surfaceElevated: '#ECE6F0',

  // Camadas de Profundidade por Tonalidade (M3 Surface Containers)
  surfaceContainerLowest: '#FFFFFF', // Nível 0
  surfaceContainerLow: '#F7F2FA',    // Nível 1 (Fundos de listas agrupadas, cartões sutis)
  surfaceContainer: '#F3EDF7',       // Nível 2 (Fundo de cards e containers padrão)
  surfaceContainerHigh: '#ECE6F0',   // Nível 3 (Fundo de balões do assistente, modais, menus)
  surfaceContainerHighest: '#E6E0E9',// Nível 4 (Hover, estados pressionados, chips)

  // M3 Typography & Content Colors (WCAG AA Contrast)
  onSurface: '#1D1B20',              // Texto primário em superfícies
  onSurfaceVariant: '#49454F',       // Texto secundário/apoio
  textPrimary: '#1D1B20',            // Retrocompatibilidade
  textSecondary: '#49454F',          // Retrocompatibilidade
  textMuted: '#79747E',              // Texto desativado / metadados

  // M3 Outlines & Borders
  outline: '#79747E',                // md.sys.color.outline (Bordas de cards Outlined, inputs)
  outlineVariant: '#CAC4D0',         // md.sys.color.outline-variant (Divisores, separadores)
  surfaceBorder: '#CAC4D0',          // Retrocompatibilidade
  structuralBorder: '#E6E0E9',       // Retrocompatibilidade

  // M3 Error & Status
  error: '#B3261E',                  // md.sys.color.error
  onError: '#FFFFFF',                // md.sys.color.on-error
  errorContainer: '#F9DEDC',         // md.sys.color.error-container
  onErrorContainer: '#410E0B',       // md.sys.color.on-error-container
  danger: '#B3261E',                 // Retrocompatibilidade
  dangerContainer: '#F9DEDC',        // Retrocompatibilidade
  dangerLight: 'rgba(179, 38, 30, 0.12)',

  // Status Semânticos e Badges de Categoria M3
  success: '#2E6C38',
  onSuccess: '#FFFFFF',
  successContainer: '#B8F5B8',
  onSuccessContainer: '#002107',
  successLight: 'rgba(46, 108, 56, 0.12)',
  warning: '#7B4B14',
  warningLight: 'rgba(123, 75, 20, 0.12)',
  statusOnline: '#55A46B',
  categoryBirthdayBg: '#FFE7C5',
  categoryBirthdayText: '#7B4B14',
  categoryPartyBg: '#E8DEF8',
  categoryPartyText: '#1D192B',
  categoryBbqBg: '#FFD8E4',
  categoryBbqText: '#31111D',

  // Retrocompatibilidade adicional
  accent: '#6750A4',
  accentLight: 'rgba(103, 80, 164, 0.12)',
};

export const darkColors = {
  // M3 System Primary & Tonal Containers (Material Design 3 Canonical Dark)
  primary: '#D0BCFF',              // md.sys.color.primary (Roxo claro para superfície escura)
  onPrimary: '#381E72',            // md.sys.color.on-primary
  primaryContainer: '#4F378B',     // md.sys.color.primary-container
  onPrimaryContainer: '#EADDFF',   // md.sys.color.on-primary-container
  primaryHover: '#6750A4',
  primaryLight: 'rgba(208, 188, 255, 0.14)',
  cobalt: '#D0BCFF',
  cobaltGlow: 'rgba(208, 188, 255, 0.16)',

  // M3 System Secondary & Tertiary
  secondary: '#CCC2DC',
  onSecondary: '#332D41',
  secondaryContainer: '#4A4458',
  onSecondaryContainer: '#E8DEF8',
  tertiary: '#EFB8C8',
  onTertiary: '#492532',
  tertiaryContainer: '#633B48',
  onTertiaryContainer: '#FFD8E4',

  // M3 Surface & Tonal Surface Containers (Material 3 Tonal Elevation Dark)
  bg: '#141218',
  canvas: '#141218',
  surface: '#141218',
  surfaceDim: '#141218',
  surfaceBright: '#3B383E',
  surfaceSubtle: '#1D1B20',
  surfaceElevated: '#2B2930',

  surfaceContainerLowest: '#0F0D13',
  surfaceContainerLow: '#1D1B20',
  surfaceContainer: '#211F26',
  surfaceContainerHigh: '#2B2930',
  surfaceContainerHighest: '#36343B',

  // M3 Typography & Content Colors (WCAG AA Contrast)
  onSurface: '#E6E0E9',
  onSurfaceVariant: '#CAC4D0',
  textPrimary: '#E6E0E9',
  textSecondary: '#CAC4D0',
  textMuted: '#938F99',

  // M3 Outlines & Borders
  outline: '#938F99',
  outlineVariant: '#49454F',
  surfaceBorder: '#49454F',
  structuralBorder: '#2B2930',

  // M3 Error & Status
  error: '#F2B8B5',
  onError: '#601410',
  errorContainer: '#8C1D18',
  onErrorContainer: '#F9DEDC',
  danger: '#F2B8B5',
  dangerContainer: '#8C1D18',
  dangerLight: 'rgba(242, 184, 181, 0.16)',

  // Status Semânticos e Badges de Categoria M3
  success: '#82D996',
  onSuccess: '#003914',
  successContainer: '#005322',
  onSuccessContainer: '#9EF6B0',
  successLight: 'rgba(130, 217, 150, 0.16)',
  warning: '#FFD966',
  warningLight: 'rgba(255, 217, 102, 0.16)',
  statusOnline: '#55A46B',
  categoryBirthdayBg: '#4A3419',
  categoryBirthdayText: '#FFDCC1',
  categoryPartyBg: '#4A4458',
  categoryPartyText: '#E8DEF8',
  categoryBbqBg: '#633B48',
  categoryBbqText: '#FFD8E4',

  accent: '#D0BCFF',
  accentLight: 'rgba(208, 188, 255, 0.14)',
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
