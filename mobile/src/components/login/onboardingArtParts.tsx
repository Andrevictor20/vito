import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import Reanimated, {
  Easing as ReanimatedEasing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  interpolateColor,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import type { LoginPalette } from './loginPalette'
import { CheckIcon } from './DemoIcons'
import { getBezier } from '../../ds/tokens'
import {
  ONBOARDING_FADE_DELAY_MS,
  ONBOARDING_FADE_MS,
  ONBOARDING_IN_MS,
} from './onboardingMotion'

export const EASE_Q = Easing.bezier(...getBezier('--ease-q'))
const EASE_IO = Easing.inOut(Easing.ease)

/** obIn: translateX 26 + scale .96 + fade, visível só no slide ativo. */
export const EnterItem: React.FC<{
  active: boolean
  reduceMotion: boolean
  delay?: number
  style?: StyleProp<ViewStyle>
  children: React.ReactNode
}> = ({ active, reduceMotion, delay = 0, style, children }) => {
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    v.setValue(0)
    if (!active) return
    if (reduceMotion) {
      v.setValue(1)
      return
    }
    const a = Animated.timing(v, {
      toValue: 1,
      duration: ONBOARDING_IN_MS,
      delay,
      easing: EASE_Q,
      useNativeDriver: true,
    })
    a.start()
    return () => a.stop()
  }, [active, reduceMotion, delay, v])
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [
            { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) },
            { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  )
}

/** obFloat (loop, com fase inicial) + obFade opcional. */
export const Floaty: React.FC<{
  active: boolean
  reduceMotion: boolean
  ms: number
  phase?: number
  fade?: boolean
  style?: StyleProp<ViewStyle>
  children?: React.ReactNode
}> = ({ active, reduceMotion, ms, phase = 0, fade = false, style, children }) => {
  const f = useRef(new Animated.Value(phase)).current
  const o = useRef(new Animated.Value(fade ? 0 : 1)).current
  useEffect(() => {
    f.setValue(phase)
    if (fade) o.setValue(0)
    if (!active || reduceMotion) {
      if (fade && active) o.setValue(1)
      return
    }
    const loop = Animated.sequence([
      Animated.timing(f, { toValue: 1, duration: (1 - phase) * ms, easing: Easing.linear, useNativeDriver: true }),
      Animated.loop(
        Animated.timing(f, { toValue: 1, duration: ms, easing: Easing.linear, useNativeDriver: true }),
        { resetBeforeIteration: true },
      ),
    ])
    loop.start()
    const fadeIn = fade
      ? Animated.timing(o, {
          toValue: 1,
          duration: ONBOARDING_FADE_MS,
          delay: ONBOARDING_FADE_DELAY_MS,
          useNativeDriver: true,
        })
      : null
    fadeIn?.start()
    return () => {
      loop.stop()
      fadeIn?.stop()
    }
  }, [active, reduceMotion, ms, phase, fade, f, o])
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        style,
        {
          opacity: o,
          transform: [
            {
              translateY: f.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, -10, 0],
                easing: EASE_IO,
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  )
}

/** obPulse: scale 1 -> 1.4 e opacity 1 -> .55 em 1.8s (900ms ida + 900ms volta). */
export function usePulse(active: boolean, reduceMotion: boolean) {
  const p = useRef(new Animated.Value(0)).current
  useEffect(() => {
    p.setValue(0)
    if (!active || reduceMotion) return
    const l = Animated.loop(
      Animated.sequence([
        Animated.timing(p, { toValue: 1, duration: 900, easing: EASE_IO, useNativeDriver: true }),
        Animated.timing(p, { toValue: 0, duration: 900, easing: EASE_IO, useNativeDriver: true }),
      ]),
    )
    l.start()
    return () => l.stop()
  }, [active, reduceMotion, p])
  return {
    opacity: p.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }),
    transform: [
      { scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] }) },
    ],
  }
}

