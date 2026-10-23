import React, { useMemo } from 'react'
import {
  StyleSheet,
  View,
  Text,
  type ViewStyle,
  type TextStyle,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import Svg, { Path } from 'react-native-svg'
import { DEMO_SCENES, DemoScene } from './demoScenes'
import { useTheme } from '../../context/ThemeContext'
import { type ThemeTokens } from '../../theme/tokens'

type Trailing = 'check' | 'chart' | 'pills' | 'tag'

export interface DemoActionCardProps {
  scene: DemoScene
  colors: ThemeTokens['colors']
}

const CHIP_COLORS: Record<
  DemoScene['card']['kind'],
  { bg: string; icon: string }
> = {
  agenda: { bg: '#E4EFFB', icon: '#2B7FD4' }, // azul
  radar: { bg: '#FBEBDB', icon: '#E07A2A' }, // laranja
  tarefa: { bg: '#DDF4E8', icon: '#1FB97A' }, // verde
  boleto: { bg: '#DDF4E8', icon: '#1FB97A' }, // verde (check)
}

const ICON_BY_KIND: Record<DemoScene['card']['kind'], string> = {
  agenda: 'event',
  radar: 'blur-on', // MaterialIcons não tem 'radar'; usa ícone próximo
  tarefa: 'check-circle',
  boleto: 'check-circle',
}

export const DemoActionCard: React.FC<DemoActionCardProps> = ({
  scene,
  colors,
}) => {
  const card = scene.card
  const chip = CHIP_COLORS[card.kind]
  const iconName = ICON_BY_KIND[card.kind]

  return (
    <View
      style={[
        styles.card,
        { borderColor: colors.outlineVariant, backgroundColor: colors.bg },
      ]}
    >
      <View style={[styles.chip, { backgroundColor: chip.bg }]}>
        <MaterialIcons name={iconName as any} size={20} color={chip.icon} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.onSurface }]}>
          {card.title}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {card.subtitle}
        </Text>
      </View>
      <View style={styles.trailing}>{renderTrailing(card.trailing, colors)}</View>
    </View>
  )
}

function renderTrailing(kind: Trailing, colors: ThemeTokens['colors']) {
  switch (kind) {
    case 'check':
      return (
        <View style={styles.checkWrap}>
          <MaterialIcons name="check" size={22} color={colors.success} />
        </View>
      )
    case 'chart':
      return (
        <View style={styles.chartWrap}>
          <LineChartMini />
        </View>
      )
    case 'pills':
      return (
        <View style={styles.pillsRow}>
          <View style={[styles.pill, { borderColor: colors.onSurface }]}>
            <Text style={[styles.pillText, { color: colors.onSurface }]}>
              Enviar
            </Text>
          </View>
          <View style={[styles.pill, { borderWidth: 1, borderColor: colors.onSurface }]}>
            <Text style={[styles.pillText, { color: colors.onSurface }]}>
              Editar
            </Text>
          </View>
        </View>
      )
    case 'tag':
      return (
        <View style={[styles.tag, { borderColor: colors.success }]}>
          <Text style={[styles.tagText, { color: '#1FB97A' }]}>Tarefa</Text>
        </View>
      )
  }
}

function LineChartMini() {
  return (
    <Svg width={44} height={22} viewBox="0 0 44 22" fill="none">
      <Path
        d="M2 4l9 3 8 6 8-2 7 6 8 1"
        stroke="#E07A2A"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  } as ViewStyle,
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
    fontWeight: '600',
    lineHeight: 20,
  } as TextStyle,
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    marginTop: 2,
  } as TextStyle,
  trailing: {
    alignItems: 'center',
    flexShrink: 0,
  } as ViewStyle,
  checkWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  chartWrap: {
    width: 44,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  pillsRow: {
    flexDirection: 'row',
    gap: 6,
  } as ViewStyle,
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  } as ViewStyle,
  pillText: {
    fontSize: 12,
    fontWeight: '600',
  } as TextStyle,
  tag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  } as ViewStyle,
  tagText: {
    fontSize: 11.5,
    fontWeight: '600',
  } as TextStyle,
})
