import React, { useCallback } from 'react'
import {
  StatusBar,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native'
import { MascotVectorRig } from '../../bots/mascot/MascotVectorRig'
import { HeadlineReel } from './HeadlineReel'
import { SunIcon } from '../../../icons/AppGlyphs'
import { loginPalette } from '../utils/loginPalette'
import { headlineColor, type DemoTone } from '../demo/demoScenes'

const THEME_BTN_SIZE = 40

export interface LoginHeaderProps {
  isDark: boolean
  toggleTheme: (origin?: { x: number; y: number }) => void
  currentHeadline?: string
  currentTone?: DemoTone
  reduceMotion?: boolean
  style?: StyleProp<ViewStyle>
}

/**
 * Cabecalho da tela de login v5 (#s-login .lg-hero):
 * - Topbar com logo #vito + "vito" + alternador circular Claro/Escuro (#lg-th-tgl)
 * - Hero com titulo "Seu assistente para" + roleta cinetica (.lg-reel) sincronizada a cena atual
 */
export const LoginHeader: React.FC<LoginHeaderProps> = ({
  isDark,
  toggleTheme,
  currentHeadline = 'organizar a agenda',
  currentTone = 'blue',
  reduceMotion = false,
  style,
}) => {
  const palette = loginPalette(isDark)
  const activeColor = headlineColor(currentTone, palette)

  const handleThemePress = useCallback(
    (e: { nativeEvent?: { pageX?: number; pageY?: number } }) => {
      const x = e?.nativeEvent?.pageX
      const y = e?.nativeEvent?.pageY
      if (typeof x === 'number' && typeof y === 'number') {
        toggleTheme({ x, y })
      } else {
        toggleTheme()
      }
    },
    [toggleTheme],
  )

  return (
    <View style={[styles.hero, style]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.topRow}>
        <View style={styles.brand}>
          <MascotVectorRig size={38} state="blink" animated={!reduceMotion} />
          <Text
            style={[styles.wordmark, { color: palette.ink }]}
            maxFontSizeMultiplier={1.3}
          >
            vito
          </Text>
        </View>

        <TouchableOpacity
          testID="lg-th-tgl"
          style={[
            styles.themeButton,
            {
              backgroundColor: palette.surf,
              borderColor: palette.line,
            },
          ]}
          onPress={handleThemePress}
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Alternar tema claro ou escuro"
        >
          <SunIcon color={palette.ink} size={18} />
        </TouchableOpacity>
      </View>

      <View style={styles.titleBlock}>
        <Text
          style={[styles.l1, { color: palette.muted }]}
          maxFontSizeMultiplier={1.3}
        >
          Seu assistente para
        </Text>
        <HeadlineReel
          word={currentHeadline}
          color={activeColor}
          palette={palette}
          reduceMotion={reduceMotion}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 4,
    zIndex: 2,
  } as ViewStyle,
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  } as ViewStyle,
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  } as ViewStyle,
  wordmark: {
    fontFamily: 'Geist_700Bold',
    fontSize: 22,
    letterSpacing: -0.88,
  } as TextStyle,
  themeButton: {
    width: THEME_BTN_SIZE,
    height: THEME_BTN_SIZE,
    borderRadius: THEME_BTN_SIZE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  titleBlock: {
    alignItems: 'flex-start',
  } as ViewStyle,
  l1: {
    fontFamily: 'Geist_500Medium',
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: -0.4,
    marginBottom: 2,
    textAlign: 'left',
  } as TextStyle,
})
