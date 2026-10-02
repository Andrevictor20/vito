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

export const tokens = {
  // 1. Paleta Tonal Material Design 3 (M3)
  colors: {
    // M3 System Primary & Tonal Containers
    primary: '#A8C7FA',              // md.sys.color.primary (Acentos primários, botões ativos)
    onPrimary: '#082F5A',            // md.sys.color.on-primary (Texto/ícones sobre primary)
    primaryContainer: '#1A4072',     // md.sys.color.primary-container (Fundos de destaque/cards)
    onPrimaryContainer: '#D3E3FD',   // md.sys.color.on-primary-container (Texto sobre primary-container)
    primaryHover: '#3b82f6',
    primaryLight: 'rgba(168, 199, 250, 0.14)',
    cobalt: '#3b82f6',
    cobaltGlow: 'rgba(59, 130, 246, 0.16)',

    // M3 System Secondary & Tertiary
    secondary: '#C2E7FF',            // md.sys.color.secondary (Ações secundárias, chips)
    onSecondary: '#283141',          // md.sys.color.on-secondary
    secondaryContainer: '#3E4758',   // md.sys.color.secondary-container (Chips ativos, pílulas)
    onSecondaryContainer: '#DEE3F5', // md.sys.color.on-secondary-container
    tertiary: '#70D7C4',             // md.sys.color.tertiary
    onTertiary: '#003730',
    tertiaryContainer: '#005047',
    onTertiaryContainer: '#8EF3E0',

    // M3 Surface & Tonal Surface Containers (Dark Executive Mode)
    bg: '#111318',                   // md.sys.color.surface
    canvas: '#0E1014',               // md.sys.color.surface-dim
    surface: '#111318',              // md.sys.color.surface
    surfaceDim: '#0E1014',           // md.sys.color.surface-dim
    surfaceBright: '#37393E',        // md.sys.color.surface-bright
    surfaceSubtle: '#191C21',
    surfaceElevated: '#282A2F',

    // Camadas de Profundidade por Tonalidade (M3 Surface Containers)
    surfaceContainerLowest: '#0C0E12', // Nível 0
    surfaceContainerLow: '#191C21',    // Nível 1
    surfaceContainer: '#1E2025',       // Nível 2 (Fundo de cards e balões)
    surfaceContainerHigh: '#282A2F',   // Nível 3 (Fundo de modais, menus suspensos, Input Dock)
    surfaceContainerHighest: '#33353A',// Nível 4 (Hover, estados pressionados, chips inativos)

    // M3 Typography & Content Colors (WCAG AA Contrast)
    onSurface: '#E2E2E9',              // Texto primário em superfícies
    onSurfaceVariant: '#C4C6D0',       // Texto secundário/apoio
    textPrimary: '#E2E2E9',            // Retrocompatibilidade
    textSecondary: '#C4C6D0',          // Retrocompatibilidade
    textMuted: '#8E919A',              // Texto desativado / metadados

    // M3 Outlines & Borders
    outline: '#8E919A',                // md.sys.color.outline (Bordas de cards Outlined)
    outlineVariant: '#44474E',         // md.sys.color.outline-variant (Divisores, separadores)
    surfaceBorder: '#44474E',          // Retrocompatibilidade
    structuralBorder: '#282A2F',       // Retrocompatibilidade

    // M3 Error & Status
    error: '#FFB4AB',                  // md.sys.color.error
    onError: '#690005',                // md.sys.color.on-error
    errorContainer: '#93000A',         // md.sys.color.error-container
    onErrorContainer: '#FFDAD6',       // md.sys.color.on-error-container
    danger: '#FFB4AB',                 // Retrocompatibilidade
    dangerContainer: '#93000A',        // Retrocompatibilidade
    dangerLight: 'rgba(255, 180, 171, 0.16)',

    // Status Semânticos
    success: '#82D996',
    onSuccess: '#003914',
    successContainer: '#005322',
    onSuccessContainer: '#9EF6B0',
    successLight: 'rgba(130, 217, 150, 0.16)',
    warning: '#FFD966',
    warningLight: 'rgba(255, 217, 102, 0.16)',

    // Retrocompatibilidade adicional
    accent: '#A8C7FA',
    accentLight: 'rgba(168, 199, 250, 0.14)',
  },

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

export type ThemeTokens = typeof tokens;
