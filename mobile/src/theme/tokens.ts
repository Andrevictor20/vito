export const tokens = {
  colors: {
    // Executive Slate Surfaces (Stitch Dark Theme)
    bg: '#121315',
    surface: '#1f2022',
    surfaceSubtle: '#1b1c1e',
    surfaceElevated: '#292a2c',
    surfaceContainerHighest: '#343537',
    surfaceBorder: '#2e3035',

    // Executive Slate Primary & Accents
    primary: '#adc6ff',
    primaryContainer: '#4d8eff',
    primaryHover: '#3b82f6',
    primaryLight: 'rgba(173, 198, 255, 0.12)',

    // Accents & Secondary
    secondary: '#b9c8de',
    secondaryContainer: '#39485a',
    accent: '#adc6ff',
    accentLight: 'rgba(77, 142, 255, 0.14)',

    // Typography Colors (WCAG AA Calibrated)
    textPrimary: '#e3e2e5',
    textSecondary: '#c2c6d6',
    textMuted: '#9aa0a6',
    outline: '#8c909f',

    // Status Colors & Semantic Badges
    success: '#4edea3',
    successLight: 'rgba(78, 222, 163, 0.15)',
    tertiaryContainer: '#00a572',
    warning: '#fcd34d',
    warningLight: 'rgba(252, 211, 77, 0.15)',
    danger: '#ffb4ab',
    dangerContainer: '#93000a',
    dangerLight: 'rgba(255, 180, 171, 0.15)',
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
