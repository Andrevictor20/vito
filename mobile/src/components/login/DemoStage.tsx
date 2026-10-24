import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { DEMO_SCENES, DemoScene } from './demoScenes'
import { GradientOverlay } from './GradientOverlay'
import { useDemoLoop, DemoLoopState } from './useDemoLoop'
import { DemoExchange } from './DemoExchange'
import { useTheme } from '../../context/ThemeContext'

export interface DemoStageProps {
  onAdvance: () => void
  style?: StyleProp<ViewStyle>
  state?: DemoLoopState
  advanceScene?: () => void
  reduceMotion?: boolean
}

/**
 * Palco da demonstração animada (seção 4 do prompt).
 * - flex: 1, conversa ancorada na parte de baixo.
 * - Máximo 2 trocas visíveis; a mais antiga some com fade (400 ms).
 * - Degradê no topo (transparente → opaco nos primeiros 22% da altura).
 * - Toque avança para a próxima cena.
 * - Reduzir movimento: duas trocas estáticas, sem timers.
 */
export const DemoStage: React.FC<DemoStageProps> = ({
  onAdvance,
  style,
  state: externalState,
  advanceScene: externalAdvance,
  reduceMotion: externalReduceMotion,
}) => {
  const { colors, isDark } = useTheme()
  const internalLoop = useDemoLoop()
  const state = externalState ?? internalLoop.state
  const advanceScene = externalAdvance ?? internalLoop.advanceScene
  const reduceMotion = externalReduceMotion ?? internalLoop.reduceMotion
  const { height: windowHeight } = useWindowDimensions()

  const prevIndexRef = useRef<number>(state.sceneIndex)
  const [exiting, setExiting] = useState(false)
  const [prevScene, setPrevScene] = useState<DemoScene | null>(null)

  // Quando o índice da cena muda, marca a troca anterior como saindo (fade-out 400 ms).
  useEffect(() => {
    if (state.sceneIndex !== prevIndexRef.current) {
      setPrevScene(DEMO_SCENES[prevIndexRef.current])
      setExiting(true)
      prevIndexRef.current = state.sceneIndex
      const t = setTimeout(() => setExiting(false), 400)
      return () => clearTimeout(t)
    }
  }, [state.sceneIndex])

  const containerStyle = useMemo(
    () => ({
      flex: 1,
      backgroundColor: colors.bg,
      ...style,
    }),
    [colors.bg, style],
  )

  // Degradê topo: transparente → opaco nos primeiros 22% da altura.
  // Usa GradientOverlay (JS-puro, sem dependência nativa).

  const handlePress = useCallback(() => {
    advanceScene()
    onAdvance()
  }, [advanceScene, onAdvance])

  if (reduceMotion) {
    return (
      <Animated.View
        style={containerStyle}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={styles.feed}>
          {DEMO_SCENES.slice(0, 2).map((s) => (
            <DemoExchange
              key={s.id}
              scene={s}
              phase="showing-card"
              userTyped={s.userText}
              userComplete
              vitoVisible
              cardVisible
              dotsVisible={false}
            />
          ))}
        </View>
      </Animated.View>
    )
  }

  const currentScene = DEMO_SCENES[state.sceneIndex]

  return (
    <Animated.View
      style={containerStyle}
      accessible
      accessibilityLabel="Exemplos do que o Vito faz: marcar compromissos, criar radares de preço, rascunhar respostas no WhatsApp e transformar fotos de boletos em tarefas"
      importantForAccessibility="yes"
      onStartShouldSetResponder={() => true}
      onResponderGrant={handlePress}
    >
      <GradientOverlay
        height={windowHeight * 0.22}
        isDark={isDark}
        opacity={0.9}
        pointerEvents="none"
        style={styles.gradientTop}
      />
      <View style={styles.feed}>
        {prevScene && exiting && (
          <DemoExchange
            key="prev"
            scene={prevScene}
            phase="showing-card"
            userTyped={prevScene.userText}
            userComplete
            vitoVisible
            cardVisible
            dotsVisible={false}
            exiting
          />
        )}
        <DemoExchange
          key={`scene-${state.sceneIndex}`}
          scene={currentScene}
          phase={state.phase}
          userTyped={state.userTyped}
          userComplete={state.userComplete}
          vitoVisible={state.vitoVisible}
          cardVisible={state.cardVisible}
          dotsVisible={state.dotsVisible}
        />
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  gradientTop: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
  },
  feed: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 18,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
})
