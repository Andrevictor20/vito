import React, { useEffect, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'
import { DEMO_HEADLINES, DEMO_SCENES, headlineColor } from './demoScenes'
import {
  buildReelItems,
  REEL_DURATION_MS,
  REEL_LINE_EM,
  REEL_SETTLE_MS,
} from './headlineReel'
import type { LoginPalette } from './loginPalette'

const FONT = 28
const LINE = FONT * REEL_LINE_EM

export function HeadlineReel({
  word,
  color,
  palette,
  reduceMotion,
}: {
  word: string
  color: string
  palette?: LoginPalette
  reduceMotion: boolean
}) {
  const [items, setItems] = useState<string[]>([word])
  const previous = useRef('')
  const translate = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (reduceMotion) {
      setItems([word])
      translate.setValue(0)
      previous.current = word
      return
    }
    const reel = buildReelItems(word, previous.current, DEMO_HEADLINES)
    setItems(reel)
    translate.setValue(-((reel.length - 1) * LINE))
    const anim = Animated.timing(translate, {
      toValue: 0,
      duration: REEL_DURATION_MS,
      easing: Easing.bezier(0.2, 0.85, 0.3, 1.08),
      useNativeDriver: true,
    })
    anim.start()
    const settle = setTimeout(() => {
      setItems([word])
      translate.setValue(0)
    }, REEL_SETTLE_MS)
    previous.current = word
    return () => {
      anim.stop()
      clearTimeout(settle)
    }
  }, [word, reduceMotion, translate])

  return (
    <View style={styles.reel} accessibilityElementsHidden>
      <Animated.View style={{ transform: [{ translateY: translate }] }}>
        {items.map((item, index) => {
          const filler = index > 0 && index < items.length - 1
          const scene = DEMO_SCENES.find((s) => s.headline === item)
          const itemColor = scene && palette ? headlineColor(scene.tone, palette) : color
          return (
            <Text
              key={`${item}-${index}`}
              numberOfLines={1}
              style={[
                styles.item,
                {
                  color: itemColor,
                  opacity: filler ? 0.55 : 1,
                  transform: filler ? [{ scaleY: 1.12 }] : undefined,
                },
              ]}
            >
              {item}
            </Text>
          )
        })}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  reel: {
    height: LINE,
    overflow: 'hidden',
  },
  item: {
    height: LINE,
    lineHeight: LINE,
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: FONT,
    letterSpacing: -0.7,
  },
})
