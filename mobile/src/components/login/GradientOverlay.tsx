import React from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '../../context/ThemeContext'
import { loginPalette } from './loginPalette'

export interface GradientOverlayProps {
  height?: number
  isDark?: boolean
  pointerEvents?: 'none' | 'box-none' | 'box-only' | 'auto'
  style?: StyleProp<ViewStyle>
}

/**
 * Sobreposição de degradê suave no topo do palco de demonstração.
 * Em paridade com login-vito.html:
 * .feed{ -webkit-mask-image: linear-gradient(transparent, #000 22%); mask-image: linear-gradient(transparent, #000 22%) }
 * O topo é 100% opaco na cor do fundo (palette.bg) e vai suavemente até transparente,
 * fazendo com que as mensagens que sobem desapareçam gradualmente de forma fluida.
 */
export const GradientOverlay: React.FC<GradientOverlayProps> = ({
  height = 90,
  isDark: propIsDark,
  pointerEvents = 'none',
  style,
}) => {
  const { isDark: themeIsDark } = useTheme()
  const isDark = propIsDark ?? themeIsDark
  const palette = loginPalette(isDark)

  const bg = palette.bg

  // Degradê suave multi-stop a partir da cor de fundo exata
  const colors = [
    bg,
    hexToRgba(bg, 0.98),
    hexToRgba(bg, 0.9),
    hexToRgba(bg, 0.72),
    hexToRgba(bg, 0.45),
    hexToRgba(bg, 0.18),
    'transparent',
  ] as const

  const locations = [0, 0.2, 0.4, 0.6, 0.8, 0.92, 1] as const

  return (
    <LinearGradient
      colors={colors}
      locations={locations}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      pointerEvents={pointerEvents}
      style={[
        styles.overlay,
        { height },
        style,
      ]}
    />
  )
}

function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace('#', '')
  let r = 255
  let g = 255
  let b = 255
  if (cleanHex.length === 6) {
    r = parseInt(cleanHex.substring(0, 2), 16)
    g = parseInt(cleanHex.substring(2, 4), 16)
    b = parseInt(cleanHex.substring(4, 6), 16)
  } else if (cleanHex.length === 3) {
    r = parseInt(cleanHex.charAt(0) + cleanHex.charAt(0), 16)
    g = parseInt(cleanHex.charAt(1) + cleanHex.charAt(1), 16)
    b = parseInt(cleanHex.charAt(2) + cleanHex.charAt(2), 16)
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  } as ViewStyle,
})
