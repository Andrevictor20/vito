import React, { useCallback, useEffect, useRef, useMemo } from 'react'
import {
  Animated,
  StyleSheet,
  View,
  Text,
  Dimensions,
  type ViewStyle,
  type TextStyle,
} from 'react-native'
import { useTheme } from '../../context/ThemeContext'
import { type ThemeTokens } from '../../theme/tokens'

const { width: windowWidth } = Dimensions.get('window')

export interface DemoUserBubbleProps {
  text: string
  typed: string
  complete: boolean
  photo?: boolean
  colors: ThemeTokens['colors']
}

/**
 * Bolha do usuário à direita (seção 4 do prompt).
 * - Fundo ink (primary), texto na cor do fundo, raios 20/20/5/20 (inf. direito = 5),
 *   padding 10×14, fonte 15, largura máxima 82%.
 * - Técnica anti-salto: renderiza o texto completo invisível para reservar
 *   espaço final; sobrepõe o texto digitado em posição absoluta.
 * - Aparece após 350 ms (fade + subida 10dp).
 */
export const DemoUserBubble: React.FC<DemoUserBubbleProps> = ({
  text,
  typed,
  complete,
  photo = false,
  colors,
}) => {
  const bubbleWidth = useMemo(
    () => Math.min(windowWidth * 0.82, 280),
    [windowWidth],
  )

  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(10)).current
  const cursor = useRef(new Animated.Value(1)).current

  const isDark = colors.primary === '#FFFFFF'
  const textColor = isDark ? '#FAFAFA' : '#FFFFFF'

  useEffect(() => {
    // Aparece após 350 ms: fade + subida 10dp.
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start()

    // Cursor piscando enquanto digita.
    if (!complete) {
      const id = setInterval(() => {
        Animated.sequence([
          Animated.timing(cursor, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(cursor, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start()
      }, 800)
      return () => clearInterval(id)
    }
  }, [opacity, translateY, cursor, complete])

  return (
    <View style={[styles.row, { alignItems: 'flex-end' }]}>
      <Animated.View
        style={[
          styles.bubbleContainer,
          {
            opacity,
            transform: [{ translateY }],
            width: bubbleWidth,
          },
        ]}
      >
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: isDark
                ? colors.surfaceContainerHigh
                : colors.primary,
            },
          ]}
        >
          {photo && <View style={styles.photoPlaceholder} />}

          {/* Texto completo invisível — reserva largura/altura finais. */}
          <Text style={[styles.fullText, { color: textColor }]}>{text}</Text>

          {/* Texto digitado visível, sobreposto em absoluto. */}
          <View style={styles.typedWrap}>
            <Animated.Text
              style={[
                styles.typedText,
                { color: textColor, opacity },
              ]}
            >
              {typed}
            </Animated.Text>
            {!complete && (
              <Animated.Text style={[styles.cursor, { opacity: cursor }]}>
                ▋
              </Animated.Text>
            )}
          </View>
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  bubbleContainer: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 20,
    borderBottomRightRadius: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
  },
  fullText: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 20,
  },
  typedWrap: {
    position: 'relative',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  typedText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 20,
  },
  cursor: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 20,
  },
  photoPlaceholder: {
    width: 92,
    height: 58,
    borderRadius: 9,
    backgroundColor: '#EDE7D2',
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
