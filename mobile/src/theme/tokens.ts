// Google Material Design 3 (M3 / Material You) Design Tokens
// Paleta tonal calibrada para Dark Theme Executivo (WCAG AA)

export const MD3Shapes = {
  none: 0,
  extraSmall: 4,      // Badges pequenos, tags de prioridade
  small: 8,           // Chips de filtro, caixas de seleção
  medium: 12,         // Cards de tarefas, alertas inline
  large: 16,          // Cards secundários, balões de chat
  largeIncreased: 20, // Quick Action Tiles, cards principais de eventos
  extraLarge: 28,     // Bottom sheets, Search Bars, Modais principais, Input Dock
  full: 9999,         // Pílulas de navegação, botões circulares, avatares
};

export const harmonicAccentsLight = {
  emerald: '#059669',
  emeraldContainer: '#D1FAE5',
  emeraldText: '#065F46',
  sky: '#0284C7',
  skyContainer: '#E0F2FE',
  skyText: '#075985',
  indigo: '#4F46E5',
  indigoContainer: '#EEF2FF',
  indigoText: '#3730A3',
  coral: '#E11D48',
  coralContainer: '#FFE4E6',
  coralText: '#9F1239',
  amber: '#D97706',
  amberContainer: '#FEF3C7',
  amberText: '#92400E',
  mint: '#0D9488',
  mintContainer: '#CCFBF1',
  mintText: '#115E59',
  orange: '#EA580C',
  orangeContainer: '#FFEDD5',
  orangeText: '#9A3412',
  violet: '#7C3AED',
  violetContainer: '#F3E8FF',
  violetText: '#5B21B6',
};

export const harmonicAccentsDark = {
  emerald: '#34D399',
  emeraldContainer: 'rgba(52, 211, 153, 0.16)',
  emeraldText: '#A7F3D0',
  sky: '#38BDF8',
  skyContainer: 'rgba(56, 189, 248, 0.16)',
  skyText: '#BAE6FD',
  indigo: '#818CF8',
  indigoContainer: 'rgba(129, 140, 248, 0.16)',
  indigoText: '#C7D2FE',
  coral: '#FB7185',
  coralContainer: 'rgba(251, 113, 133, 0.16)',
  coralText: '#FECDD3',
  amber: '#FBBF24',
  amberContainer: 'rgba(251, 191, 36, 0.16)',
  amberText: '#FDE68A',
  mint: '#2DD4BF',
  mintContainer: 'rgba(45, 212, 191, 0.16)',
  mintText: '#99F6E4',
  orange: '#FB923C',
  orangeContainer: 'rgba(251, 146, 60, 0.16)',
  orangeText: '#FED7AA',
  violet: '#A78BFA',
  violetContainer: 'rgba(167, 139, 250, 0.16)',
  violetText: '#DDD6FE',
};

export const lightColors = {
  accents: harmonicAccentsLight,
  // M3 Primary
  primary: '#18181B', // Zinc 900
  onPrimary: '#FFFFFF',
  primaryContainer: '#E4E4E7', // Zinc 200
  onPrimaryContainer: '#09090B',
  primaryHover: '#27272A',
  primaryLight: 'rgba(24, 24, 27, 0.08)',
  cobalt: '#18181B',
  cobaltGlow: 'rgba(24, 24, 27, 0.12)',

  // M3 Secondary
  secondary: '#52525B', // Zinc 600
  onSecondary: '#FFFFFF',
  secondaryContainer: '#F4F4F5', // Zinc 100
  onSecondaryContainer: '#18181B',

  // M3 Tertiary
  tertiary: '#27272A',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#E4E4E7',
  onTertiaryContainer: '#09090B',

  // M3 Surface
  surface: '#FFFFFF',
  onSurface: '#09090B',
  surfaceVariant: '#F4F4F5',
  onSurfaceVariant: '#52525B',

  // M3 Surface Containers
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#FAFAFA',
  surfaceContainer: '#F4F4F5',
  surfaceContainerHigh: '#E4E4E7',
  surfaceContainerHighest: '#D4D4D8',
  surfaceDim: '#F4F4F5',
  surfaceBright: '#FFFFFF',
  surfaceSubtle: '#FAFAFA',
  surfaceElevated: '#FFFFFF',

  // M3 Outlines & Borders
  outline: '#71717A',
  outlineVariant: '#E4E4E7',

  // M3 Error
  error: '#EF4444',
  onError: '#FFFFFF',
  errorContainer: '#FEE2E2',
  onErrorContainer: '#7F1D1D',
  danger: '#EF4444',
  dangerContainer: '#FEE2E2',
  dangerLight: 'rgba(239, 68, 68, 0.12)',

  // Custom Premium Utilities
  bg: '#FFFFFF', // alias to surface
  canvas: '#FAFAFA',
  success: '#10B981',
  onSuccess: '#FFFFFF',
  successContainer: '#D1FAE5',
  onSuccessContainer: '#064E3B',
  successLight: 'rgba(16, 185, 129, 0.12)',
  warning: '#F59E0B',
  warningLight: 'rgba(245, 158, 11, 0.12)',
  statusOnline: '#10B981',
  
  // Custom Background categories
  categoryBirthdayBg: '#FEF3C7',
  categoryBirthdayText: '#92400E',
  categoryPartyBg: '#E0E7FF',
  categoryPartyText: '#3730A3',
  categoryBbqBg: '#FEE2E2',
  categoryBbqText: '#991B1B',
  
  // Backward compatibility (to be removed gradually)
  textPrimary: '#09090B',
  textSecondary: '#52525B',
  textMuted: '#A1A1AA',
  surfaceBorder: '#E4E4E7',
  structuralBorder: '#D4D4D8',
  accent: '#18181B',
  accentLight: 'rgba(24, 24, 27, 0.08)',
};

