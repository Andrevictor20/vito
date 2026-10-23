import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  Animated,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native'
import { DEMO_SCENES, DemoScene } from './demoScenes'
import { DemoPhase, DemoLoopState } from './demoMachine'
import { DemoUserBubble } from './DemoUserBubble'
import { DemoVitoResponse } from './DemoVitoResponse'
import { DemoActionCard } from './DemoActionCard'
import { useTheme } from '../../context/ThemeContext'

export interface DemoExchangeProps {
  scene: DemoScene
  phase: DemoPhase
  userTyped: string
  userComplete: boolean
  vitoVisible: boolean
  cardVisible: boolean
  dotsVisible: boolean
  /** Quando verdadeiro, a troca está saindo (fade-out + subida). */
  exiting?: boolean
}

/**
 * Uma troca completa da demonstração:
 * - Bolha do usuário à direita
 * - Resposta do Vito como texto fluido à esquerda (SEM balão)
 * - Card de ação à esquerda
 */
export const DemoExchange: React.FC<DemoExchangeProps> = ({
  scene,
  phase,
  userTyped,
  userComplete,
  vitoVisible,
  cardVisible,
  dotsVisible,
  exiting = false,
}) => {
  const { colors } = useTheme()

  const opacity = useRef(new Animated.Value(exiting ? 0 : 1)).current
  const translateY = useRef(new Animated.Value(exiting ? -30 : 0)).current

  // Animação de saída: fade-out + subida suave (400 ms).
  useEffect(() => {
    if (!exiting) return
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -50,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start()
  }, [exiting, opacity, translateY])

  const showUser = phase !== 'showing-user'

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity, transform: [{ translateY }] },
        exiting && { pointerEvents: 'none' as const },
      ]}
    >
      {showUser && (
        <View style={styles.userRow}>
          <DemoUserBubble
            text={scene.userText}
            typed={userTyped}
            complete={userComplete}
            photo={Boolean(scene.photo)}
            colors={colors}
          />
        </View>
      )}
      {vitoVisible && (
        <View style={styles.vitoRow}>
          <DemoVitoResponse
            text={scene.vitoText}
            visible={vitoVisible}
            dots={dotsVisible}
            colors={colors}
          />
        </View>
      )}
      {cardVisible && (
        <View style={styles.cardRow}>
          <DemoActionCard scene={scene} colors={colors} />
        </View>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    gap: 8,
    width: '100%',
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
  },
  vitoRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    width: '100%',
    alignItems: 'flex-start',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    width: '100%',
    alignItems: 'flex-start',
  },
})
