import React, { useCallback, useEffect, useRef } from 'react'
import {
  Animated,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native'
import { useTheme } from '../../context/ThemeContext'
import { type ThemeTokens } from '../../theme/tokens'

export interface DemoVitoResponseProps {
  text: string
  visible: boolean
  dots: boolean
  colors: ThemeTokens['colors']
}

/**
 * Resposta do Vito como texto fluido à esquerda (sem balão, fonte 15).
 * Três pontinhos de "pensando" pulando em sequência (1 s) até a revelação.
 * Fade + subida (400 ms) quando aparece.
 */
export const DemoVitoResponse: React.FC<DemoVitoResponseProps> = ({
  text,
  visible,
  dots,
  colors,
}) => {
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current
  const translateY = useRef(new Animated.Value(visible ? 0 : 10)).current

  const dotAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current

  // Fade + subida do texto do Vito (400 ms) quando aparece.
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

  // Pontinhos pulando em sequência (1 s).
  useEffect(() => {
    if (!dots) return
    const step = () => {
      Animated.sequence([
        Animated.timing(dotAnims[0], {
          toValue: -3,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(dotAnims[0], {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]).start()
      Animated.sequence([
        Animated.delay(150),
        Animated.timing(dotAnims[1], {
          toValue: -3,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(dotAnims[1], {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]).start()
      Animated.sequence([
        Animated.delay(300),
        Animated.timing(dotAnims[2], {
          toValue: -3,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(dotAnims[2], {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]).start()
    }
    step()
    const id = setInterval(step, 1000)
    return () => clearInterval(id)
  }, [dots, dotAnims])

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      {dots ? (
        <View style={styles.dotsRow}>
          {dotAnims.map((anim, i) => (
            <Animated.View
              key={i}
              style={[styles.dot, { transform: [{ translateY: anim }] }]}
            />
          ))}
        </View>
      ) : text ? (
        <Text style={[styles.text, { color: colors.onSurface }]}>
          {text}
        </Text>
      ) : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    // Texto fluido, sem balão - alinhado à esquerda
    alignSelf: 'flex-start',
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#98A19D',
  },
  text: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: '#09090B',
  },
})