export const darkColors = {
  accents: harmonicAccentsDark,
  // M3 Primary
  primary: '#FFFFFF',
  onPrimary: '#09090B',
  primaryContainer: '#27272A',
  onPrimaryContainer: '#FAFAFA',
  primaryHover: '#E4E4E7',
  primaryLight: 'rgba(255, 255, 255, 0.08)',
  cobalt: '#FFFFFF',
  cobaltGlow: 'rgba(255, 255, 255, 0.12)',

  // M3 Secondary
  secondary: '#A1A1AA',
  onSecondary: '#09090B',
  secondaryContainer: '#27272A',
  onSecondaryContainer: '#FAFAFA',

  // M3 Tertiary
  tertiary: '#E4E4E7',
  onTertiary: '#09090B',
  tertiaryContainer: '#27272A',
  onTertiaryContainer: '#FAFAFA',

  // M3 Surface
  surface: '#09090B', // Zinc 950
  onSurface: '#FAFAFA',
  surfaceVariant: '#18181B', // Zinc 900
  onSurfaceVariant: '#A1A1AA',

  // M3 Surface Containers
  surfaceContainerLowest: '#000000',
  surfaceContainerLow: '#09090B',
  surfaceContainer: '#18181B',
  surfaceContainerHigh: '#27272A',
  surfaceContainerHighest: '#3F3F46',
  surfaceDim: '#09090B',
  surfaceBright: '#27272A',
  surfaceSubtle: '#18181B',
  surfaceElevated: '#27272A',

  // M3 Outlines & Borders
  outline: '#71717A',
  outlineVariant: '#27272A',

  // M3 Error
  error: '#F87171',
  onError: '#450A0A',
  errorContainer: '#7F1D1D',
  onErrorContainer: '#FEE2E2',
  danger: '#F87171',
  dangerContainer: '#7F1D1D',
  dangerLight: 'rgba(248, 113, 113, 0.16)',

  // Custom Premium Utilities
  bg: '#09090B',
  canvas: '#000000',
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

  textPrimary: '#FAFAFA',
  textSecondary: '#A1A1AA',
  textMuted: '#52525B',
  surfaceBorder: '#27272A',
  structuralBorder: '#3F3F46',
  accent: '#FAFAFA',
  accentLight: 'rgba(250, 250, 250, 0.12)',
};

export type ThemeColors = typeof lightColors;

export const tokens = {
  // 1. Paleta Tonal Ativa (inicializada com Light)
  colors: { ...lightColors },

  // 2. Escala Tipográfica Material Design 3
  typography: {
    family: {
      regular: 'Inter_400Regular',
      medium: 'Inter_500Medium',
      semibold: 'Inter_600SemiBold',
      bold: 'Inter_700Bold',
    },
    size: {
      displayLarge: 57,
      displayMedium: 45,
      displaySmall: 36,
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
      displayLarge: 64,
      displayMedium: 52,
      displaySmall: 44,
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
    largeIncreased: MD3Shapes.largeIncreased,
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
      shadowRadius: 8,
      elevation: 6,
    },
    level4: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.30,
      shadowRadius: 10,
      elevation: 8,
    },
    level5: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.30,
      shadowRadius: 14,
      elevation: 12,
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
