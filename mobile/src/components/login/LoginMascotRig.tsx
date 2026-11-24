import React from 'react'
import { View } from 'react-native'
import { MascotVectorRig } from '../mascot/MascotVectorRig'

export type LoginMascotState = 'gentleman' | 'blink' | 'idle' | 'happy'

export interface LoginMascotRigProps {
  size?: number
  state?: LoginMascotState
  speed?: number
  animated?: boolean
  isDarkOverride?: boolean
}

/**
 * Rig vetorial 500x500 canônico para Splash (#vsplash), Onboarding (#vonb) e Login.
 * Delega para MascotVectorRig (Reanimated 4 UI thread + Skia GPU em nativo),
 * respeitando speed, animated e ReduceMotion sem re-render por frame na JS thread.
 */
export const LoginMascotRig: React.FC<LoginMascotRigProps> = ({
  size = 140,
  state = 'gentleman',
  speed = 1,
  animated = true,
  isDarkOverride,
}) => (
  <View style={{ width: size, height: size }} accessibilityElementsHidden>
    <MascotVectorRig
      size={size}
      state={state}
      speed={speed}
      animated={animated}
      darkStage={isDarkOverride}
    />
  </View>
)
