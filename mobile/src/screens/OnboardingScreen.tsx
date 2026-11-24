import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Animated,
  Easing,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import Reanimated, {
  Easing as ReanimatedEasing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../context/ThemeContext'
import { loginPalette } from '../components/login/loginPalette'
import { getBezier } from '../ds/tokens'
import { MascotVectorRig } from '../components/mascot/MascotVectorRig'
import {
  ONBOARDING_DESC_DELAY_MS,
  ONBOARDING_DOT_MS,
  ONBOARDING_LIVE_DELAY_MS,
  ONBOARDING_OUT_MS,
  ONBOARDING_OUT_SCALE,
  ONBOARDING_SKIP_FADE_MS,
  ONBOARDING_SWIPE_THRESHOLD,
  ONBOARDING_TEXT_MS,
  ONBOARDING_TITLE_DELAY_MS,
  ONBOARDING_TRACK_MS,
} from '../components/login/onboardingMotion'
import { OnboardingSlideArt } from '../components/login/OnboardingSlideArt'
import { ONBOARDING_SLIDES } from '../components/login/onboardingSlides'

export { ONBOARDING_SLIDES, type OnboardingSlide } from '../components/login/onboardingSlides'

export interface OnboardingScreenProps {
  onComplete: () => void
}

/**
 * Onboarding v5 (#vonb):
 * - 4 slides deslizaveis para novos usuarios antes do login
 * - Topbar com mascote blink + "vito" + botao "Pular" (oculto no slide 4)
 * - Dots expansiveis + CTA "Continuar" / "Começar" -> #s-login
 */
const EASE_Q = Easing.bezier(...getBezier('--ease-q'))
const EASE_STD = Easing.bezier(...getBezier('--ease-std'))

/** obUp: translateY 14 -> 0 + fade, com delay (só quando o slide está ativo). */
const RiseText: React.FC<{
  active: boolean
  delay: number
  style: TextStyle[]
  children: string
}> = ({ active, delay, style, children }) => {
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    v.setValue(0)
    if (!active) return
    const anim = Animated.timing(v, {
      toValue: 1,
      duration: ONBOARDING_TEXT_MS,
      delay,
      easing: EASE_Q,
      useNativeDriver: true,
    })
    anim.start()
    return () => anim.stop()
  }, [active, delay, v])
  return (
    <Animated.Text
      style={[
        ...style,
        { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] },
      ]}
    >
      {children}
    </Animated.Text>
  )
}

