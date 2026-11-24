import React, { useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useTheme } from '../context/ThemeContext'
import { getBezier, token } from '../ds/tokens'
import { MascotVectorRig } from '../components/mascot/MascotVectorRig'
import {
  SPLASH_BAR_FILL_RATIO,
  SPLASH_BAR_HEIGHT,
  SPLASH_BAR_IN_DELAY_MS,
  SPLASH_BAR_LOOP_MS,
  SPLASH_BAR_WIDTH,
  SPLASH_IN_MS,
  SPLASH_MASCOT_SIZE,
  SPLASH_OUT_DELAY_MS,
  SPLASH_OUT_MS,
  SPLASH_OUT_SCALE,
  SPLASH_POP_MS,
  SPLASH_WORD_DELAY_MS,
  SPLASH_WORD_SIZE,
} from '../components/login/splashMotion'

export interface SplashScreenProps {
  /** Chamado quando a animacao de entrada/saida do splash conclui (se autoDismiss=true). */
  onFinish?: () => void
  /** Quando true, encerra o splash automaticamente apos a janela de exibicao. */
  autoDismiss?: boolean
  durationMs?: number
}

const PROGRESS_WIDTH = SPLASH_BAR_WIDTH
const BAR_WIDTH = SPLASH_BAR_WIDTH * SPLASH_BAR_FILL_RATIO

/**
 * Splash v5 (#vsplash):
 * - Superficie --bg
 * - Mascote gentleman (140x140, velocidade 1.5x)
 * - Wordmark "Vito" 46px com entrada blur-to-sharp
 * - Barra de progresso indeterminada (46x3px)
 */
export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  autoDismiss = false,
  durationMs = SPLASH_OUT_DELAY_MS,
}) => {
  const { isDark } = useTheme()
  const palette = {
    bg: token('--bg', isDark),
    ink: token('--ink', isDark),
    line: token('--line', isDark),
  }
  const [reduceMotion, setReduceMotion] = useState(false)

  const mascotOpacity = useRef(new Animated.Value(0)).current
  const mascotScale = useRef(new Animated.Value(0.7)).current
  const mascotY = useRef(new Animated.Value(16)).current

  const wordOpacity = useRef(new Animated.Value(0)).current
  const wordScale = useRef(new Animated.Value(0.88)).current

  const barOpacity = useRef(new Animated.Value(0)).current
  const barX = useRef(new Animated.Value(-PROGRESS_WIDTH)).current

  const containerOpacity = useRef(new Animated.Value(1)).current
  const containerScale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    let alive = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then((rm) => {
        if (!alive) return
        setReduceMotion(rm)
        if (rm) {
          mascotOpacity.setValue(1)
          mascotScale.setValue(1)
          mascotY.setValue(0)
          wordOpacity.setValue(1)
          wordScale.setValue(1)
          barOpacity.setValue(1)
          if (autoDismiss && onFinish) {
            onFinish()
          }
        }
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [autoDismiss, onFinish, mascotOpacity, mascotScale, mascotY, wordOpacity, wordScale, barOpacity])

  useEffect(() => {
    if (reduceMotion) return

    const easeQ = Easing.bezier(...getBezier('--ease-q'))

    const enterAnim = Animated.parallel([
      Animated.timing(mascotOpacity, { toValue: 1, duration: SPLASH_POP_MS, easing: easeQ, useNativeDriver: true }),
      Animated.timing(mascotScale, { toValue: 1, duration: SPLASH_POP_MS, easing: easeQ, useNativeDriver: true }),
      Animated.timing(mascotY, { toValue: 0, duration: SPLASH_POP_MS, easing: easeQ, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(SPLASH_WORD_DELAY_MS),
        Animated.parallel([
          Animated.timing(wordOpacity, { toValue: 1, duration: SPLASH_IN_MS, easing: easeQ, useNativeDriver: true }),
          Animated.timing(wordScale, { toValue: 1, duration: SPLASH_IN_MS, easing: easeQ, useNativeDriver: true }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(SPLASH_BAR_IN_DELAY_MS),
        Animated.timing(barOpacity, { toValue: 1, duration: SPLASH_IN_MS, easing: easeQ, useNativeDriver: true }),
      ]),
    ])

    enterAnim.start()

    const barLoop = Animated.loop(
      Animated.timing(barX, {
        toValue: PROGRESS_WIDTH * 2,
        duration: SPLASH_BAR_LOOP_MS,
        easing: Easing.bezier(...getBezier('--ease-std')),
        useNativeDriver: true,
      }),
    )
    barLoop.start()

    let dismissTimer: ReturnType<typeof setTimeout> | undefined
    if (autoDismiss && onFinish) {
      dismissTimer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(containerOpacity, {
            toValue: 0,
            duration: SPLASH_OUT_MS,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(containerScale, {
            toValue: 1.05,
            duration: SPLASH_OUT_MS,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => onFinish())
      }, Math.max(0, durationMs))
    }

    return () => {
      enterAnim.stop()
      barLoop.stop()
      if (dismissTimer) clearTimeout(dismissTimer)
    }
  }, [
    reduceMotion,
    autoDismiss,
    durationMs,
    onFinish,
    mascotOpacity,
    mascotScale,
    mascotY,
    wordOpacity,
    wordScale,
    barOpacity,
    barX,
    containerOpacity,
    containerScale,
  ])

  return (
    <Animated.View
      testID="vsplash"
      style={[
        styles.root,
        {
          backgroundColor: palette.bg,
          opacity: containerOpacity,
          transform: [{ scale: containerScale }],
        },
      ]}
    >
      <View style={styles.inner}>
        <Animated.View
          style={[
            styles.mascotBox,
            {
              opacity: mascotOpacity,
              transform: [{ translateY: mascotY }, { scale: mascotScale }],
            },
          ]}
        >
          <MascotVectorRig
            size={SPLASH_MASCOT_SIZE}
            state="gentleman"
            speed={1.5}
            animated={!reduceMotion}
          />
        </Animated.View>

        <Animated.Text
          style={[
            styles.wordmark,
            {
              color: palette.ink,
              opacity: wordOpacity,
              transform: [{ scale: wordScale }],
            },
          ]}
        >
          Vito
        </Animated.Text>

        <Animated.View
          style={[
            styles.progressTrack,
            {
              backgroundColor: palette.line,
              opacity: barOpacity,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: palette.ink,
                transform: [{ translateX: barX }],
              },
            ]}
          />
        </Animated.View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  mascotBox: {
    width: 140,
    height: 140,
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  wordmark: {
    fontFamily: 'Geist_500Medium',
    fontSize: SPLASH_WORD_SIZE,
    lineHeight: SPLASH_WORD_SIZE + 2,
    letterSpacing: -2.07,
    textAlign: 'center',
  } as TextStyle,
  progressTrack: {
    width: PROGRESS_WIDTH,
    height: SPLASH_BAR_HEIGHT,
    borderRadius: 2,
    marginTop: 20,
    overflow: 'hidden',
    position: 'relative',
  } as ViewStyle,
  progressFill: {
    width: BAR_WIDTH,
    height: SPLASH_BAR_HEIGHT,
    borderRadius: 2,
  } as ViewStyle,
})
