export const tokens = {
  colors: {
    // Background & Surfaces (Off-black matizado, sem preto absoluto #000000)
    bg: '#0A0B0D',
    surface: '#13151A',
    surfaceSubtle: '#1B1E26',
    surfaceElevated: '#222731',
    surfaceBorder: '#272E3B',

    // Brand & Primary (Cobalt Blue sutil de alta precisão)
    primary: '#3B82F6',
    primaryHover: '#2563EB',
    primaryLight: 'rgba(59, 130, 246, 0.12)',

    // Accents
    accent: '#06B6D4',
    accentLight: 'rgba(6, 182, 212, 0.12)',

    // Typography Colors
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',

    // Status Colors & Badges
    success: '#10B981',
    successLight: 'rgba(16, 185, 129, 0.12)',
    warning: '#F59E0B',
    warningLight: 'rgba(245, 158, 11, 0.12)',
    danger: '#EF4444',
    dangerLight: 'rgba(239, 68, 68, 0.12)',
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
