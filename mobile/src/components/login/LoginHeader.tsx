import React, { useCallback } from 'react'
import {
  StatusBar,
  View,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { VitoMascot } from '../common/VitoMascot'
import { useTheme } from '../../context/ThemeContext'

const MASCOT_SIZE = 52
const MASCOT_SIZE_SMALL = 44
const THEME_BTN_SIZE = 34

export interface LoginHeaderProps {
  isDark: boolean
  toggleTheme: () => void
  style?: StyleProp<ViewStyle>
}

export const LoginHeader: React.FC<LoginHeaderProps> = ({
  isDark,
  toggleTheme,
  style,
}) => {
  const { height: windowHeight } = useWindowDimensions()
  const isSmall = windowHeight < 700
  const mascotSize = isSmall ? MASCOT_SIZE_SMALL : MASCOT_SIZE
  const iconName = isDark ? 'light-mode' : 'dark-mode'

  const handleThemePress = useCallback(() => {
    toggleTheme()
  }, [toggleTheme])

  return (
    <View style={[styles.container, style]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <TouchableOpacity
        style={[
          styles.themeButton,
          { backgroundColor: isDark ? '#191C1E' : '#F2F4F3' },
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
          color={isDark ? '#FAFAFA' : '#09090B'}
        />
      </TouchableOpacity>

      <View style={styles.brand}>
        <VitoMascot size={mascotSize} animated state="idle" />
        <Text
          style={[styles.wordmark, { color: isDark ? '#FAFAFA' : '#17191b' }]}
          maxFontSizeMultiplier={1.3}
        >
          vito
        </Text>
      </View>

      <Text
        style={[styles.title, { color: isDark ? '#FAFAFA' : '#17191b' }]}
        maxFontSizeMultiplier={1.3}
      >
        Seu secretário pessoal com IA
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 6,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeButton: {
    position: 'absolute',
    top: 6,
    right: 16,
    width: THEME_BTN_SIZE,
    height: THEME_BTN_SIZE,
    borderRadius: THEME_BTN_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    alignItems: 'center',
    flexDirection: 'column',
    marginTop: 4,
  },
  wordmark: {
    fontFamily: 'Inter_700Bold',
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: -0.02,
    marginTop: 4,
    lineHeight: 22,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.01,
    textAlign: 'center',
    marginHorizontal: 24,
    marginTop: 2,
  },
})
