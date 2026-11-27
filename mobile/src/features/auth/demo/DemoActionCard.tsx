import React, { useEffect, useRef } from 'react'
import {
  Animated,
  Platform,
  StyleSheet,
  View,
  Text,
  type ViewStyle,
  type TextStyle,
} from 'react-native'
import type { DemoScene } from './demoScenes'
import { useTheme } from '../../../context/ThemeContext'
import { loginPalette, type LoginPalette } from '../utils/loginPalette'
import {
  CalIcon,
  CarIcon,
  MailIcon,
  RadarIcon,
  CheckCircleIcon,
} from '../../../icons/AppGlyphs'

export interface DemoActionCardProps {
  scene: DemoScene
  visible?: boolean
  reduceMotion?: boolean
}

export const DemoActionCard: React.FC<DemoActionCardProps> = ({
  scene,
  visible = true,
  reduceMotion = false,
}) => {
  const { isDark } = useTheme()
  const palette = loginPalette(isDark)
  const card = scene.card

  const opacity = useRef(new Animated.Value(visible && reduceMotion ? 1 : 0)).current
  const translateY = useRef(new Animated.Value(visible && reduceMotion ? 0 : 10)).current

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0)
      translateY.setValue(10)
      return
    }
    if (reduceMotion) {
      opacity.setValue(1)
      translateY.setValue(0)
      return
    }
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 420,
        useNativeDriver: true,
      }),
    ]).start()
  }, [visible, reduceMotion, opacity, translateY])

  if (card.isCol) {
    return (
      <Animated.View
        style={[
          styles.card,
          styles.cardCol,
          {
            backgroundColor: palette.surf,
            borderColor: palette.hairline,
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <Text style={[styles.colHeader, { color: palette.muted }]}>
          {card.title}
        </Text>

        <View
          style={[
            styles.waBubble,
            {
              backgroundColor:
                card.bubbleTone === 'red' ? palette.redBg : palette.greenBg,
            },
          ]}
        >
          {card.bubbleTitle ? (
            <Text style={[styles.bubbleTitle, { color: palette.ink }]}>
              {card.bubbleTitle}
            </Text>
          ) : null}
          <Text style={[styles.bubbleText, { color: palette.ink }]}>
            {card.bubbleText}
          </Text>
        </View>
      </Animated.View>
    )
  }

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: palette.surf,
          borderColor: palette.hairline,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View
        style={[
          styles.chip,
          { backgroundColor: getChipBg(card.kind, palette) },
        ]}
      >
        {renderChipIcon(card.kind, palette)}
      </View>

      <View style={styles.body}>
        <Text
          style={[styles.title, { color: palette.ink }]}
          numberOfLines={1}
        >
          {card.title}
        </Text>
        {card.subtitle ? (
          <Text
            style={[styles.subtitle, { color: palette.muted }]}
            numberOfLines={1}
          >
            {card.subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.trailing}>
        {renderTrailing(card, palette)}
      </View>
    </Animated.View>
  )
}

function getChipBg(kind: string, palette: LoginPalette): string {
  switch (kind) {
    case 'agenda':
      return palette.blueBg
    case 'finance':
      return palette.finBg
    case 'email':
      return palette.redBg
    case 'radar':
      return palette.orangeBg
    case 'boleto':
    case 'tarefa':
    default:
      return palette.purpleBg
  }
}

function renderChipIcon(kind: string, palette: LoginPalette) {
  switch (kind) {
    case 'agenda':
      return <CalIcon color={palette.blue} size={20} />
    case 'finance':
      return <CarIcon color={palette.fin} size={20} />
    case 'email':
      return <MailIcon color={palette.red} size={20} />
    case 'radar':
      return <RadarIcon color={palette.orange} size={20} />
    case 'boleto':
    case 'tarefa':
    default:
      return <CheckCircleIcon color={palette.purple} size={20} />
  }
}

function renderTrailing(card: DemoScene['card'], palette: LoginPalette) {
  switch (card.trailing) {
    case 'check': {
      const checkColor = card.kind === 'boleto' || card.kind === 'tarefa'
        ? palette.purple
        : palette.acc
      return <CheckCircleIcon color={checkColor} size={20} />
    }
    case 'value':
      return (
        <Text style={[styles.trailingValue, { color: palette.ink }]}>
          {card.trailingValue}
        </Text>
      )
    case 'status':
      return (
        <View style={[styles.statusPill, { backgroundColor: palette.greenBg }]}>
          <Text style={[styles.statusText, { color: palette.acc }]}>
            {card.tagLabel || 'Ativo'}
          </Text>
        </View>
      )
    case 'tag': {
      const bg =
        card.tagTone === 'red'
          ? palette.redBg
          : card.tagTone === 'purple'
          ? palette.purpleBg
          : palette.greenBg
      const fg =
        card.tagTone === 'red'
          ? palette.red
          : card.tagTone === 'purple'
          ? palette.purple
          : palette.acc
      return (
        <View style={[styles.tag, { backgroundColor: bg }]}>
          <Text style={[styles.tagText, { color: fg }]}>
            {card.tagLabel || 'Urgente'}
          </Text>
        </View>
      )
    }
    default:
      return null
  }
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 9,
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 20,
      },
      default: {},
    }),
  } as ViewStyle,
  cardCol: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
  } as ViewStyle,
  colHeader: {
    fontSize: 12.5,
    fontFamily: 'Geist_600SemiBold',
  } as TextStyle,
  waBubble: {
    borderRadius: 12,
    borderBottomLeftRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  } as ViewStyle,
  bubbleTitle: {
    fontSize: 13,
    fontFamily: 'Geist_600SemiBold',
    marginBottom: 2,
  } as TextStyle,
  bubbleText: {
    fontSize: 13.5,
    fontFamily: 'Geist_400Regular',
    lineHeight: 19,
  } as TextStyle,
  chip: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } as ViewStyle,
  body: {
    flex: 1,
    minWidth: 0,
  } as ViewStyle,
  title: {
    fontFamily: 'Geist_600SemiBold',
    fontSize: 14,
    lineHeight: 19,
    letterSpacing: -0.14,
  } as TextStyle,
  subtitle: {
    fontFamily: 'Geist_400Regular',
    fontSize: 12.5,
    marginTop: 2,
  } as TextStyle,
  trailing: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } as ViewStyle,
  trailingValue: {
    fontFamily: 'Geist_700Bold',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  } as TextStyle,
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  } as ViewStyle,
  statusText: {
    fontSize: 11.5,
    fontFamily: 'Geist_600SemiBold',
  } as TextStyle,
  tag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  tagText: {
    fontSize: 11.5,
    fontFamily: 'Geist_600SemiBold',
  } as TextStyle,
})
