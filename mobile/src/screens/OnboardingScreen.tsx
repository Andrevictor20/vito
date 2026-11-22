import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../context/ThemeContext'
import { loginPalette } from '../components/login/loginPalette'
import { LoginMascotRig } from '../components/login/LoginMascotRig'
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
export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const { isDark } = useTheme()
  const palette = loginPalette(isDark)
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()

  const scrollRef = useRef<ScrollView>(null)
  const [index, setIndex] = useState(0)
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => undefined)
  }, [])

  const isLast = index === ONBOARDING_SLIDES.length - 1

  const goToSlide = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(ONBOARDING_SLIDES.length - 1, next))
      setIndex(clamped)
      scrollRef.current?.scrollTo({ x: clamped * width, animated: !reduceMotion })
    },
    [width, reduceMotion],
  )

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (width <= 0) return
      const next = Math.round(e.nativeEvent.contentOffset.x / width)
      setIndex(Math.max(0, Math.min(ONBOARDING_SLIDES.length - 1, next)))
    },
    [width],
  )

  const handleNext = useCallback(() => {
    if (isLast) {
      onComplete()
    } else {
      goToSlide(index + 1)
    }
  }, [isLast, index, goToSlide, onComplete])

  return (
    <View
      testID="vonb"
      style={[
        styles.root,
        {
          backgroundColor: palette.bg,
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: Math.max(insets.bottom, 16),
        },
      ]}
    >
      <View style={styles.topbar}>
        <View style={styles.brand}>
          <LoginMascotRig size={36} state="blink" animated={!reduceMotion} />
          <Text style={[styles.brandName, { color: palette.ink }]}>vito</Text>
        </View>

        <TouchableOpacity
          testID="ob-skip"
          onPress={onComplete}
          disabled={isLast}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Pular introdução"
          style={[styles.skipBtn, isLast && styles.skipHidden]}
        >
          <Text style={[styles.skipText, { color: palette.muted }]}>Pular</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
        scrollEventThrottle={16}
        style={styles.pager}
      >
        {ONBOARDING_SLIDES.map((slide, idx) => (
          <View key={slide.id} style={[styles.slide, { width }]}>
            <View style={styles.artContainer}>
              <OnboardingSlideArt
                slideIndex={idx}
                active={idx === index}
                reduceMotion={reduceMotion}
                palette={palette}
              />
            </View>
            <Text style={[styles.title, { color: palette.ink }]}>{slide.title}</Text>
            <Text style={[styles.description, { color: palette.muted }]}>
              {slide.description}
            </Text>
          </View>
        ))}
      </ScrollView>

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
                <View
                  style={[
                    styles.dot,
                    {
                      width: active ? 24 : 7,
                      backgroundColor: active ? palette.ink : palette.line,
                    },
                  ]}
                />
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
    </View>
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
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    letterSpacing: -0.8,
  } as TextStyle,
  skipBtn: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  skipHidden: {
    opacity: 0,
  } as ViewStyle,
  skipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  } as TextStyle,
  pager: {
    flex: 1,
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
    fontFamily: 'Inter_600SemiBold',
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.98,
    marginBottom: 10,
  } as TextStyle,
  description: {
    fontFamily: 'Inter_400Regular',
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
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  } as TextStyle,
})