/** obCk / obCkI / obStr: ciclo de 4.2s com atraso inicial de 1.6s (Reanimated 4 UI thread). */
export const TaskRow: React.FC<{ active: boolean; reduceMotion: boolean; palette: LoginPalette }> = ({
  active,
  reduceMotion,
  palette,
}) => {
  const p = useSharedValue(0)
  const [done, setDone] = useState(false)

  useAnimatedReaction(
    () => p.value >= 0.45 && p.value < 0.85,
    (curr, prev) => {
      if (curr !== prev) {
        scheduleOnRN(setDone, curr)
      }
    },
  )

  useEffect(() => {
    cancelAnimation(p)
    p.value = 0
    if (!active || reduceMotion) {
      setDone(false)
      return
    }
    p.value = withDelay(
      1600,
      withRepeat(withTiming(1, { duration: 4200, easing: ReanimatedEasing.linear }), -1, false),
    )
    return () => cancelAnimation(p)
  }, [active, reduceMotion, p])

  const checkBoxStyle = useAnimatedStyle(() => {
    const v = p.value
    const range = [0, 0.25, 0.45, 0.85, 1]
    return {
      borderColor: interpolateColor(v, range, [
        palette.muted,
        palette.muted,
        palette.purple,
        palette.purple,
        palette.muted,
      ]),
      backgroundColor: interpolateColor(v, range, [
        `${palette.purple}00`,
        `${palette.purple}00`,
        palette.purple,
        palette.purple,
        `${palette.purple}00`,
      ]),
      transform: [
        {
          scale: interpolate(
            v,
            [0, 0.25, 0.35, 0.45, 1],
            [1, 1, 1.2, 1, 1],
            Extrapolation.CLAMP,
          ),
        },
      ],
    }
  }, [palette.muted, palette.purple])

  const checkIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.3, 0.45, 0.85, 1], [0, 0, 1, 1, 0], Extrapolation.CLAMP),
  }))

  return (
    <View style={[styles.taskRow, { backgroundColor: palette.surf }]}>
      <Reanimated.View style={[styles.taskCheck, checkBoxStyle]}>
        <Reanimated.View style={checkIconStyle}>
          <CheckIcon color="#ffffff" size={12} />
        </Reanimated.View>
      </Reanimated.View>
      <Text
        style={[
          styles.taskLabel,
          {
            color: done ? palette.muted : palette.ink,
            textDecorationLine: done ? 'line-through' : 'none',
          },
        ]}
      >
        Enviar pauta da sprint
      </Text>
    </View>
  )
}

/** obBar: cada barra cresce de baixo (700ms, atraso .35s + i*70ms). */
export const Bar: React.FC<{ active: boolean; reduceMotion: boolean; idx: number; pct: number; color: string }> = ({
  active,
  reduceMotion,
  idx,
  pct,
  color,
}) => {
  const target = (84 * pct) / 100
  const k = useRef(new Animated.Value(0)).current
  useEffect(() => {
    k.setValue(0)
    if (!active) return
    if (reduceMotion) {
      k.setValue(1)
      return
    }
    const a = Animated.sequence([
      Animated.delay(350 + idx * 70),
      Animated.timing(k, {
        toValue: 1,
        duration: 700,
        easing: EASE_Q,
        useNativeDriver: true,
      }),
    ])
    a.start()
    return () => a.stop()
  }, [active, reduceMotion, idx, k])
  // scaleY com origem na base (transform-origin: bottom), 100% no driver nativo.
  return (
    <Animated.View
      style={[
        styles.barItem,
        {
          height: target,
          backgroundColor: color,
          transform: [
            { translateY: k.interpolate({ inputRange: [0, 1], outputRange: [target / 2, 0] }) },
            { scaleY: k },
          ],
        },
      ]}
    />
  )
}

const styles = StyleSheet.create({
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 16,
  } as ViewStyle,
  taskCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  taskLabel: {
    fontFamily: 'Geist_500Medium',
    fontSize: 15,
  } as TextStyle,
  barItem: {
    flex: 1,
    borderRadius: 6,
  } as ViewStyle,
})
