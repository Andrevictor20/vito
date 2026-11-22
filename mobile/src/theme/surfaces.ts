import type { TextStyle, ViewStyle } from 'react-native';
import { darkColors, lightColors, v5Radii } from './tokens';

/**
 * surfaces.ts — Escala tipográfica v5, superfícies hairline e glassmorphism.
 * Alinhado a DESIGN.md §4.1–4.3 e Vito-telas-atualizadas.html.
 */

export const v5Typography: Record<string, TextStyle> = {
  displayHero40: {
    fontFamily: 'Geist',
    fontWeight: '500',
    fontSize: 40,
    lineHeight: 40,
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
  },
  displayBalance34: {
    fontFamily: 'Geist',
    fontWeight: '500',
    fontSize: 34,
    lineHeight: 34,
    letterSpacing: -1.02,
    fontVariant: ['tabular-nums'],
  },
  titleH1: {
    fontFamily: 'Geist',
    fontWeight: '500',
    fontSize: 30,
    lineHeight: 33,
    letterSpacing: -1.05,
  },
  subScreenH1: {
    fontFamily: 'Geist',
    fontWeight: '500',
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.78,
  },
  drawerH2: {
    fontFamily: 'Geist',
    fontWeight: '500',
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.48,
  },
  sheetH2: {
    fontFamily: 'Geist',
    fontWeight: '500',
    fontSize: 22,
    lineHeight: 27.5,
    letterSpacing: -0.44,
  },
  sectionH2: {
    fontFamily: 'Geist',
    fontWeight: '500',
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.34,
  },
  bodyStrong: {
    fontFamily: 'Geist',
    fontWeight: '500',
    fontSize: 15.5,
    lineHeight: 21,
    letterSpacing: -0.08,
  },
  body: {
    fontFamily: 'Geist',
    fontWeight: '400',
    fontSize: 15,
    lineHeight: 21.75,
    letterSpacing: -0.075,
  },
  sub: {
    fontFamily: 'Geist',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
  },
  caption: {
    fontFamily: 'Geist',
    fontWeight: '500',
    fontSize: 13,
    lineHeight: 17.5,
  },
  meta: {
    fontFamily: 'Geist',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 16,
  },
  monoKey: {
    fontFamily: 'Geist Mono',
    fontWeight: '400',
    fontSize: 12.5,
    lineHeight: 17.5,
    fontVariant: ['tabular-nums'],
  },
};

export function getCardHairlineStyle(isDark: boolean): ViewStyle {
  const palette = isDark ? darkColors : lightColors;
  return {
    backgroundColor: palette.surf,
    borderRadius: v5Radii.card,
    borderWidth: 1,
    borderColor: palette.hairline,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: isDark ? 2 : 1 },
    shadowOpacity: isDark ? 0.22 : 0.025,
    shadowRadius: isDark ? 10 : 2,
    elevation: isDark ? 2 : 1,
  };
}

export function getFloatingSurfaceShadow(isDark: boolean): ViewStyle {
  return {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.7 : 0.08,
    shadowRadius: 24,
    elevation: isDark ? 8 : 4,
  };
}

export function getDockGlassStyle(isDark: boolean): ViewStyle {
  const palette = isDark ? darkColors : lightColors;
  return {
    backgroundColor: palette.surfaceGlass,
    borderRadius: v5Radii.dock,
    borderWidth: 1,
    borderColor: palette.glassBorder,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: isDark ? 12 : 10 },
    shadowOpacity: isDark ? 0.55 : 0.11,
    shadowRadius: isDark ? 36 : 32,
    elevation: isDark ? 12 : 8,
  };
}

export function getSbarGlassStyle(isDark: boolean): ViewStyle {
  const palette = isDark ? darkColors : lightColors;
  return {
    backgroundColor: palette.headerGlass,
    borderBottomWidth: 1,
    borderBottomColor: palette.hairline,
  };
}
