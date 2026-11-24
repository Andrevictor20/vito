import React, { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg'
import { getBezier, token } from '../ds/tokens'
import { useScreenEnterKey } from '../theme/screenFocusContext'
import { BAR_RISE_MS, computeBarRects } from './chartSpecs'

const AnimatedRect = Animated.createAnimatedComponent(Rect)

export interface ProtoBarsChartProps {
  values: readonly number[]
  labels?: Array<[number, string]>
  highlightIndex?: number
  avg?: number
  isDark?: boolean
  reduceMotion?: boolean
  height?: number
}

const AnimatedBarRect: React.FC<{
  x: number
  y: number
  width: number
  barHeight: number
  chartHeight: number
  delayMs: number
  fill: string
  opacity: number
  reduceMotion: boolean
  animKey: string
}> = ({
  x,
  y,
  width,
  barHeight,
  chartHeight,
  delayMs,
  fill,
  opacity,
  reduceMotion,
  animKey,
}) => {
  const progress = useSharedValue(reduceMotion ? 1 : 0)

  useEffect(() => {
    cancelAnimation(progress)
    if (reduceMotion) {
      progress.value = 1
      return
    }
    const [x1, y1, x2, y2] = getBezier('--ease-q')
    progress.value = 0
    progress.value = withDelay(
      delayMs,
      withTiming(1, {
        duration: BAR_RISE_MS,
        easing: Easing.bezier(x1, y1, x2, y2),
      }),
    )
    return () => cancelAnimation(progress)
  }, [animKey, delayMs, reduceMotion, progress])

  const animatedProps = useAnimatedProps(() => ({
    y: interpolate(progress.value, [0, 1], [chartHeight, y], Extrapolation.CLAMP),
    height: interpolate(progress.value, [0, 1], [0, barHeight], Extrapolation.CLAMP),
  }), [chartHeight, y, barHeight])

  return (
    <AnimatedRect
      x={x}
      width={width}
      rx={3}
      fill={fill}
      opacity={opacity}
      animatedProps={animatedProps}
    />
  )
}

/** Cópia fiel de `bars(v, lab, o)` + `.fin-svg-bars` (linhas 1219, 4242–4248). */
export const ProtoBarsChart: React.FC<ProtoBarsChartProps> = ({
  values,
  labels = [],
  highlightIndex,
  avg,
  isDark = false,
  reduceMotion = false,
  height = 128,
}) => {
  const W = 320
  const H = 110
  const enterKey = useScreenEnterKey()
  const { rects, max } = computeBarRects(values, W, H, highlightIndex)
  const animKey = `${enterKey}|${values.join(',')}`

  const orange = token('--orange', isDark)
  const fin = token('--fin', isDark)
  const muted = token('--muted', isDark)
  const lineCol = token('--line', isDark)
  const bw = values.length > 0 ? W / values.length : W
  const avgY = avg !== undefined ? H - (avg / max) * H : null

  return (
    <View style={{ width: '100%' }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${W} ${H + 22}`}>
        <Line x1="0" x2={W} y1={H} y2={H} stroke={lineCol} strokeWidth={1} />
        {rects.map((r, idx) =>
          r.height > 0 ? (
            <AnimatedBarRect
              key={idx}
              x={r.x}
              y={r.y}
              width={r.width}
              barHeight={r.height}
              chartHeight={H}
              delayMs={r.delayMs}
              fill={r.highlighted ? orange : fin}
              opacity={r.highlighted ? 1 : 0.7}
              reduceMotion={reduceMotion}
              animKey={animKey}
            />
          ) : null,
        )}
        {avgY !== null ? (
          <>
            <Line
              x1="0"
              x2={W}
              y1={avgY}
              y2={avgY}
              stroke={muted}
              strokeDasharray="4 4"
            />
            <SvgText
              x={W - 2}
              y={Math.max(11, avgY - 4)}
              textAnchor="end"
              fontSize="9.5"
              fontFamily="Geist_500Medium"
              fill={muted}
            >
              média
            </SvgText>
          </>
        ) : null}
        {labels.map(([idx, lbl], i) => {
          const lx = Math.max(12, Math.min(W - 12, idx * bw + bw / 2))
          return (
            <SvgText
              key={i}
              x={lx}
              y={H + 15}
              textAnchor="middle"
              fontSize="10"
              fontFamily="Geist"
              fill={muted}
            >
              {lbl}
            </SvgText>
          )
        })}
      </Svg>
    </View>
  )
}
