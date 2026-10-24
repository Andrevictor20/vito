import React from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
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
 * Implementado com `react-native-svg` (nativo no APK 0.1.16, sem depender de
 * `expo-linear-gradient`), reproduzindo exatamente a rampa linear de 22% da altura do `.feed`
 * (`mask-image: linear-gradient(transparent, #000 22%)`) de `login-vito.html`:
 * o topo começa em `stopOpacity="1"` na cor de fundo (`palette.bg`) logo abaixo do título
 * e desce linearmente até `stopOpacity="0"`.
 */
export const GradientOverlay: React.FC<GradientOverlayProps> = ({
  height = 96,
  isDark: propIsDark,
  pointerEvents = 'none',
  style,
}) => {
  const { isDark: themeIsDark } = useTheme()
  const isDark = propIsDark ?? themeIsDark
  const palette = loginPalette(isDark)
  const bg = palette.bg

  return (
    <View
      pointerEvents={pointerEvents}
      style={[styles.overlay, { height }, style]}
    >
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="vitoLoginTopFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={bg} stopOpacity="1" />
            <Stop offset="35%" stopColor={bg} stopOpacity="0.65" />
            <Stop offset="70%" stopColor={bg} stopOpacity="0.25" />
            <Stop offset="100%" stopColor={bg} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="url(#vitoLoginTopFade)"
        />
      </Svg>
    </View>
  )
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
