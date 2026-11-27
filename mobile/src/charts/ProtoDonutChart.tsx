import React, { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, G } from 'react-native-svg'
import { MOTION_CURVES } from '../theme/motion'
import { useScreenEnterKey } from '../theme/screenFocusContext'
import { darkColors, lightColors, tabularNumbers } from '../theme/tokens'
import {
  computeDonutSegments,
  DONUT_CIRCUMFERENCE,
  DONUT_R,
  DONUT_SEG_MS,
  DONUT_SIZE,
  DONUT_STAGGER_BASE_MS,
  DONUT_STAGGER_STEP_MS,
  DONUT_STROKE,
  type DonutSliceInput,
} from './chartSpecs'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

export interface ProtoDonutChartProps {
  data: readonly DonutSliceInput[]
  totalLabel: string
  subtitleLabel: string
  isDark?: boolean
  reduceMotion?: boolean
  size?: number
  selectedIndex?: number | null
  onSelectIndex?: (index: number | null) => void
}

const PAL_KEYS = ['blue', 'teal', 'red', 'purple', 'orange'] as const

const AnimatedDonutSegment: React.FC<{
  dashLen: number
  dashOffset: number
  stroke: string
  opacity?: number
  strokeWidth?: number
  delayMs: number
  reduceMotion: boolean
  animKey: string
}> = ({ dashLen, dashOffset, stroke, opacity = 1, strokeWidth = DONUT_STROKE, delayMs, reduceMotion, animKey }) => {
  const progress = useSharedValue(reduceMotion ? 1 : 0)

  useEffect(() => {
    cancelAnimation(progress)
    if (reduceMotion) {
      progress.value = 1
      return
    }
    const [x1, y1, x2, y2] = MOTION_CURVES.q
    progress.value = 0
    progress.value = withDelay(
      delayMs,
      withTiming(1, {
        duration: DONUT_SEG_MS,
        easing: Easing.bezier(x1, y1, x2, y2),
      }),
    )
    return () => cancelAnimation(progress)
  }, [animKey, delayMs, reduceMotion, progress])

  const animatedProps = useAnimatedProps(() => {
    const p = progress.value
    return {
      strokeDasharray: `${(p * dashLen).toFixed(2)} ${DONUT_CIRCUMFERENCE.toFixed(1)}`,
      strokeDashoffset: dashOffset,
    }
  }, [dashLen, dashOffset])

  return (
    <AnimatedCircle
      cx="60"
      cy="60"
      r={DONUT_R}
      fill="none"
      stroke={stroke}
      strokeOpacity={opacity}
      strokeWidth={strokeWidth}
      animatedProps={animatedProps}
    />
  )
}

/** Cópia fiel de `donut(d, c1, c2)` + `.fin-svg-donut` do protótipo (linhas 1220, 4221, 4237). */
export const ProtoDonutChart: React.FC<ProtoDonutChartProps> = ({
  data,
  totalLabel,
  subtitleLabel,
  isDark = false,
  reduceMotion = false,
  size = DONUT_SIZE,
  selectedIndex = null,
  onSelectIndex,
}) => {
  const enterKey = useScreenEnterKey()
  const segments = computeDonutSegments(data)
  const animKey = `${enterKey}|${segments.map((s) => `${s.label}:${s.dashArray[0]}:${s.dashOffset}`).join('|')}`

  const pal = isDark ? darkColors : lightColors
  const lineCol = pal.line
  const inkCol = pal.ink
  const mutedCol = pal.muted

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Circle
          cx="60"
          cy="60"
          r={DONUT_R}
          fill="none"
          stroke={lineCol}
          strokeWidth={DONUT_STROKE}
        />
        <G rotation={-90} origin="60, 60">
          {segments.map((seg, idx) => {
            const stroke = seg.color ?? pal[PAL_KEYS[seg.colorIndex]]
            const hasSel = selectedIndex !== null && selectedIndex !== undefined && selectedIndex >= 0
            const isSel = hasSel && selectedIndex === idx
            return (
              <AnimatedDonutSegment
                key={`${seg.label}-${idx}`}
                dashLen={seg.dashArray[0]}
                dashOffset={seg.dashOffset}
                stroke={stroke}
                opacity={hasSel ? (isSel ? 1 : 0.32) : 1}
                strokeWidth={isSel ? DONUT_STROKE + 2.5 : DONUT_STROKE}
                delayMs={DONUT_STAGGER_BASE_MS + idx * DONUT_STAGGER_STEP_MS}
                reduceMotion={reduceMotion}
                animKey={animKey}
                {...(onSelectIndex ? {} : {})}
              />
            )
          })}
        </G>
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text
          style={[styles.subtitle, { color: mutedCol }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {subtitleLabel}
        </Text>
        <Text
          style={[styles.total, tabularNumbers, { color: inkCol }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {totalLabel}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    marginTop: 6,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  subtitle: {
    fontFamily: 'Geist_500Medium',
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
  total: {
    fontFamily: 'Geist_600SemiBold',
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.4,
    marginTop: 2,
    textAlign: 'center',
  },
})
