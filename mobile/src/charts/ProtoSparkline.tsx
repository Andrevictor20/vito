import React, { useEffect, useRef } from 'react'
import { Animated, Easing, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { token } from '../ds/tokens'
import { computeAreaPath, SUMMARY_LINE_DELAY_MS, SUMMARY_LINE_FADE_MS } from './chartSpecs'

export interface ProtoSparklineProps {
  values: readonly number[]
  width?: number
  height?: number
  color?: string
  isDark?: boolean
  reduceMotion?: boolean
}

/** Cópia fiel de `.rs-ln` / `SPARK` (linha de resumo com fade `rsFade 1s .6s`). */
export const ProtoSparkline: React.FC<ProtoSparklineProps> = ({
  values,
  width = 120,
  height = 36,
  color,
  isDark = false,
  reduceMotion = false,
}) => {
  const geom = computeAreaPath(values, width, height - 4)
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1)
      return
    }
    opacity.setValue(0)
    const anim = Animated.timing(opacity, {
      toValue: 1,
      duration: SUMMARY_LINE_FADE_MS,
      delay: SUMMARY_LINE_DELAY_MS,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    })
    anim.start()
    return () => anim.stop()
  }, [values, reduceMotion, opacity])

  const stroke = color ?? token('--blue', isDark)
  if (!geom.linePath) return <View style={{ width, height }} />

  return (
    <Animated.View style={{ width, height, opacity }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path
          d={geom.linePath}
          fill="none"
          stroke={stroke}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  )
}
