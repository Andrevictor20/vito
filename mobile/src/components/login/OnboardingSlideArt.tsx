import React from 'react'
import {
  Animated,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import type { LoginPalette } from './loginPalette'
import { MascotVectorRig } from '../mascot/MascotVectorRig'
import { Bar, EnterItem, Floaty, TaskRow, usePulse } from './onboardingArtParts'
import {
  ONBOARDING_FLOAT_MS,
  ONBOARDING_GLOW_FLOAT_MS,
  ONBOARDING_IN_DELAYS,
} from './onboardingMotion'

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
  const pulse = usePulse(active, reduceMotion)
  const E = (i: number) => ({ active, reduceMotion, delay: ONBOARDING_IN_DELAYS[i] })

  if (slideIndex === 0) {
    const pill = (label: string, pos: ViewStyle, phase: number) => (
      <Floaty
        key={label}
        active={active}
        reduceMotion={reduceMotion}
        ms={ONBOARDING_FLOAT_MS}
        phase={phase}
        fade
        style={[styles.pill, pos, { backgroundColor: palette.bg }]}
      >
        <Text style={[styles.pillText, { color: palette.ink }]}>{label}</Text>
      </Floaty>
    )
    return (
      <View style={styles.artWrap}>
        <Floaty active={active} reduceMotion={reduceMotion} ms={ONBOARDING_GLOW_FLOAT_MS} style={styles.glowOrb}>
          <Svg width={270} height={270}>
            <Defs>
              <RadialGradient id="obGlow" cx="35%" cy="30%" r="95.5%" fx="35%" fy="30%">
                <Stop offset="0" stopColor={palette.blue} stopOpacity="0.38" />
                <Stop offset="0.55" stopColor={palette.purple} stopOpacity="0.26" />
                <Stop offset="0.72" stopColor={palette.purple} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="270" height="270" fill="url(#obGlow)" />
          </Svg>
        </Floaty>
        <MascotVectorRig size={210} state="gentleman" animated={!reduceMotion && active} />
        {pill('Agenda', styles.pillLeft, 0)}
        {pill('Tarefas', styles.pillRight, 1.3 / 4)}
        {pill('Finanças', styles.pillBottom, 2.4 / 4)}
      </View>
    )
  }

  if (slideIndex === 1) {
    return (
      <View style={styles.stack}>
        <EnterItem {...E(0)}>
          <View style={[styles.eventCard, { backgroundColor: palette.blueBg, borderLeftColor: palette.blue }]}>
            <Text style={[styles.evTime, { color: palette.muted }]}>08:00</Text>
            <Text style={[styles.evTitle, { color: palette.ink }]}>Visita técnica à Vale</Text>
            <Text style={[styles.evMeta, { color: palette.muted }]}>5 participantes confirmaram</Text>
          </View>
        </EnterItem>
        <EnterItem {...E(1)}>
          <View style={[styles.eventCard, { backgroundColor: palette.purpleBg, borderLeftColor: palette.purple }]}>
            <Text style={[styles.evTime, { color: palette.muted }]}>14:30</Text>
            <Text style={[styles.evTitle, { color: palette.ink }]}>Reunião de sprint</Text>
            <Text style={[styles.evMeta, { color: palette.muted }]}>Horário sugerido pelo Vito</Text>
          </View>
        </EnterItem>
        <EnterItem {...E(2)}>
          <TaskRow active={active} reduceMotion={reduceMotion} palette={palette} />
        </EnterItem>
        <EnterItem {...E(3)} style={styles.sayWrap}>
          <View style={[styles.sayBubble, { backgroundColor: palette.ink }]}>
            <Text style={[styles.sayText, { color: palette.bg }]}>“Agende a visita na sexta às 8h”</Text>
          </View>
        </EnterItem>
      </View>
    )
  }

  if (slideIndex === 2) {
    return (
      <EnterItem active={active} reduceMotion={reduceMotion} style={styles.finWrap}>
        <View style={[styles.finCard, { backgroundColor: palette.surf, borderColor: palette.cardRing }]}>
          <Text style={[styles.finLabel, { color: palette.muted }]}>Saldo conectado</Text>
          <Text style={[styles.finBal, { color: palette.ink }]}>
            R$ 4.280<Text style={{ fontSize: 20, color: palette.muted }}>,50</Text>
          </Text>
          <View style={styles.barsRow}>
            {FIN_BARS.map((pct, idx) => (
              <Bar
                key={idx}
                active={active}
                reduceMotion={reduceMotion}
                idx={idx}
                pct={pct}
                color={idx === 5 ? palette.blue : palette.finBarBg}
              />
            ))}
          </View>
          <View style={styles.bankRow}>
            <Animated.View style={[styles.bankDot, { backgroundColor: palette.acc }, pulse]} />
            <Text style={[styles.bankText, { color: palette.ink }]}>Open Finance · 3 contas conectadas</Text>
          </View>
        </View>
      </EnterItem>
    )
  }

  const bots = [
    { title: 'Fatura do cartão', sub: 'Vence em 3 dias', color: palette.orange, bg: palette.orangeBg, cta: 'Aprovar', primary: true },
    { title: 'Radar de e-mails', sub: '2 mensagens importantes', color: palette.blue, bg: palette.blueBg, cta: 'Ver', primary: false },
    { title: 'Visita técnica', sub: 'Votação confirmada', color: palette.acc, bg: palette.greenBg, cta: 'Ver', primary: false },
  ]

  return (
    <View style={styles.stack}>
      {bots.map((b, i) => (
        <EnterItem key={b.title} {...E(i)}>
          <View style={[styles.botRow, { backgroundColor: palette.surf }]}>
            <View style={[styles.botIconBox, { backgroundColor: b.bg }]}>
              <Animated.View style={[styles.botDot, { backgroundColor: b.color }, pulse]} />
            </View>
            <View style={styles.botBody}>
              <Text style={[styles.botTitle, { color: palette.ink }]} numberOfLines={1}>{b.title}</Text>
              <Text style={[styles.botSub, { color: palette.muted }]} numberOfLines={1}>{b.sub}</Text>
            </View>
            <View style={[styles.botCta, { backgroundColor: b.primary ? palette.ink : palette.btn }]}>
              <Text style={[styles.botCtaText, { color: b.primary ? palette.bg : palette.ink }]}>{b.cta}</Text>
            </View>
          </View>
        </EnterItem>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  artWrap: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  } as ViewStyle,
  glowOrb: {
    position: 'absolute',
    width: 270,
    height: 270,
    borderRadius: 135,
    overflow: 'hidden',
  } as ViewStyle,
  pill: {
    position: 'absolute',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  } as ViewStyle,
  pillLeft: { left: '2%', top: '20%' } as ViewStyle,
  pillRight: { right: 0, top: '34%' } as ViewStyle,
  pillBottom: { left: '10%', bottom: '14%' } as ViewStyle,
  pillText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
  } as TextStyle,
  stack: {
    width: '100%',
    maxWidth: 310,
    gap: 10,
  } as ViewStyle,
  eventCard: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderLeftWidth: 4,
  } as ViewStyle,
  evTime: {
    fontFamily: 'Geist_500Medium',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  } as TextStyle,
  evTitle: {
    fontFamily: 'Geist_500Medium',
    fontSize: 15.5,
    marginTop: 2,
  } as TextStyle,
  evMeta: {
    fontFamily: 'Geist_400Regular',
    fontSize: 12,
    marginTop: 2,
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
    fontFamily: 'Geist_400Regular',
    fontSize: 13.5,
  } as TextStyle,
  sayWrap: {
    alignItems: 'flex-end',
  } as ViewStyle,
  finWrap: {
    width: '100%',
    alignItems: 'center',
  } as ViewStyle,
  finCard: {
    width: '100%',
    maxWidth: 310,
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 2,
  } as ViewStyle,
  finLabel: {
    fontFamily: 'Geist_500Medium',
    fontSize: 12.5,
  } as TextStyle,
  finBal: {
    fontFamily: 'Geist_500Medium',
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
    marginTop: 16,
    marginBottom: 14,
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
    fontFamily: 'Geist_500Medium',
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
    fontFamily: 'Geist_500Medium',
    fontSize: 14.5,
  } as TextStyle,
  botSub: {
    fontFamily: 'Geist_400Regular',
    fontSize: 12,
    marginTop: 1,
  } as TextStyle,
  botCta: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 14,
  } as ViewStyle,
  botCtaText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 12.5,
  } as TextStyle,
})
