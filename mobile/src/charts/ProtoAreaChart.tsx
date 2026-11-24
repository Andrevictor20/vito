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
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg'
import { getBezier, token } from '../ds/tokens'
import {
  AREA_DRAW_DELAY_MS,
  AREA_DRAW_MS,
  AREA_FILL_DELAY_MS,
  AREA_FILL_MS,
  computeAreaPath,
  DOT_POP_DELAY_MS,
  DOT_POP_MS,
} from './chartSpecs'

const AnimatedPath = Animated.createAnimatedComponent(Path)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

export interface ProtoAreaChartProps {
  values: readonly number[]
  labels?: readonly string[]
  isDark?: boolean
  reduceMotion?: boolean
  height?: number
}

/** Cópia fiel de `area(p)` + `.fin-svg-area` (linhas 1222–1224, 4254–4262). */
export const ProtoAreaChart: React.FC<ProtoAreaChartProps> = ({
  values,
  labels,
  isDark = false,
  reduceMotion = false,
  height = 140,
}) => {
  const W = 320
  const H = 120
  const geom = computeAreaPath(values, W, H)

  const lineProg = useSharedValue(reduceMotion ? 0 : geom.approxLength)
  const fillFade = useSharedValue(reduceMotion ? 1 : 0)
  const dotProg = useSharedValue(reduceMotion ? 1 : 0)

  useEffect(() => {
    cancelAnimation(lineProg)
    cancelAnimation(fillFade)
    cancelAnimation(dotProg)

    if (reduceMotion) {
      lineProg.value = 0
      fillFade.value = 1
      dotProg.value = 1
      return
    }
    const [x1, y1, x2, y2] = getBezier('--ease-q')
    lineProg.value = geom.approxLength
    fillFade.value = 0
    dotProg.value = 0

    lineProg.value = withDelay(
      AREA_DRAW_DELAY_MS,
      withTiming(0, {
        duration: AREA_DRAW_MS,
        easing: Easing.bezier(x1, y1, x2, y2),
      }),
    )
    fillFade.value = withDelay(
      AREA_FILL_DELAY_MS,
      withTiming(1, {
        duration: AREA_FILL_MS,
        easing: Easing.out(Easing.ease),
      }),
    )
    dotProg.value = withDelay(
      DOT_POP_DELAY_MS,
      withTiming(1, {
        duration: DOT_POP_MS,
        easing: Easing.bezier(0.34, 1.56, 0.64, 1),
      }),
    )
    return () => {
      cancelAnimation(lineProg)
      cancelAnimation(fillFade)
      cancelAnimation(dotProg)
    }
  }, [values, reduceMotion, geom.approxLength, lineProg, fillFade, dotProg])

  const fillAnimatedProps = useAnimatedProps(() => ({
    opacity: fillFade.value,
  }))

  const lineAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: lineProg.value,
  }))

  const dotAnimatedProps = useAnimatedProps(() => ({
    r: interpolate(dotProg.value, [0, 1], [0, 4.5], Extrapolation.CLAMP),
    opacity: dotProg.value,
  }))

  const acc = token('--acc', isDark)
  const greenBg = token('--green-bg', isDark)
  const lineCol = token('--line', isDark)
  const mutedCol = token('--muted', isDark)

  return (
    <View style={{ width: '100%' }}>
      <Svg width="100%" height={height} viewBox={`0 -10 ${W} ${H + 34}`}>
        {geom.fillPath ? (
          <AnimatedPath d={geom.fillPath} fill={greenBg} animatedProps={fillAnimatedProps} />
        ) : null}
        {geom.linePath ? (
          <AnimatedPath
            d={geom.linePath}
            fill="none"
            stroke={acc}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={[geom.approxLength, geom.approxLength]}
            animatedProps={lineAnimatedProps}
          />
        ) : null}
        <Line x1="8" x2={W - 8} y1={H} y2={H} stroke={lineCol} />
        {geom.lastPoint ? (
          <AnimatedCircle
            cx={geom.lastPoint.x}
            cy={geom.lastPoint.y}
            fill={acc}
            animatedProps={dotAnimatedProps}
          />
        ) : null}
        {geom.points.map((pt, i) => {
          const step = geom.points.length > 7 ? 2 : 1
          if (i % step !== 0) return null
          const labelX = Math.max(14, Math.min(W - 14, pt.x))
          return (
            <SvgText
              key={i}
              x={labelX}
              y={H + 16}
              textAnchor="middle"
              fontSize="10"
              fontFamily="Geist"
              fill={mutedCol}
            >
              {labels?.[i] ?? `${i}m`}
            </SvgText>
          )
        })}
      </Svg>
    </View>
  )
}
