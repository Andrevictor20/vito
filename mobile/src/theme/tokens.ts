import { TextStyle } from 'react-native';

// Google Material Design 3 (M3 / Material You) Design Tokens
// Paleta tonal calibrada para Dark Theme Executivo e Light Theme Vito (vito-telas.html)

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
  // Tokens exatos de vito-telas.html (Light)
  page: '#dde1df',
  bg: '#ffffff',
  surf: '#f2f4f3',
  ink: '#17191b',
  muted: '#69706d',
  line: '#d2d7d4',
  blue: '#2b7fd4',
  blueBg: '#e4effb',
  red: '#d6355a',
  redBg: '#fde6ec',
  purple: '#7a4fe0',
  purpleBg: '#eee8fd',
  acc: '#0b9a5f',
  greenBg: '#ddf4e8',
  orange: '#d9681a',
  orangeBg: '#fbebdb',
  teal: '#0e8f9b',
  tealBg: '#dff3f5',

  // M3 Primary
  primary: '#17191b', // ink
  onPrimary: '#ffffff', // bg
  primaryContainer: '#f2f4f3', // surf
  onPrimaryContainer: '#17191b',
  primaryHover: '#27272a',
  primaryLight: 'rgba(23, 25, 27, 0.08)',
  cobalt: '#17191b',
  cobaltGlow: 'rgba(23, 25, 27, 0.12)',

  // M3 Secondary
  secondary: '#69706d', // muted
  onSecondary: '#ffffff',
  secondaryContainer: '#f2f4f3',
  onSecondaryContainer: '#17191b',

  // M3 Tertiary
  tertiary: '#2b7fd4', // blue
  onTertiary: '#ffffff',
  tertiaryContainer: '#e4effb', // blueBg
  onTertiaryContainer: '#17191b',

  // M3 Surface
  surface: '#ffffff', // bg
  onSurface: '#17191b', // ink
  surfaceVariant: '#f2f4f3', // surf
  onSurfaceVariant: '#69706d', // muted

  // M3 Surface Containers
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#ffffff',
  surfaceContainer: '#f2f4f3',
  surfaceContainerHigh: '#f2f4f3',
  surfaceContainerHighest: '#d2d7d4',
  surfaceDim: '#dde1df',
  surfaceBright: '#ffffff',
  surfaceSubtle: '#f2f4f3',
  surfaceElevated: '#ffffff',
  surfaceGlass: 'rgba(255, 255, 255, 0.85)',
  glassBorder: 'rgba(0, 0, 0, 0.06)',

  // M3 Outlines & Borders
  outline: '#69706d',
  outlineVariant: '#d2d7d4', // line

  // M3 Error
  error: '#d6355a', // red
  onError: '#ffffff',
  errorContainer: '#fde6ec', // redBg
  onErrorContainer: '#d6355a',
  danger: '#d6355a',
  dangerContainer: '#fde6ec',
  dangerLight: 'rgba(214, 53, 90, 0.12)',

  // Custom Utilities
  canvas: '#dde1df',
  success: '#0b9a5f', // acc
  onSuccess: '#ffffff',
  successContainer: '#ddf4e8', // greenBg
  onSuccessContainer: '#0b9a5f',
  successLight: 'rgba(11, 154, 95, 0.12)',
  warning: '#d9681a', // orange
  warningLight: 'rgba(217, 104, 26, 0.12)',
  statusOnline: '#0b9a5f',

  // Custom Background categories
  categoryBirthdayBg: '#fbebdb',
  categoryBirthdayText: '#d9681a',
  categoryPartyBg: '#eee8fd',
  categoryPartyText: '#7a4fe0',
  categoryBbqBg: '#fde6ec',
  categoryBbqText: '#d6355a',

  // Backward compatibility
  textPrimary: '#17191b',
  textSecondary: '#69706d',
  textMuted: '#69706d',
  surfaceBorder: '#d2d7d4',
  structuralBorder: '#d2d7d4',
  accent: '#17191b',
  accentLight: 'rgba(23, 25, 27, 0.08)',
};

