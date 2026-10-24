import React, { useEffect, useRef } from 'react'
import {
  Animated,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native'
import type { DemoScene } from './demoScenes'
import type { DemoPhase } from './demoMachine'
import { DemoUserBubble } from './DemoUserBubble'
import { DemoVitoResponse } from './DemoVitoResponse'
import { DemoActionCard } from './DemoActionCard'

export interface DemoExchangeProps {
  scene: DemoScene
  phase: DemoPhase
  userTyped: string
  userComplete: boolean
  vitoVisible: boolean
  cardVisible: boolean
  dotsVisible: boolean
  exiting?: boolean
  reduceMotion?: boolean
}

/**
 * Uma troca completa da demonstração (bolha do usuário + resposta do Vito + card de ação)
 * .exch{display:flex;flex-direction:column;gap:12px;transition:opacity .4s}
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
  reduceMotion = false,
}) => {
  const opacity = useRef(new Animated.Value(exiting ? 0 : 1)).current

  useEffect(() => {
    if (exiting) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start()
    } else {
      opacity.setValue(1)
    }
  }, [exiting, opacity])

  const showUser = phase !== 'showing-user'

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity },
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
          />
        </View>
      )}

      {(vitoVisible || dotsVisible) && (
        <View style={styles.vitoRow}>
          <DemoVitoResponse
            text={scene.vitoText}
            visible={vitoVisible}
            dots={dotsVisible}
          />
        </View>
      )}

      {cardVisible && (
        <View style={styles.cardRow}>
          <DemoActionCard scene={scene} reduceMotion={reduceMotion} />
        </View>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    gap: 12,
    width: '100%',
  } as ViewStyle,
  userRow: {
    width: '100%',
  } as ViewStyle,
  vitoRow: {
    width: '100%',
    minHeight: 24,
  } as ViewStyle,
  cardRow: {
    width: '100%',
  } as ViewStyle,
})
