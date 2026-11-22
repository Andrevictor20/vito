import React, { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, View } from 'react-native'
import Svg, { G, Path, Rect } from 'react-native-svg'
import { useTheme } from '../../context/ThemeContext'

export type LoginMascotState = 'gentleman' | 'blink' | 'idle' | 'happy'

export interface LoginMascotRigProps {
  size?: number
  state?: LoginMascotState
  speed?: number
  animated?: boolean
  isDarkOverride?: boolean
}

const LEFT_ARM_FILL =
  'M 53 372 C 41 360, 35 345, 35 329 A 36 43 0 0 1 71 286 A 30 25 0 0 1 101 311 A 18 17 0 0 1 83 328 C 78 342, 78 350, 88 354 A 40 45 0 0 0 53 372 Z'
const RIGHT_ARM_FILL =
  'M 447 372 C 459 360, 465 345, 465 329 A 36 43 0 0 0 429 286 A 30 25 0 0 0 399 311 A 18 17 0 0 0 417 328 C 422 342, 422 350, 412 354 A 40 45 0 0 1 447 372 Z'
const BODY_FILL =
  'M 88 354 C 122 354, 141.8 325.8, 126 301 A 147 147 0 1 1 374 301 C 358.2 325.8, 378 354, 412 354 A 40 45 0 0 1 452 399 A 52 53 0 0 1 400 452 C 380 452, 362 447, 351 434 A 53 53 0 0 1 303 465 A 53 53 0 0 1 250 412 A 53 53 0 0 1 197 465 A 53 53 0 0 1 149 434 C 138 447, 120 452, 100 452 A 52 53 0 0 1 48 399 A 40 45 0 0 1 88 354 Z'

const STROKE_PATHS = [
  'M 53 372 C 41 360, 35 345, 35 329 A 36 43 0 0 1 71 286 A 30 25 0 0 1 101 311 A 18 17 0 0 1 83 328 A 13 14 0 0 1 70 314',
  'M 447 372 C 459 360, 465 345, 465 329 A 36 43 0 0 0 429 286 A 30 25 0 0 0 399 311 A 18 17 0 0 0 417 328 A 13 14 0 0 0 430 314',
  'M 88 354 C 122 354, 141.8 325.8, 126 301 A 147 147 0 1 1 374 301 C 358.2 325.8, 378 354, 412 354',
  'M 149 434 C 138 447, 120 452, 100 452 A 52 53 0 0 1 48 399 A 40 45 0 0 1 88 354 A 29 31 0 0 1 117 385 A 21 27 0 0 1 96 412 A 17 17 0 0 1 79 395 A 8 11 0 0 1 86 384',
  'M 351 434 C 362 447, 380 452, 400 452 A 52 53 0 0 0 452 399 A 40 45 0 0 0 412 354 A 29 31 0 0 0 383 385 A 21 27 0 0 0 404 412 A 17 17 0 0 0 421 395 A 8 11 0 0 0 414 384',
  'M 250 368 L 250 412 A 53 53 0 0 1 197 465 A 53 53 0 0 1 144 412 A 42 45 0 0 1 186 367 A 34 32 0 0 1 220 399 A 24 27 0 0 1 196 426 A 21 20 0 0 1 175 406 A 8 12 0 0 1 183 394',
  'M 250 368 L 250 412 A 53 53 0 0 0 303 465 A 53 53 0 0 0 356 412 A 42 45 0 0 0 314 367 A 34 32 0 0 0 280 399 A 24 27 0 0 0 304 426 A 21 20 0 0 0 325 406 A 8 12 0 0 0 317 394',
]

/**
 * Rig vetorial 500x500 canonico v5 para Splash (#vsplash), Onboarding (#vonb) e Topbar de Login.
 * Implementa state-gentleman (hat tip + nod + wink + bowtie wiggle) e state-blink com suporte a speed e ReduceMotion.
 */
