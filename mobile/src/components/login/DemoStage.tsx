import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Platform,
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
import { loginPalette } from './loginPalette'

export interface DemoStageProps {
  onAdvance: () => void
  style?: StyleProp<ViewStyle>
  state?: DemoLoopState
  advanceScene?: () => void
  reduceMotion?: boolean
}

function getWrappedScene(index: number): DemoScene {
  const total = DEMO_SCENES.length
  const normalized = ((index % total) + total) % total
  return DEMO_SCENES[normalized]
}

function estimateSceneHeight(scene: DemoScene): number {
  const userH = scene.photo ? 116 : 44
  const cardH = scene.card.isCol ? 138 : 66
  return userH + 12 + 22 + 10 + cardH + 16
}

/**
 * Palco da demonstração animada em paridade exata com `login-vito.html`:
 * - `.feed` com `overflow: hidden` e degradê superior de 22% da altura do feed
 *   (`mask-image: linear-gradient(transparent, #000 22%)` + `GradientOverlay` SVG),
 *   criando a transição suave entre o título (`HeadlineReel`) e as mensagens empilhadas.
 * - `.inner` ancorado na parte inferior (`bottom: 18px`) mantendo múltiplas trocas
 *   empilhadas simultaneamente (trocas anteriores completas acima + troca ativa embaixo),
 *   de modo que a conversa preenche todo o palco até o degradê abaixo do título.
 * - Quando avança de cena, executa `push(e)`: `translateY(h -> 0)` em `500ms`
 *   `Easing.bezier(0.2, 0.8, 0.2, 1)` enquanto a troca mais antiga no topo faz fade-out (`400ms`).
 */
export const DemoStage: React.FC<DemoStageProps> = ({
  onAdvance,
  style,
  state: externalState,
  advanceScene: externalAdvance,
  reduceMotion: externalReduceMotion,
}) => {
  const { isDark } = useTheme()
  const palette = loginPalette(isDark)
  const internalLoop = useDemoLoop()
  const state = externalState ?? internalLoop.state
  const advanceScene = externalAdvance ?? internalLoop.advanceScene
  const reduceMotion = externalReduceMotion ?? internalLoop.reduceMotion
  const { height: windowHeight } = useWindowDimensions()

  const prevIndexRef = useRef<number>(state.sceneIndex)
  const [exitingScene, setExitingScene] = useState<DemoScene | null>(null)
  const innerTranslateY = useRef(new Animated.Value(0)).current

  const currentScene = DEMO_SCENES[state.sceneIndex]
  const prevScene = getWrappedScene(state.sceneIndex - 1)
  const olderScene = getWrappedScene(state.sceneIndex - 2)

  // Quando o índice da cena muda, empurra a pilha de mensagens para cima (`push(el)`)
  useEffect(() => {
    if (state.sceneIndex !== prevIndexRef.current) {
      const outgoingOldest = getWrappedScene(prevIndexRef.current - 2)
      setExitingScene(outgoingOldest)
      prevIndexRef.current = state.sceneIndex

      if (!reduceMotion) {
        const pushDistance = estimateSceneHeight(DEMO_SCENES[state.sceneIndex])
        innerTranslateY.setValue(pushDistance)
        Animated.timing(innerTranslateY, {
          toValue: 0,
          duration: 500,
          easing: Easing.bezier(0.2, 0.8, 0.2, 1),
          useNativeDriver: true,
        }).start()
      }

      const t = setTimeout(() => {
        setExitingScene(null)
      }, 420)

      return () => clearTimeout(t)
    }
  }, [state.sceneIndex, reduceMotion, innerTranslateY])

  const handlePress = useCallback(() => {
    advanceScene()
    onAdvance()
  }, [advanceScene, onAdvance])

  const gradientHeight = Math.max(88, Math.round(windowHeight * 0.12))

  if (reduceMotion) {
    return (
      <View
        style={[styles.stage, { backgroundColor: palette.bg }, style]}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={styles.feed}>
          <View style={styles.inner}>
            {[olderScene, prevScene, currentScene].map((s) => (
              <DemoExchange
                key={`static-${s.id}`}
                scene={s}
                phase="showing-card"
                userTyped={s.userText}
                userComplete
                vitoVisible
                cardVisible
                dotsVisible={false}
                reduceMotion
              />
            ))}
          </View>
          <GradientOverlay
            height={gradientHeight}
            isDark={isDark}
            pointerEvents="none"
          />
        </View>
      </View>
    )
  }

  return (
    <View
      style={[styles.stage, { backgroundColor: palette.bg }, style]}
      accessible
      accessibilityLabel="Demonstração interativa do Vito. Toque para ver o próximo exemplo."
      importantForAccessibility="yes"
      onStartShouldSetResponder={() => true}
      onResponderGrant={handlePress}
    >
      <View style={styles.feed}>
        <Animated.View
          style={[
            styles.inner,
            { transform: [{ translateY: innerTranslateY }] },
          ]}
        >
          {exitingScene && (
            <DemoExchange
              key={`exiting-${exitingScene.id}`}
              scene={exitingScene}
              phase="showing-card"
              userTyped={exitingScene.userText}
              userComplete
              vitoVisible
              cardVisible
              dotsVisible={false}
              exiting
              reduceMotion
            />
          )}

          <DemoExchange
            key={`older-${olderScene.id}`}
            scene={olderScene}
            phase="showing-card"
            userTyped={olderScene.userText}
            userComplete
            vitoVisible
            cardVisible
            dotsVisible={false}
            reduceMotion
          />

          <DemoExchange
            key={`prev-${prevScene.id}`}
            scene={prevScene}
            phase="showing-card"
            userTyped={prevScene.userText}
            userComplete
            vitoVisible
            cardVisible
            dotsVisible={false}
            reduceMotion
          />

          <DemoExchange
            key={`current-${currentScene.id}`}
            scene={currentScene}
            phase={state.phase}
            userTyped={state.userTyped}
            userComplete={state.userComplete}
            vitoVisible={state.vitoVisible}
            cardVisible={state.cardVisible}
            dotsVisible={state.dotsVisible}
          />
        </Animated.View>

        {/* Degradê entre o título e as mensagens empilhadas */}
        <GradientOverlay
          height={gradientHeight}
          isDark={isDark}
          pointerEvents="none"
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    minHeight: 0,
    marginTop: 2,
  } as ViewStyle,
  feed: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
    overflow: 'hidden',
    paddingHorizontal: 16,
  } as ViewStyle,
  inner: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
    flexDirection: 'column',
    gap: 16,
  } as ViewStyle,
})
