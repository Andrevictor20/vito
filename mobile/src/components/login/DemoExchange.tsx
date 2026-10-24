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
 * em paridade exata com `exch(s, show)` de `login-vito.html`:
 * - `.exch{display:flex;flex-direction:column;gap:12px;transition:opacity .4s}`
 * - Mantém `.user`, `.vito` e `.card` sempre montados no fluxo (com `opacity: 0` enquanto
 *   aguardam sua vez), reservando a altura total da troca desde o frame 0 para que o
 *   empurrão (`push`) posicione as mensagens anteriores suavemente sob o degradê do topo.
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
  const opacity = useRef(new Animated.Value(1)).current

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
      <View style={styles.userRow}>
        <DemoUserBubble
          text={scene.userText}
          typed={userTyped}
          complete={userComplete}
          photo={Boolean(scene.photo)}
          visible={showUser}
          reduceMotion={reduceMotion}
        />
      </View>

      <View style={styles.vitoBlock}>
        <DemoVitoResponse
          text={scene.vitoText}
          visible={vitoVisible}
          dots={dotsVisible}
          reduceMotion={reduceMotion}
        />

        <DemoActionCard
          scene={scene}
          visible={cardVisible}
          reduceMotion={reduceMotion}
        />
      </View>
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
  vitoBlock: {
    width: '100%',
  } as ViewStyle,
})
