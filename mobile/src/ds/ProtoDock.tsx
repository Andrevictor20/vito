import React, { useEffect } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { getBezier, resolveRule, token } from './tokens'

export interface ProtoDockItem {
  id: string
  label: string
  badge?: number
  renderIcon: (active: boolean, color: string) => React.ReactNode
}

export interface ProtoDockProps {
  items: ProtoDockItem[]
  activeId: string
  hidden?: boolean
  isDark?: boolean
  onSelect: (id: string) => void
}

/**
 * `.dock` + `.nav` do protótipo (linhas 160, 167, 984, 1073, 1111, 1112, 1246).
 * Gradiente transparente→--bg em 36% + pílula flutuante glass + transição `.dock.off` na UI thread (Reanimated 4).
 */
export const ProtoDock: React.FC<ProtoDockProps> = ({
  items,
  activeId,
  hidden = false,
  isDark = false,
  onSelect,
}) => {
  const insets = useSafeAreaInsets()
  const anim = useSharedValue(hidden ? 0 : 1)

  useEffect(() => {
    const [x1, y1, x2, y2] = getBezier(hidden ? '--ease-in' : '--ease-q')
    anim.value = withTiming(hidden ? 0 : 1, {
      duration: hidden ? 280 : 420,
      easing: Easing.bezier(x1, y1, x2, y2),
    })
  }, [hidden, anim])

  const dockAnimatedStyle = useAnimatedStyle(() => ({
    opacity: anim.value,
    transform: [
      {
        translateY: interpolate(anim.value, [0, 1], [28, 0], Extrapolation.CLAMP),
      },
    ],
  }))

  const bg = token('--bg', isDark)
  const ink = token('--ink', isDark)
  const muted = token('--muted', isDark)
  const navRule = resolveRule('.nav', isDark).style
  const navGlassBg = isDark ? 'rgba(24, 24, 26, 0.78)' : 'rgba(244, 244, 244, 0.80)'
  const navGlassBorder = isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(10, 10, 10, 0.08)'

  return (
    <Animated.View
      pointerEvents={hidden ? 'none' : 'box-none'}
      style={[
        styles.dock,
        { paddingBottom: 8 + insets.bottom },
        dockAnimatedStyle,
      ]}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="protoDockBg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={bg} stopOpacity="0" />
              <Stop offset="0.36" stopColor={bg} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#protoDockBg)" />
        </Svg>
      </View>

      <View
        style={[
          styles.nav,
          navRule,
          {
            backgroundColor: navGlassBg,
            borderWidth: 1,
            borderColor: navGlassBorder,
          },
        ]}
      >
        {items.map((item) => {
          const active = item.id === activeId
          const color = active ? ink : muted
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => onSelect(item.id)}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              style={styles.navBtn}
            >
              {item.renderIcon(active, color)}
            </TouchableOpacity>
          )
        })}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 40,
    marginTop: 6,
    marginBottom: 2,
  },
  navBtn: {
    width: 48,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
