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
import { getBezier, token } from '../ds/tokens'
import { useScreenFocus } from '../theme/screenFocusContext'
import { CountUpText } from '../theme/vitoMotion'
import { TK_RING_R, TK_RING_SIZE } from './chartSpecs'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

export interface ProtoRingChartProps {
  pct: number
  size?: number
  strokeWidth?: number
  color?: string
  trackColor?: string
  label?: string
  subtitle?: string
  labelSize?: number
  animateLabel?: boolean
  durationMs?: number
  delayMs?: number
  replayKey?: number
  isDark?: boolean
  reduceMotion?: boolean
}

/** Cópia fiel de `.tk-ring` / `.fx-ring` / `.rs-rg` (progresso circular via stroke-dashoffset). */
export const ProtoRingChart: React.FC<ProtoRingChartProps> = ({
  pct,
  size = TK_RING_SIZE,
  strokeWidth = 5,
  color,
  trackColor,
  label,
  subtitle,
  labelSize,
  animateLabel = false,
  durationMs = 760,
  delayMs = 100,
  replayKey = 0,
  isDark = false,
  reduceMotion = false,
}) => {
  const { active, enterCount } = useScreenFocus()
  const clamped = Math.max(0, Math.min(100, pct))
  const c = size / 2
  const r = size === TK_RING_SIZE ? TK_RING_R : c - strokeWidth / 2 - 2
  const circ = 2 * Math.PI * r
  const targetOffset = circ * (1 - clamped / 100)

  const dashOffset = useSharedValue(reduceMotion ? targetOffset : circ)

  useEffect(() => {
    cancelAnimation(dashOffset)
    if (reduceMotion) {
      dashOffset.value = targetOffset
      return
    }
    if (!active) {
      dashOffset.value = circ
      return
    }
    const [x1, y1, x2, y2] = getBezier('--ease-q')
    dashOffset.value = circ
    const anim = withTiming(targetOffset, {
      duration: durationMs,
      easing: Easing.bezier(x1, y1, x2, y2),
    })
    dashOffset.value = delayMs > 0 ? withDelay(delayMs, anim) : anim
    return () => cancelAnimation(dashOffset)
  }, [targetOffset, circ, durationMs, delayMs, reduceMotion, active, enterCount, replayKey, dashOffset])

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }))

  const track = trackColor ?? token('--line', isDark)
  const fg = color ?? token('--acc', isDark)
  const ink = token('--ink', isDark)
  const muted = token('--muted', isDark)
  const fontSize = labelSize ?? (size >= 96 ? 22 : size >= 64 ? 15 : 12.5)

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G rotation={-90} origin={`${c}, ${c}`}>
          <Circle cx={c} cy={c} r={r} fill="none" stroke={track} strokeWidth={strokeWidth} />
          <AnimatedCircle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={fg}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={[circ, circ]}
            animatedProps={animatedProps}
          />
        </G>
      </Svg>
      {label !== undefined || animateLabel ? (
        <View style={styles.center}>
          {animateLabel ? (
            <CountUpText
              value={Math.round(clamped)}
              suffix="%"
              delayMs={delayMs}
              durationMs={durationMs}
              replayKey={replayKey}
              style={[styles.label, { color: ink, fontSize }]}
            />
          ) : (
            <Text style={[styles.label, { color: ink, fontSize }]}>{label}</Text>
          )}
          {subtitle ? (
            <Text style={[styles.subtitle, { color: muted }]}>{subtitle}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: 'Geist_500Medium',
    fontWeight: '600',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  subtitle: {
    fontFamily: 'Geist_500Medium',
    fontSize: 11,
    marginTop: 2,
  },
})
