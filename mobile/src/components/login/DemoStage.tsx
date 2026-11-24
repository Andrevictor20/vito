import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { DEMO_SCENES, DemoScene } from './demoScenes'
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
  const cardH = scene.card.isCol ? 116 : 66
  return userH + 12 + 22 + 10 + cardH + 16
}

/**
 * Palco central (.lg-stage) do Login v5:
 * - Cicla as 6 cenas de dialogo simuladas (toque avanca para a proxima)
 * - Exibe barra de dots expansiveis (.lg-dots-bar) abaixo do feed
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

  const prevIndexRef = useRef<number>(state.sceneIndex)
  const [exitingScene, setExitingScene] = useState<DemoScene | null>(null)
  const innerTranslateY = useRef(new Animated.Value(0)).current

  const currentScene = DEMO_SCENES[state.sceneIndex]
  const prevScene = getWrappedScene(state.sceneIndex - 1)

  useEffect(() => {
    if (state.sceneIndex !== prevIndexRef.current) {
      const outgoing = getWrappedScene(prevIndexRef.current - 1)
      setExitingScene(outgoing)
      prevIndexRef.current = state.sceneIndex

      if (!reduceMotion) {
        const pushDistance = estimateSceneHeight(DEMO_SCENES[state.sceneIndex])
        innerTranslateY.setValue(pushDistance)
        Animated.timing(innerTranslateY, {
          toValue: 0,
          duration: 460,
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

  return (
    <View
      testID="lg-stage"
      style={[styles.stage, style]}
      accessible
      accessibilityRole="button"
      accessibilityLabel="Demonstração interativa: toque para ver o próximo exemplo"
      onStartShouldSetResponder={() => true}
      onResponderGrant={handlePress}
    >
      <View style={styles.feed}>
        {reduceMotion ? (
          <View style={styles.inner}>
            <View style={styles.prevExchange}>
              <DemoExchange
                key={`static-prev-${prevScene.id}`}
                scene={prevScene}
                phase="showing-card"
                userTyped={prevScene.userText}
                userComplete
                vitoVisible
                cardVisible
                dotsVisible={false}
                reduceMotion
              />
            </View>
            <DemoExchange
              key={`static-cur-${currentScene.id}`}
              scene={currentScene}
              phase="showing-card"
              userTyped={currentScene.userText}
              userComplete
              vitoVisible
              cardVisible
              dotsVisible={false}
              reduceMotion
            />
          </View>
        ) : (
          <Animated.View
            style={[
              styles.inner,
              { transform: [{ translateY: innerTranslateY }] },
            ]}
          >
            {exitingScene ? (
              <View style={styles.prevExchange}>
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
              </View>
            ) : null}

            <View style={styles.prevExchange}>
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
            </View>

            <DemoExchange
              key={`current-${currentScene.id}`}
              scene={currentScene}
              phase={state.phase}
              userTyped={state.userTyped}
              userComplete={state.userComplete}
              vitoVisible={state.vitoVisible}
              cardVisible={state.cardVisible}
              dotsVisible={state.dotsVisible}
              reduceMotion={reduceMotion}
            />
          </Animated.View>
        )}
      </View>

      <View style={styles.dotsBar} accessibilityElementsHidden>
        {DEMO_SCENES.map((sc, idx) => {
          const isActive = idx === state.sceneIndex
          return (
            <View
              key={sc.id}
              style={[
                styles.dot,
                {
                  width: isActive ? 18 : 6,
                  backgroundColor: isActive ? palette.ink : palette.line,
                },
              ]}
            />
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 6,
    justifyContent: 'space-between',
  } as ViewStyle,
  feed: {
    flex: 1,
    minHeight: 310,
    position: 'relative',
    overflow: 'hidden',
  } as ViewStyle,
  inner: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 12,
    flexDirection: 'column',
    gap: 18,
  } as ViewStyle,
  prevExchange: {
    opacity: 0.42,
    transform: [{ scale: 0.97 }],
  } as ViewStyle,
  dotsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 2,
  } as ViewStyle,
  dot: {
    height: 6,
    borderRadius: 3,
  } as ViewStyle,
})
