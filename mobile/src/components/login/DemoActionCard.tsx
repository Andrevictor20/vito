import React, { useEffect, useRef } from 'react'
import {
  Animated,
  StyleSheet,
  View,
  Text,
  type ViewStyle,
  type TextStyle,
} from 'react-native'
import type { DemoScene } from './demoScenes'
import { useTheme } from '../../context/ThemeContext'
import { loginPalette, type LoginPalette } from './loginPalette'
import {
  CalIcon,
  MailIcon,
  RadarIcon,
  CheckCircleIcon,
  Sparkline,
} from './DemoIcons'

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
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 450,
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
            backgroundColor: palette.bg,
            borderColor: palette.line,
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
          {card.bubbleTitle && (
            <Text style={[styles.bubbleTitle, { color: palette.ink }]}>
              {card.bubbleTitle}
            </Text>
          )}
          <Text style={[styles.bubbleText, { color: palette.ink }]}>
            {card.bubbleText}
          </Text>
        </View>

        <View style={styles.miniRow}>
          <View
            style={[
              styles.miniBtn,
              { backgroundColor: palette.ink, borderColor: palette.ink },
            ]}
          >
            <Text style={[styles.miniBtnText, { color: palette.bg }]}>
              Enviar
            </Text>
          </View>
          <View
            style={[
              styles.miniBtn,
              styles.miniBtnOutline,
              { borderColor: palette.ink },
            ]}
          >
            <Text style={[styles.miniBtnText, { color: palette.ink }]}>
              Editar
            </Text>
          </View>
        </View>
      </Animated.View>
    )
  }

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: palette.bg,
          borderColor: palette.line,
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
        {card.subtitle && (
          <Text
            style={[styles.subtitle, { color: palette.muted }]}
            numberOfLines={1}
          >
            {card.subtitle}
          </Text>
        )}
      </View>

      <View style={styles.trailing}>
        {renderTrailing(card.trailing, card.tagLabel, card.tagTone, palette)}
      </View>
    </Animated.View>
  )
}

function getChipBg(kind: string, palette: LoginPalette): string {
  switch (kind) {
    case 'agenda':
      return palette.blueBg
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
    case 'email':
      return <MailIcon color={palette.red} size={20} />
    case 'radar':
      return <RadarIcon color={palette.orange} size={20} />
    case 'boleto':
    case 'tarefa':
    default:
      return <CheckCircleIcon color={palette.purple} size={22} />
  }
}

function renderTrailing(
  trailing: 'check' | 'chart' | 'pills' | 'tag' | undefined,
  tagLabel: string | undefined,
  tagTone: 'red' | 'purple' | 'green' | undefined,
  palette: LoginPalette,
) {
  switch (trailing) {
    case 'check':
      return <CheckCircleIcon color={palette.accent} size={22} />
    case 'chart':
      return <Sparkline color={palette.orange} />
    case 'tag': {
      const bg =
        tagTone === 'red'
          ? palette.redBg
          : tagTone === 'purple'
          ? palette.purpleBg
          : palette.greenBg
      const fg =
        tagTone === 'red'
          ? palette.red
          : tagTone === 'purple'
          ? palette.purple
          : palette.accent
      return (
        <View style={[styles.tag, { backgroundColor: bg }]}>
          <Text style={[styles.tagText, { color: fg }]}>
            {tagLabel || 'Tarefa'}
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
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    width: '100%',
    shadowColor: '#141916',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  } as ViewStyle,
  cardCol: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
  } as ViewStyle,
  colHeader: {
    fontSize: 12.5,
    fontFamily: 'Inter_600SemiBold',
  } as TextStyle,
  waBubble: {
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  } as ViewStyle,
  bubbleTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2,
  } as TextStyle,
  bubbleText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 19,
  } as TextStyle,
  miniRow: {
    flexDirection: 'row',
    gap: 8,
  } as ViewStyle,
  miniBtn: {
    height: 32,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  miniBtnOutline: {
    backgroundColor: 'transparent',
  } as ViewStyle,
  miniBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
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
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14.5,
    lineHeight: 20,
  } as TextStyle,
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    marginTop: 2,
  } as TextStyle,
  trailing: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } as ViewStyle,
  tag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  tagText: {
    fontSize: 11.5,
    fontFamily: 'Inter_600SemiBold',
  } as TextStyle,
})
