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

/**
 * Palco da demonstração animada em paridade exata com login-vito.html:
 * - flex: 1, cursor pointer / toque avança para a próxima cena.
 * - .feed com overflow:hidden e degradê suave no topo (as mensagens antigas somem suavemente).
 * - .inner ancorado na parte inferior com gap de 16px.
 * - Quando uma nova cena entra, o container executa uma transição física de subida
 *   suave com Easing.bezier(0.2, 0.8, 0.2, 1) em 500ms, empurrando a troca anterior para cima.
 * - A troca anterior desaparece com fade-out suave em 400ms.
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
  const [exiting, setExiting] = useState(false)
  const [prevScene, setPrevScene] = useState<DemoScene | null>(null)

  const innerTranslateY = useRef(new Animated.Value(0)).current

  // Quando o índice da cena muda, executa o empurrão suave (push) da conversa para cima
  useEffect(() => {
    if (state.sceneIndex !== prevIndexRef.current) {
      setPrevScene(DEMO_SCENES[prevIndexRef.current])
      setExiting(true)
      prevIndexRef.current = state.sceneIndex

      if (!reduceMotion) {
        // Empurrão físico suave: translateY +90 -> 0 com bezier cúbico (500ms)
        innerTranslateY.setValue(90)
        Animated.timing(innerTranslateY, {
          toValue: 0,
          duration: 500,
          easing: Easing.bezier(0.2, 0.8, 0.2, 1),
          useNativeDriver: true,
        }).start()
      }

      const t = setTimeout(() => {
        setExiting(false)
        setPrevScene(null)
      }, 420)

      return () => clearTimeout(t)
    }
  }, [state.sceneIndex, reduceMotion, innerTranslateY])

  const handlePress = useCallback(() => {
    advanceScene()
    onAdvance()
  }, [advanceScene, onAdvance])

  // Na Web, aplica máscara CSS nativa de linear-gradient para o desvanecimento perfeito
  const webMaskStyle: ViewStyle = useMemo(() => {
    if (Platform.OS === 'web') {
      return {
        WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000000 22%)',
        maskImage: 'linear-gradient(to bottom, transparent, #000000 22%)',
      } as any
    }
    return {}
  }, [])

  if (reduceMotion) {
    return (
      <View
        style={[styles.stage, { backgroundColor: palette.bg }, style]}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={[styles.feed, webMaskStyle]}>
          <View style={styles.inner}>
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
                reduceMotion
              />
            ))}
          </View>
        </View>
      </View>
    )
  }

  const currentScene = DEMO_SCENES[state.sceneIndex]
  const gradientHeight = Math.max(80, windowHeight * 0.22)

  return (
    <View
      style={[styles.stage, { backgroundColor: palette.bg }, style]}
      accessible
      accessibilityLabel="Demonstração interativa do Vito. Toque para ver o próximo exemplo."
      importantForAccessibility="yes"
      onStartShouldSetResponder={() => true}
      onResponderGrant={handlePress}
    >
      <View style={[styles.feed, webMaskStyle]}>
        <Animated.View
          style={[
            styles.inner,
            { transform: [{ translateY: innerTranslateY }] },
          ]}
        >
          {prevScene && exiting && (
            <DemoExchange
              key={`prev-${prevScene.id}`}
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
            key={`scene-${currentScene.id}`}
            scene={currentScene}
            phase={state.phase}
            userTyped={state.userTyped}
            userComplete={state.userComplete}
            vitoVisible={state.vitoVisible}
            cardVisible={state.cardVisible}
            dotsVisible={state.dotsVisible}
          />
        </Animated.View>

        {/* Degradê sobreposto no topo com as mensagens sumindo suavemente */}
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
