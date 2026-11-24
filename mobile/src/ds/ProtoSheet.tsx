import React, { useEffect, useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getBezier, resolveRule, token } from './tokens'

export interface ProtoSheetProps {
  visible: boolean
  onClose: () => void
  isDark?: boolean
  style?: StyleProp<ViewStyle>
  children: React.ReactNode
}

/**
 * `.sheet2` do protótipo (linha 511 + 1140) na UI thread (Reanimated 4):
 * raio topo 28, padding 8 20 (20 + safe-b), max-height 94%, scrim rgba(0,0,0,.4),
 * entrada .46s --ease-q / saída .3s --ease-in, alça 38x4.
 */
export const ProtoSheet: React.FC<ProtoSheetProps> = ({
  visible,
  onClose,
  isDark = false,
  style,
  children,
}) => {
  const insets = useSafeAreaInsets()
  const [mounted, setMounted] = useState(visible)
  const anim = useSharedValue(visible ? 1 : 0)

  useEffect(() => {
    if (visible) {
      setMounted(true)
      const [x1, y1, x2, y2] = getBezier('--ease-q')
      anim.value = withTiming(1, {
        duration: 460,
        easing: Easing.bezier(x1, y1, x2, y2),
      })
      return
    }
    if (!mounted) return
    const [x1, y1, x2, y2] = getBezier('--ease-in')
    anim.value = withTiming(
      0,
      {
        duration: 300,
        easing: Easing.bezier(x1, y1, x2, y2),
      },
      (finished) => {
        if (finished) {
          scheduleOnRN(setMounted, false)
        }
      },
    )
  }, [visible, mounted, anim])

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: anim.value,
  }))

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(anim.value, [0, 1], [520, 0], Extrapolation.CLAMP),
      },
    ],
  }))

  if (!mounted) return null

  const rule = resolveRule('.sheet2', isDark).style as ViewStyle
  const bg = token('--bg', isDark)
  const line = token('--line', isDark)

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.scrim, scrimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            rule,
            styles.sheet,
            {
              backgroundColor: bg,
              paddingBottom: 20 + insets.bottom,
            },
            sheetStyle,
            style,
          ]}
        >
          <Pressable onPress={onClose} style={styles.handleHit} accessibilityLabel="Fechar">
            <View style={[styles.handle, { backgroundColor: line }]} />
          </Pressable>
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    maxHeight: '94%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    paddingHorizontal: 20,
  },
  handleHit: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
  },
})