export const LoginMascotRig: React.FC<LoginMascotRigProps> = ({
  size = 140,
  state = 'gentleman',
  speed = 1,
  animated = true,
  isDarkOverride,
}) => {
  const { isDark: themeIsDark } = useTheme()
  const isDark = isDarkOverride ?? themeIsDark

  const fill = isDark ? '#0a0a0a' : '#ffffff'
  const stroke = isDark ? '#f5f5f5' : '#0a0a0a'
  const eyes = isDark ? '#f5f5f5' : '#0a0a0a'
  const hat = isDark ? '#f5f5f5' : '#0a0a0a'
  const band = isDark ? '#0a0a0a' : '#ffffff'
  const bowtie = isDark ? '#2dd17f' : '#0aa55c'

  const phase = useRef(new Animated.Value(0)).current
  const [t, setT] = useState(0)
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => setReduceMotion(v))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const sub = phase.addListener(({ value }) => setT(value))
    return () => phase.removeListener(sub)
  }, [phase])

  useEffect(() => {
    if (!animated || reduceMotion) {
      phase.setValue(0)
      return
    }
    const baseMs = state === 'gentleman' ? 3000 : state === 'blink' ? 3600 : 3200
    const duration = Math.max(600, Math.round(baseMs / Math.max(0.25, speed)))
    const loop = Animated.loop(
      Animated.timing(phase, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    )
    loop.start()
    return () => loop.stop()
  }, [animated, reduceMotion, state, speed, phase])

  // Interpolacoes fieis aos keyframes do prototipo HTML (0..1)
  let wholeY = 0
  let wholeRot = 0
  let hatX = 0
  let hatY = 0
  let hatRot = 0
  let leftEyeScaleY = 1
  let rightEyeScaleY = 1
  let bowRot = 0
  let bowScale = 1

  if (state === 'gentleman') {
    const wave = Math.sin(Math.max(0, Math.min(1, (t - 0.18) / 0.64)) * Math.PI)
    const active = t >= 0.18 && t <= 0.82 ? wave : 0
    wholeY = 4 * active
    wholeRot = 2.5 * active
    hatX = 16 * active
    hatY = -25 * active
    hatRot = 21 * active
    rightEyeScaleY = t >= 0.28 && t <= 0.64 ? 0.08 : 1
    bowRot = Math.sin(active * Math.PI * 3) * 7
    bowScale = 1 + 0.06 * active
  } else if (state === 'blink') {
    const isBlink = (t >= 0.44 && t <= 0.5) || (t >= 0.78 && t <= 0.84)
    leftEyeScaleY = isBlink ? 0.06 : 1
    rightEyeScaleY = isBlink ? 0.06 : 1
  } else if (state === 'idle') {
    const floatWave = Math.sin(t * Math.PI * 2) * 0.5 + 0.5
    wholeY = -9 * floatWave
    hatY = -3.5 * floatWave
    hatRot = 1.6 * floatWave
    const isBlink = t >= 0.45 && t <= 0.51
    leftEyeScaleY = isBlink ? 0.06 : 1
    rightEyeScaleY = isBlink ? 0.06 : 1
  }

  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden>
      <Svg width={size} height={size} viewBox="0 0 500 500">
        <G transform={`translate(250 280) translate(0 ${wholeY}) rotate(${wholeRot}) translate(-250 -280)`}>
          <G>
            <Path d={LEFT_ARM_FILL} fill={fill} />
            <Path d={RIGHT_ARM_FILL} fill={fill} />
            <Path d={BODY_FILL} fill={fill} />
            {STROKE_PATHS.map((d, idx) => (
              <Path
                key={idx}
                d={d}
                fill="none"
                stroke={stroke}
                strokeWidth={16.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </G>

          <G transform={`translate(250 316) rotate(${bowRot}) scale(${bowScale}) translate(-250 -316)`}>
            <Path
              d="M 211 299 C 211 295, 215 293, 219 295 L 244 307 L 244 325 L 219 337 C 215 339, 211 337, 211 333 Z"
              fill={bowtie}
            />
            <Path
              d="M 289 299 C 289 295, 285 293, 281 295 L 256 307 L 256 325 L 281 337 C 285 339, 289 337, 289 333 Z"
              fill={bowtie}
            />
            <Rect x={239} y={304} width={22} height={24} rx={7} fill={bowtie} />
          </G>

          {state === 'happy' ? (
            <G fill="none" stroke={eyes} strokeWidth={18} strokeLinecap="round">
              <Path d="M 190 220 C 198 194, 220 194, 228 220" />
              <Path d="M 272 220 C 280 194, 302 194, 310 220" />
            </G>
          ) : (
            <G>
              <G transform={`translate(209 211.5) scale(1 ${leftEyeScaleY}) translate(-209 -211.5)`}>
                <Rect x={195} y={176} width={28} height={71} rx={14} fill={eyes} />
              </G>
              <G transform={`translate(291 211.5) scale(1 ${rightEyeScaleY}) translate(-291 -211.5)`}>
                <Rect x={277} y={176} width={28} height={71} rx={14} fill={eyes} />
              </G>
            </G>
          )}

          <G transform={`translate(332 104) translate(${hatX} ${hatY}) rotate(${hatRot}) translate(-332 -104)`}>
            <G transform="translate(332, 92) rotate(27.5)">
              <Rect x={-42} y={-64} width={84} height={66} rx={22} fill={hat} stroke={hat} strokeWidth={8} />
              <Rect x={-33} y={-18} width={66} height={14} rx={2} fill={band} />
              <Path d="M -64 -2 Q 0 11 64 -2" fill="none" stroke={hat} strokeWidth={15} strokeLinecap="round" />
            </G>
          </G>
        </G>
      </Svg>
    </View>
  )
}
