import React, { useMemo } from 'react'
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native'
import { useTheme } from '../../context/ThemeContext'

export interface GradientOverlayProps {
  height?: number
  isDark?: boolean
  opacity?: number
  pointerEvents?: 'none' | 'box-none' | 'box-only' | 'auto'
  style?: ViewStyle
}

/**
 * Sobreposição de degradê JS-puro (sem expo-linear-gradient).
 * Simula transparente → opaco nos primeiros 22% da altura usando
 * múltiplas camadas com opacidade decrescente.
 */
export const GradientOverlay: React.FC<GradientOverlayProps> = ({
  height,
  isDark = false,
  opacity = 0.9,
  pointerEvents,
  style,
}) => {
  const { colors } = useTheme()
  const bgColor = isDark ? colors.surfaceContainerLowest : colors.surface

  const layers = useMemo(() => {
    const count = 6
    return Array.from({ length: count }, (_, i) => {
      const layerOpacity = (opacity * (i + 1)) / count
      return (
        <Animated.View
          key={i}
          style={[
            styles.layer,
            {
              height: height ? height / count : undefined,
              backgroundColor: bgColor,
              opacity: layerOpacity,
            },
          ]}
        />
      )
    })
  }, [bgColor, height, opacity])

  return (
    <View style={[styles.container, style]} pointerEvents={pointerEvents}>
      {layers}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
  },
  layer: {
    width: '100%',
  },
})
