import React, { useEffect, useRef } from 'react'
import {
  Animated,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
  type TextStyle,
} from 'react-native'
import { useTheme } from '../../context/ThemeContext'
import { loginPalette } from './loginPalette'

export interface DemoVitoResponseProps {
  text: string
  visible: boolean
  dots: boolean
}

/**
 * Resposta fluida do Vito à esquerda (sem balão, sem avatar)
 * .vito{position:relative;font-size:15px;line-height:1.45}
 * 3 pontinhos pulando sequencialmente quando em espera (`dots === true`).
 * Animação suave rise (opacity 0->1, translateY 10->0 em 400ms) quando revelado.
 */
export const DemoVitoResponse: React.FC<DemoVitoResponseProps> = ({
  text,
  visible,
  dots,
}) => {
  const { isDark } = useTheme()
  const palette = loginPalette(isDark)

  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current
  const translateY = useRef(new Animated.Value(visible ? 0 : 10)).current

  const dot1 = useRef(new Animated.Value(0)).current
  const dot2 = useRef(new Animated.Value(0)).current
  const dot3 = useRef(new Animated.Value(0)).current

  const dot1Opacity = useRef(new Animated.Value(0.3)).current
  const dot2Opacity = useRef(new Animated.Value(0.3)).current
  const dot3Opacity = useRef(new Animated.Value(0.3)).current

  // Revelação suave do texto do Vito
  useEffect(() => {
    if (!visible) {
      opacity.setValue(0)
      translateY.setValue(10)
      return
    }
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start()
  }, [visible, opacity, translateY])

  // Animação contínua dos pontinhos: pulam 3px e aumentam opacidade
  useEffect(() => {
    if (!dots) return

    const makeDotAnim = (animY: Animated.Value, animOp: Animated.Value) =>
      Animated.sequence([
        Animated.parallel([
          Animated.timing(animY, {
            toValue: -3,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(animOp, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(animY, {
            toValue: 0,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(animOp, {
            toValue: 0.3,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      ])

    let active = true

    const loop = () => {
      if (!active) return
      Animated.parallel([
        makeDotAnim(dot1, dot1Opacity),
        Animated.sequence([
          Animated.delay(150),
          makeDotAnim(dot2, dot2Opacity),
        ]),
        Animated.sequence([
          Animated.delay(300),
          makeDotAnim(dot3, dot3Opacity),
        ]),
      ]).start(() => {
        if (active) loop()
      })
    }

    loop()

    return () => {
      active = false
      dot1.setValue(0)
      dot2.setValue(0)
      dot3.setValue(0)
      dot1Opacity.setValue(0.3)
      dot2Opacity.setValue(0.3)
      dot3Opacity.setValue(0.3)
    }
  }, [dots, dot1, dot2, dot3, dot1Opacity, dot2Opacity, dot3Opacity])

  if (dots) {
    return (
      <View style={styles.dotsContainer}>
        <Animated.View
          style={[
            styles.dot,
            {
              backgroundColor: palette.muted,
              opacity: dot1Opacity,
              transform: [{ translateY: dot1 }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.dot,
            {
              backgroundColor: palette.muted,
              opacity: dot2Opacity,
              transform: [{ translateY: dot2 }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.dot,
            {
              backgroundColor: palette.muted,
              opacity: dot3Opacity,
              transform: [{ translateY: dot3 }],
            },
          ]}
        />
      </View>
    )
  }

  if (!visible) return null

  return (
    <Animated.View
      style={[
        styles.vitoContainer,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Text style={[styles.vitoText, { color: palette.ink }]}>
        {text}
      </Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  vitoContainer: {
    alignSelf: 'flex-start',
    width: '100%',
  } as ViewStyle,
  vitoText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 21.75, // 15px * 1.45
  } as TextStyle,
  dotsContainer: {
    flexDirection: 'row',
    gap: 4,
    height: 24,
    alignItems: 'center',
    paddingTop: 6,
  } as ViewStyle,
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  } as ViewStyle,
})
