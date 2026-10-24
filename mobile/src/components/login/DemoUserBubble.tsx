import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  StyleSheet,
  View,
  Text,
  type ViewStyle,
  type TextStyle,
} from 'react-native'
import { useTheme } from '../../context/ThemeContext'
import { loginPalette } from './loginPalette'

export interface DemoUserBubbleProps {
  text: string
  typed: string
  complete: boolean
  photo?: boolean
}

/**
 * Bolha do usuário alinhada à direita em paridade com login-vito.html:
 * .user{
 *   max-width:82%; background:var(--ink); color:var(--bg);
 *   padding:10px 14px; border-radius:20px 20px 5px 20px; font-size:15px; line-height:1.35;
 * }
 * .user.show{opacity:1; animation:rise .35s ease both}
 * Miniatura do documento/boleto com listras horizontais (#b9ae93) quando photo === true.
 */
export const DemoUserBubble: React.FC<DemoUserBubbleProps> = ({
  text,
  typed,
  complete,
  photo = false,
}) => {
  const { isDark } = useTheme()
  const palette = loginPalette(isDark)

  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(10)).current
  const [caretVisible, setCaretVisible] = useState(true)

  useEffect(() => {
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
  }, [opacity, translateY])

  // Caret piscando enquanto digita
  useEffect(() => {
    if (complete) {
      setCaretVisible(false)
      return
    }
    setCaretVisible(true)
    const interval = setInterval(() => {
      setCaretVisible((v) => !v)
    }, 400)
    return () => clearInterval(interval)
  }, [complete])

  return (
    <Animated.View
      style={[
        styles.userBubble,
        {
          backgroundColor: palette.ink,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {photo && (
        <View
          style={[
            styles.photoCard,
            { backgroundColor: palette.photoPaper },
          ]}
        >
          <View
            style={[
              styles.photoLine,
              styles.photoLine1,
              { backgroundColor: palette.photoLine },
            ]}
          />
          <View
            style={[
              styles.photoLine,
              styles.photoLine2,
              { backgroundColor: palette.photoLine },
            ]}
          />
          <View
            style={[
              styles.photoLine,
              styles.photoLine3,
              { backgroundColor: palette.photoLine },
            ]}
          />
        </View>
      )}

      {/* Container com texto: o fantasma transparente reserva largura e altura exatas */}
      <View style={styles.textStack}>
        <Text
          style={[styles.ghostText, { color: palette.bg }]}
          accessible={false}
        >
          {text}
        </Text>

        <View style={styles.liveContainer}>
          <Text style={[styles.bubbleText, { color: palette.bg }]}>
            {typed}
            {!complete && (
              <Text
                style={[
                  styles.caret,
                  { color: palette.bg, opacity: caretVisible ? 1 : 0 },
                ]}
              >
                |
              </Text>
            )}
          </Text>
        </View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderBottomRightRadius: 5,
  } as ViewStyle,
  photoCard: {
    width: 92,
    height: 58,
    borderRadius: 9,
    marginBottom: 8,
    padding: 10,
    position: 'relative',
    justifyContent: 'space-between',
  } as ViewStyle,
  photoLine: {
    height: 4,
    borderRadius: 2,
  } as ViewStyle,
  photoLine1: {
    width: 44,
  } as ViewStyle,
  photoLine2: {
    width: 62,
  } as ViewStyle,
  photoLine3: {
    width: 62,
  } as ViewStyle,
  textStack: {
    position: 'relative',
  } as ViewStyle,
  ghostText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 20.25, // 15px * 1.35
    opacity: 0,
  } as TextStyle,
  liveContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  } as ViewStyle,
  bubbleText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 20.25,
  } as TextStyle,
  caret: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  } as TextStyle,
})
