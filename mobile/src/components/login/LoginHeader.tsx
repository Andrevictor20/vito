import React, { useCallback } from 'react'
import {
  StatusBar,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { VitoLoginMark } from './VitoLoginMark'
import { HeadlineReel } from './HeadlineReel'
import { loginPalette } from './loginPalette'
import { headlineColor, type DemoTone } from './demoScenes'

const THEME_BTN_SIZE = 34

export interface LoginHeaderProps {
  isDark: boolean
  toggleTheme: () => void
  currentHeadline?: string
  currentTone?: DemoTone
  reduceMotion?: boolean
  style?: StyleProp<ViewStyle>
}

/**
 * Cabeçalho da tela de login v2 (fidelidade a login-vito.html).
 * - Brand horizontal: VitoLoginMark (SVG com olhos animados) + wordmark "vito" em Montserrat 800.
 * - Botão de alternar tema claro/escuro à direita.
 * - H1 em Montserrat 800: "Seu assistente para" + HeadlineReel (roleta com as cenas do protótipo).
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
  const iconName = isDark ? 'light-mode' : 'dark-mode'

  const handleThemePress = useCallback(() => {
    toggleTheme()
  }, [toggleTheme])

  return (
    <View style={[styles.hero, style]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.topRow}>
        <View style={styles.brand}>
          <VitoLoginMark
            color={palette.ink}
            width={40}
            height={42}
          />
          <Text
            style={[styles.wordmark, { color: palette.ink }]}
            maxFontSizeMultiplier={1.3}
          >
            vito
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.themeButton,
            { backgroundColor: palette.surf },
          ]}
          onPress={handleThemePress}
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
        >
          <MaterialIcons
            name={iconName}
            size={18}
            color={palette.ink}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.titleBlock}>
        <Text
          style={[styles.l1, { color: palette.ink }]}
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
    paddingTop: 16,
    paddingBottom: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wordmark: {
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 22,
    letterSpacing: -0.66,
  },
  themeButton: {
    width: THEME_BTN_SIZE,
    height: THEME_BTN_SIZE,
    borderRadius: THEME_BTN_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    alignItems: 'flex-start',
  },
  l1: {
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: -0.65,
    textAlign: 'left',
  },
})
