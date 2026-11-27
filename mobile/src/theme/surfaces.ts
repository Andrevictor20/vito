import type { ViewStyle } from 'react-native';
import { darkColors, lightColors, v5Radii } from './tokens';

/**
 * surfaces.ts — Superfícies glassmorphism e sombras flutuantes v5.
 * Alinhado a DESIGN.md e Vito-telas-atualizadas.html.
 */

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