/** .ob-dots button: largura 7 -> 24 em .35s (Reanimated 4 UI thread). */
const Dot: React.FC<{ active: boolean; on: string; off: string }> = ({ active, on, off }) => {
  const w = useSharedValue(active ? 24 : 7)
  useEffect(() => {
    const [x1, y1, x2, y2] = getBezier('--ease-q')
    cancelAnimation(w)
    w.value = withTiming(active ? 24 : 7, {
      duration: ONBOARDING_DOT_MS,
      easing: ReanimatedEasing.bezier(x1, y1, x2, y2),
    })
    return () => cancelAnimation(w)
  }, [active, w])
  const animStyle = useAnimatedStyle(() => ({
    width: w.value,
  }))
  return <Reanimated.View style={[styles.dot, { backgroundColor: active ? on : off }, animStyle]} />
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const { isDark } = useTheme()
  const palette = loginPalette(isDark)
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()

  const [index, setIndex] = useState(0)
  const [live, setLive] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const indexRef = useRef(0)
  const track = useRef(new Animated.Value(0)).current
  const drag = useRef(new Animated.Value(0)).current
  const outV = useRef(new Animated.Value(0)).current
  const widthRef = useRef(width)
  widthRef.current = width

  useEffect(() => {
    let alive = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then((rm) => {
        if (!alive) return
        setReduceMotion(rm)
        if (rm) setLive(true)
      })
      .catch(() => undefined)
    const t = setTimeout(() => setLive(true), ONBOARDING_LIVE_DELAY_MS)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [])

  const last = ONBOARDING_SLIDES.length - 1
  const isLast = index === last

  const goToSlide = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(last, next))
      indexRef.current = clamped
      setIndex(clamped)
      Animated.parallel([
        Animated.timing(track, {
          toValue: -clamped * widthRef.current,
          duration: reduceMotion ? 0 : ONBOARDING_TRACK_MS,
          easing: EASE_Q,
          useNativeDriver: true,
        }),
        Animated.timing(drag, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]).start()
    },
    [last, reduceMotion, track, drag],
  )

  useEffect(() => {
    track.setValue(-indexRef.current * width)
  }, [width, track])

  const finish = useCallback(() => {
    Animated.timing(outV, {
      toValue: 1,
      duration: reduceMotion ? 0 : ONBOARDING_OUT_MS,
      easing: EASE_STD,
      useNativeDriver: true,
    }).start(() => onComplete())
  }, [outV, reduceMotion, onComplete])

  const handleNext = useCallback(() => {
    if (indexRef.current >= last) finish()
    else goToSlide(indexRef.current + 1)
  }, [last, finish, goToSlide])

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: (_e, g) => drag.setValue(g.dx),
        onPanResponderRelease: (_e, g) => {
          const step = Math.abs(g.dx) > ONBOARDING_SWIPE_THRESHOLD ? (g.dx < 0 ? 1 : -1) : 0
          goToSlide(indexRef.current + step)
        },
        onPanResponderTerminate: () => goToSlide(indexRef.current),
      }),
    [drag, goToSlide],
  )

  const skipOpacity = useRef(new Animated.Value(1)).current
  useEffect(() => {
    Animated.timing(skipOpacity, {
      toValue: isLast ? 0 : 1,
      duration: ONBOARDING_SKIP_FADE_MS,
      useNativeDriver: true,
    }).start()
  }, [isLast, skipOpacity])

  return (
    <Animated.View
      testID="vonb"
      style={[
        styles.root,
        {
          backgroundColor: palette.bg,
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: Math.max(insets.bottom, 16),
          opacity: outV.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          transform: [
            { scale: outV.interpolate({ inputRange: [0, 1], outputRange: [1, ONBOARDING_OUT_SCALE] }) },
          ],
        },
      ]}
     
    >
      <View style={styles.topbar}>
        <View style={styles.brand}>
          <MascotVectorRig size={36} state="blink" animated={!reduceMotion} />
          <Text style={[styles.brandName, { color: palette.ink }]}>vito</Text>
        </View>

        <Animated.View style={{ opacity: skipOpacity }} pointerEvents={isLast ? 'none' : 'auto'}>
          <TouchableOpacity
            testID="ob-skip"
            onPress={finish}
            disabled={isLast}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Pular introdução"
            style={styles.skipBtn}
          >
            <Text style={[styles.skipText, { color: palette.muted }]}>Pular</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <View style={styles.pager} {...pan.panHandlers}>
        <Animated.View
          style={[
            styles.trackRow,
            { width: width * ONBOARDING_SLIDES.length, transform: [{ translateX: Animated.add(track, drag) }] },
          ]}
        >
          {ONBOARDING_SLIDES.map((slide, idx) => (
            <View key={slide.id} style={[styles.slide, { width }]}>
              <View style={styles.artContainer}>
                <OnboardingSlideArt
                  slideIndex={idx}
                  active={live && idx === index}
                  reduceMotion={reduceMotion}
                  palette={palette}
                />
              </View>
              <RiseText
                active={live && idx === index}
                delay={ONBOARDING_TITLE_DELAY_MS}
                style={[styles.title, { color: palette.ink }]}
              >
                {slide.title}
              </RiseText>
              <RiseText
                active={live && idx === index}
                delay={ONBOARDING_DESC_DELAY_MS}
                style={[styles.description, { color: palette.muted }]}
              >
                {slide.description}
              </RiseText>
            </View>
          ))}
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <View style={styles.dotsRow}>
          {ONBOARDING_SLIDES.map((slide, idx) => {
            const active = idx === index
            return (
              <TouchableOpacity
                key={slide.id}
                onPress={() => goToSlide(idx)}
                hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
                accessibilityRole="button"
                accessibilityLabel={`Ir para o passo ${idx + 1}`}
              >
                <Dot active={active} on={palette.ink} off={palette.line} />
              </TouchableOpacity>
            )
          })}
        </View>

        <TouchableOpacity
          testID="ob-next"
          onPress={handleNext}
          activeOpacity={0.86}
          accessibilityRole="button"
          accessibilityLabel={isLast ? 'Começar' : 'Continuar'}
          style={[styles.ctaBtn, { backgroundColor: palette.ink }]}
        >
          <Text style={[styles.ctaText, { color: palette.bg }]}>
            {isLast ? 'Começar' : 'Continuar'}
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  } as ViewStyle,
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 28,
    paddingRight: 20,
    paddingTop: 4,
  } as ViewStyle,
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  } as ViewStyle,
  brandName: {
    fontFamily: 'Geist_700Bold',
    fontSize: 20,
    letterSpacing: -0.8,
  } as TextStyle,
  skipBtn: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  skipText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 14,
  } as TextStyle,
  pager: {
    flex: 1,
    overflow: 'hidden',
  } as ViewStyle,
  trackRow: {
    flex: 1,
    flexDirection: 'row',
  } as ViewStyle,
  slide: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'flex-end',
    paddingBottom: 18,
  } as ViewStyle,
  artContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  title: {
    fontFamily: 'Geist_600SemiBold',
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.98,
    marginBottom: 10,
  } as TextStyle,
  description: {
    fontFamily: 'Geist_400Regular',
    fontSize: 15.5,
    lineHeight: 23,
  } as TextStyle,
  footer: {
    paddingHorizontal: 28,
    paddingTop: 6,
    paddingBottom: 8,
  } as ViewStyle,
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 18,
  } as ViewStyle,
  dot: {
    height: 7,
    borderRadius: 4,
  } as ViewStyle,
  ctaBtn: {
    width: '100%',
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  ctaText: {
    fontFamily: 'Geist_600SemiBold',
    fontSize: 16,
  } as TextStyle,
})
