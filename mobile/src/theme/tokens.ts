export const tokens = {
  colors: {
    // Executive Slate Surfaces (Stitch Dark Theme)
    bg: '#121315',
    canvas: '#0a0b0d',
    surface: '#1f2022',
    surfaceSubtle: '#1b1c1e',
    surfaceElevated: '#292a2c',
    surfaceContainerLowest: '#0d0e10',
    surfaceContainerLow: '#1b1c1e',
    surfaceContainer: '#1f2022',
    surfaceContainerHigh: '#292a2c',
    surfaceContainerHighest: '#343537',
    surfaceBorder: '#272e3b',
    structuralBorder: '#272e3b',

    // Executive Slate Primary & Accents
    primary: '#adc6ff',
    primaryContainer: '#4d8eff',
    primaryHover: '#3b82f6',
    primaryLight: 'rgba(173, 198, 255, 0.12)',
    cobalt: '#3b82f6',
    cobaltGlow: 'rgba(59, 130, 246, 0.16)',

    // Accents & Secondary
    secondary: '#b9c8de',
    secondaryContainer: '#39485a',
    accent: '#adc6ff',
    accentLight: 'rgba(77, 142, 255, 0.14)',

    // Typography Colors (WCAG AA Calibrated)
    textPrimary: '#f8fafc',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    outline: '#8c909f',
    outlineVariant: '#424754',

    // Status Colors & Semantic Badges
    success: '#10b981',
    successLight: 'rgba(16, 185, 129, 0.15)',
    tertiary: '#4edea3',
    tertiaryContainer: '#00a572',
    warning: '#f59e0b',
    warningLight: 'rgba(245, 158, 11, 0.15)',
    danger: '#ef4444',
    dangerContainer: '#93000a',
    dangerLight: 'rgba(239, 68, 68, 0.15)',
    error: '#ffb4ab',
    errorContainer: '#93000a',
  },

  typography: {
    size: {
      xs: 11,
      sm: 13,
      md: 15,
      lg: 17,
      xl: 20,
      xxl: 24,
      title: 28,
    },
    lineHeight: {
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

  radii: {
    xs: 6,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },

  spacing: {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },

  shadows: {
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