export const darkColors = {
  accents: harmonicAccentsDark,
  // Tokens exatos de vito-telas.html (Dark)
  page: '#050606',
  bg: '#0d0f10',
  surf: '#191c1e',
  ink: '#f1f3f2',
  muted: '#98a19d',
  line: '#2c3134',
  blue: '#5aa2ee',
  blueBg: '#16283b',
  red: '#ff6b8a',
  redBg: '#3a1620',
  purple: '#a58bff',
  purpleBg: '#241a42',
  acc: '#34d399',
  greenBg: '#12302a',
  orange: '#ff9a52',
  orangeBg: '#35230f',
  teal: '#3cc4d0',
  tealBg: '#10343a',

  // M3 Primary
  primary: '#f1f3f2', // ink
  onPrimary: '#0d0f10', // bg
  primaryContainer: '#191c1e', // surf
  onPrimaryContainer: '#f1f3f2',
  primaryHover: '#e4e4e7',
  primaryLight: 'rgba(241, 243, 242, 0.08)',
  cobalt: '#f1f3f2',
  cobaltGlow: 'rgba(241, 243, 242, 0.12)',

  // M3 Secondary
  secondary: '#98a19d', // muted
  onSecondary: '#0d0f10',
  secondaryContainer: '#191c1e',
  onSecondaryContainer: '#f1f3f2',

  // M3 Tertiary
  tertiary: '#5aa2ee', // blue
  onTertiary: '#0d0f10',
  tertiaryContainer: '#16283b', // blueBg
  onTertiaryContainer: '#f1f3f2',

  // M3 Surface
  surface: '#0d0f10', // bg
  onSurface: '#f1f3f2', // ink
  surfaceVariant: '#191c1e', // surf
  onSurfaceVariant: '#98a19d', // muted

  // M3 Surface Containers
  surfaceContainerLowest: '#050606',
  surfaceContainerLow: '#0d0f10',
  surfaceContainer: '#191c1e',
  surfaceContainerHigh: '#191c1e',
  surfaceContainerHighest: '#2c3134',
  surfaceDim: '#050606',
  surfaceBright: '#191c1e',
  surfaceSubtle: '#0d0f10',
  surfaceElevated: '#191c1e',
  surfaceGlass: 'rgba(13, 15, 16, 0.85)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',

  // M3 Outlines & Borders
  outline: '#98a19d',
  outlineVariant: '#2c3134', // line

  // M3 Error
  error: '#ff6b8a', // red
  onError: '#3a1620',
  errorContainer: '#3a1620',
  onErrorContainer: '#ff6b8a',
  danger: '#ff6b8a',
  dangerContainer: '#3a1620',
  dangerLight: 'rgba(255, 107, 138, 0.16)',

  // Custom Utilities
  canvas: '#050606',
  success: '#34d399', // acc
  onSuccess: '#12302a',
  successContainer: '#12302a',
  onSuccessContainer: '#34d399',
  successLight: 'rgba(52, 211, 153, 0.16)',
  warning: '#ff9a52', // orange
  warningLight: 'rgba(255, 154, 82, 0.16)',
  statusOnline: '#34d399',

  // Custom Background categories
  categoryBirthdayBg: '#35230f',
  categoryBirthdayText: '#ff9a52',
  categoryPartyBg: '#241a42',
  categoryPartyText: '#a58bff',
  categoryBbqBg: '#3a1620',
  categoryBbqText: '#ff6b8a',

  // Backward compatibility
  textPrimary: '#f1f3f2',
  textSecondary: '#98a19d',
  textMuted: '#98a19d',
  surfaceBorder: '#2c3134',
  structuralBorder: '#2c3134',
  accent: '#f1f3f2',
  accentLight: 'rgba(241, 243, 242, 0.12)',
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
      montserratBold: 'Montserrat_800ExtraBold',
      montserratSemiBold: 'Montserrat_600SemiBold',
      interBold: 'Inter_700Bold',
      interExtraBold: 'Inter_800ExtraBold',
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
    letterSpacing: {
      displayLarge: -0.5,
      displayMedium: -0.4,
      displaySmall: -0.3,
      headlineLarge: -0.4,
      headlineMedium: -0.3,
      headlineSmall: -0.2,
      titleLarge: -0.3,
      titleMedium: -0.2,
      titleSmall: -0.1,
      bodyLarge: -0.1,
      bodyMedium: 0,
      bodySmall: 0.1,
      labelLarge: 0.15,
      labelMedium: 0.25,
      labelSmall: 0.35,
    },
    titleSmall: {
      fontSize: 14,
      lineHeight: 20,
    },
    titleMedium: {
      fontSize: 16,
      lineHeight: 24,
    },
    bodySmall: {
      fontSize: 12,
      lineHeight: 16,
    },
    bodyMedium: {
      fontSize: 14,
      lineHeight: 20,
    },
  },

  // 3. Escala de Shapes do Material 3 — Design System: sm8/md14/lg20/full
  shapes: {
    none: MD3Shapes.none,
    xs: MD3Shapes.extraSmall,
    sm: 8,
    md: 14,
    lg: 20,
    xl: MD3Shapes.extraLarge,
    full: MD3Shapes.full,
    extraSmall: MD3Shapes.extraSmall,
    small: MD3Shapes.small,
    medium: MD3Shapes.medium,
    large: MD3Shapes.large,
    largeIncreased: MD3Shapes.largeIncreased,
    extraLarge: MD3Shapes.extraLarge,
  },
  radii: {
    none: MD3Shapes.none,
    xs: MD3Shapes.extraSmall,
    sm: 8,
    md: 14,
    lg: 20,
    xl: MD3Shapes.extraLarge,
    full: MD3Shapes.full,
    extraSmall: MD3Shapes.extraSmall,
    small: MD3Shapes.small,
    medium: MD3Shapes.medium,
    large: MD3Shapes.large,
    largeIncreased: MD3Shapes.largeIncreased,
    extraLarge: MD3Shapes.extraLarge,
  },

  // 4. Espaçamentos M3 (Grid de 4dp / 8dp)
  spacing: {
    '2xs': 2,
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
      shadowOpacity: 0.04,
      shadowRadius: 8,
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

  // 7. Booking / Agendamento — Cards Compactos Padronizados
  booking: {
    cardPadding: 12,
    cardGap: 8,
    sectionGap: 6,
    actionHeight: 32,
    iconSize: 14,
    titleSize: 14,
    metaSize: 11,
    statusPillHeight: 20,
    statusPillRadius: 6,
    avatarSize: 32,
    dividerOpacity: 0.08,
  },
};

export const getThemeTokens = (isDark: boolean) => ({
  ...tokens,
  colors: isDark ? darkColors : lightColors,
});

export type ThemeTokens = ReturnType<typeof getThemeTokens>;

export const tabularNumbers: TextStyle = {
  fontVariant: ['tabular-nums'],
};

export const BOTTOM_NAV_CLEARANCE = 100;
