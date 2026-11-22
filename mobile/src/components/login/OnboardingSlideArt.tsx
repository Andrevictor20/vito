import React, { useEffect, useRef } from 'react'
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import type { LoginPalette } from './loginPalette'
import { LoginMascotRig } from './LoginMascotRig'
import { CheckIcon } from './DemoIcons'

export interface OnboardingSlideArtProps {
  slideIndex: number
  active: boolean
  reduceMotion: boolean
  palette: LoginPalette
}

const FIN_BARS = [40, 62, 48, 78, 55, 92, 70]

/**
 * Artes animadas dos 4 slides do Onboarding (#vonb) em paridade com Vito-telas-atualizadas.html.
 */
export const OnboardingSlideArt: React.FC<OnboardingSlideArtProps> = ({
  slideIndex,
  active,
  reduceMotion,
  palette,
}) => {
  const floatAnim = useRef(new Animated.Value(0)).current
  const barProgress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current
  const pulseAnim = useRef(new Animated.Value(1)).current
  const checkLoop = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (reduceMotion || !active) {
      floatAnim.setValue(0)
      barProgress.setValue(1)
      pulseAnim.setValue(1)
      return
    }

    const fLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -10,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    )
    fLoop.start()

    barProgress.setValue(0)
    Animated.timing(barProgress, {
      toValue: 1,
      duration: 750,
      delay: 200,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false,
    }).start()

    const pLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.35, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    )
    pLoop.start()

    const cLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(1400),
        Animated.timing(checkLoop, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.delay(1800),
        Animated.timing(checkLoop, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    )
    cLoop.start()

    return () => {
      fLoop.stop()
      pLoop.stop()
      cLoop.stop()
    }
  }, [active, reduceMotion, floatAnim, barProgress, pulseAnim, checkLoop])

  if (slideIndex === 0) {
    return (
      <View style={styles.artWrap}>
        <View
          style={[
            styles.glowOrb,
            { backgroundColor: palette.blueBg },
          ]}
        />
        <View style={[styles.glowOrbSecondary, { backgroundColor: palette.purpleBg }]} />
        <LoginMascotRig size={210} state="gentleman" animated={!reduceMotion && active} />
        <Animated.View
          style={[
            styles.pill,
            styles.pillLeft,
            {
              backgroundColor: palette.bg,
              borderColor: palette.hairline,
              transform: [{ translateY: floatAnim }],
            },
          ]}
        >
          <Text style={[styles.pillText, { color: palette.ink }]}>Agenda</Text>
        </Animated.View>
        <Animated.View
          style={[
            styles.pill,
            styles.pillRight,
            {
              backgroundColor: palette.bg,
              borderColor: palette.hairline,
              transform: [{ translateY: Animated.multiply(floatAnim, -0.8) }],
            },
          ]}
        >
          <Text style={[styles.pillText, { color: palette.ink }]}>Tarefas</Text>
        </Animated.View>
        <Animated.View
          style={[
            styles.pill,
            styles.pillBottom,
            {
              backgroundColor: palette.bg,
              borderColor: palette.hairline,
              transform: [{ translateY: floatAnim }],
            },
          ]}
        >
          <Text style={[styles.pillText, { color: palette.ink }]}>Finanças</Text>
        </Animated.View>
      </View>
    )
  }

  if (slideIndex === 1) {
    return (
      <View style={styles.stack}>
        <View
          style={[
            styles.eventCard,
            { backgroundColor: palette.blueBg, borderLeftColor: palette.blue },
          ]}
        >
          <Text style={[styles.evTime, { color: palette.muted }]}>08:00</Text>
          <Text style={[styles.evTitle, { color: palette.ink }]}>Visita técnica à Vale</Text>
          <Text style={[styles.evMeta, { color: palette.muted }]}>
            5 participantes confirmaram
          </Text>
        </View>

        <View
          style={[
            styles.eventCard,
            { backgroundColor: palette.purpleBg, borderLeftColor: palette.purple },
          ]}
        >
          <Text style={[styles.evTime, { color: palette.muted }]}>14:30</Text>
          <Text style={[styles.evTitle, { color: palette.ink }]}>Reunião de sprint</Text>
          <Text style={[styles.evMeta, { color: palette.muted }]}>
            Horário sugerido pelo Vito
          </Text>
        </View>

        <View style={[styles.taskRow, { backgroundColor: palette.surf }]}>
          <Animated.View
            style={[
              styles.taskCheck,
              {
                borderColor: palette.purple,
                backgroundColor: palette.purple,
                opacity: reduceMotion ? 1 : checkLoop.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
              },
            ]}
          >
            <CheckIcon color="#ffffff" size={12} />
          </Animated.View>
          <Text style={[styles.taskLabel, { color: palette.ink }]}>
            Enviar pauta da sprint
          </Text>
        </View>

        <View style={[styles.sayBubble, { backgroundColor: palette.ink }]}>
          <Text style={[styles.sayText, { color: palette.bg }]}>
            “Agende a visita na sexta às 8h”
          </Text>
        </View>
      </View>
    )
  }

  if (slideIndex === 2) {
    return (
      <View style={[styles.finCard, { backgroundColor: palette.surf, borderColor: palette.hairline }]}>
        <Text style={[styles.finLabel, { color: palette.muted }]}>Saldo conectado</Text>
        <Text style={[styles.finBal, { color: palette.ink }]}>
          R$ 4.280<Text style={{ fontSize: 20, color: palette.muted }}>,50</Text>
        </Text>

        <View style={styles.barsRow}>
          {FIN_BARS.map((pct, idx) => {
            const barH = barProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, (84 * pct) / 100],
            })
            return (
              <Animated.View
                key={idx}
                style={[
                  styles.barItem,
                  {
                    height: barH,
                    backgroundColor: idx === 5 ? palette.blue : palette.blueBg,
                  },
                ]}
              />
            )
          })}
        </View>

        <View style={styles.bankRow}>
          <Animated.View
            style={[
              styles.bankDot,
              {
                backgroundColor: palette.acc,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
          <Text style={[styles.bankText, { color: palette.ink }]}>
            Open Finance · 3 contas conectadas
          </Text>
        </View>
      </View>
    )
  }

  const bots = [
    { title: 'Fatura do cartão', sub: 'Vence em 3 dias', color: palette.orange, bg: palette.orangeBg, cta: 'Aprovar', primary: true },
    { title: 'Bot de e-mails', sub: '2 mensagens importantes', color: palette.blue, bg: palette.blueBg, cta: 'Ver', primary: false },
    { title: 'Visita técnica', sub: 'Votação confirmada', color: palette.acc, bg: palette.greenBg, cta: 'Ver', primary: false },
  ]

  return (
    <View style={styles.stack}>
      {bots.map((b) => (
        <View key={b.title} style={[styles.botRow, { backgroundColor: palette.surf }]}>
          <View style={[styles.botIconBox, { backgroundColor: b.bg }]}>
            <Animated.View
              style={[
                styles.botDot,
                { backgroundColor: b.color, transform: [{ scale: pulseAnim }] },
              ]}
            />
          </View>
          <View style={styles.botBody}>
            <Text style={[styles.botTitle, { color: palette.ink }]} numberOfLines={1}>
              {b.title}
            </Text>
            <Text style={[styles.botSub, { color: palette.muted }]} numberOfLines={1}>
              {b.sub}
            </Text>
          </View>
          <View
            style={[
              styles.botCta,
              { backgroundColor: b.primary ? palette.ink : palette.btn },
            ]}
          >
            <Text style={[styles.botCtaText, { color: b.primary ? palette.bg : palette.ink }]}>
              {b.cta}
            </Text>
          </View>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  artWrap: {
    width: '100%',
    height: 290,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  } as ViewStyle,
  glowOrb: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: 0.75,
  } as ViewStyle,
  glowOrbSecondary: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    right: 28,
    bottom: 24,
    opacity: 0.55,
  } as ViewStyle,
  pill: {
    position: 'absolute',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  } as ViewStyle,
  pillLeft: { left: 8, top: 36 } as ViewStyle,
  pillRight: { right: 4, top: 82 } as ViewStyle,
  pillBottom: { left: 26, bottom: 20 } as ViewStyle,
  pillText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
  } as TextStyle,
  stack: {
    width: '100%',
    maxWidth: 320,
    gap: 10,
  } as ViewStyle,
  eventCard: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderLeftWidth: 4,
  } as ViewStyle,
  evTime: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  } as TextStyle,
  evTitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15.5,
    marginTop: 2,
  } as TextStyle,
  evMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 2,
  } as TextStyle,
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
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
  } as TextStyle,
  sayBubble: {
    alignSelf: 'flex-end',
    maxWidth: '90%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderBottomRightRadius: 4,
  } as ViewStyle,
  sayText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13.5,
  } as TextStyle,
  finCard: {
    width: '100%',
    maxWidth: 320,
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  } as ViewStyle,
  finLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12.5,
  } as TextStyle,
  finBal: {
    fontFamily: 'Inter_500Medium',
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -1.08,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  } as TextStyle,
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: 84,
    marginVertical: 14,
  } as ViewStyle,
  barItem: {
    flex: 1,
    borderRadius: 6,
  } as ViewStyle,
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  } as ViewStyle,
  bankDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  } as ViewStyle,
  bankText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12.5,
  } as TextStyle,
  botRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
  } as ViewStyle,
  botIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  botDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  } as ViewStyle,
  botBody: {
    flex: 1,
    minWidth: 0,
  } as ViewStyle,
  botTitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14.5,
  } as TextStyle,
  botSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 1,
  } as TextStyle,
  botCta: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 14,
  } as ViewStyle,
  botCtaText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12.5,
  } as TextStyle,
})
