import React, { useCallback } from 'react'
import {
  StyleSheet,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { GoogleIcon } from '../common/GoogleIcon'
import { MailIcon, WhatsAppGlyph } from './DemoIcons'
import { useTheme } from '../../context/ThemeContext'
import { loginPalette } from './loginPalette'

export type AuthIconKind = 'google' | 'whatsapp' | 'email'

export interface AuthIconPillProps {
  onGoogle: () => void
  onWhatsApp: () => void
  onEmail: () => void
  loading?: boolean
  iconSize?: number
  pillSize?: number
  style?: StyleProp<ViewStyle>
}

/**
 * Pílula com três botões circulares de ícone (Google, WhatsApp, E-mail)
 * em paridade exata com login-vito.html:
 * .pill{display:flex;gap:12px;padding:8px;background:var(--surf);border-radius:40px;box-shadow:var(--shadow)}
 * .ib{width:58px;height:58px;border-radius:50%;border:0;display:grid;place-items:center}
 * - Google: fundo branco, contorno linha 1px, ícone Google oficial.
 * - WhatsApp: fundo verde (#25d366), glifo do WhatsApp vetorial oficial branco.
 * - E-mail: fundo ink, ícone de e-mail vetorial na cor de fundo (bg).
 */
export const AuthIconPill: React.FC<AuthIconPillProps> = ({
  onGoogle,
  onWhatsApp,
  onEmail,
  loading = false,
  iconSize = 26,
  pillSize = 58,
  style,
}) => {
  const { isDark } = useTheme()
  const palette = loginPalette(isDark)

  const handlePress = useCallback(
    (kind: AuthIconKind, handler: () => void) => {
      if (loading) return
      handler()
    },
    [loading],
  )

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: palette.surf,
          shadowColor: isDark ? '#000000' : '#141916',
        },
        style,
      ]}
      accessibilityRole="toolbar"
      accessibilityLabel="Opções de login"
    >
      {/* Botão Google */}
      <TouchableOpacity
        style={[
          styles.iconBtn,
          {
            width: pillSize,
            height: pillSize,
            borderRadius: pillSize / 2,
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: palette.line,
          },
        ]}
        disabled={loading}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Continuar com o Google"
        onPress={() => handlePress('google', onGoogle)}
      >
        <GoogleIcon size={iconSize} />
      </TouchableOpacity>

      {/* Botão WhatsApp */}
      <TouchableOpacity
        style={[
          styles.iconBtn,
          {
            width: pillSize,
            height: pillSize,
            borderRadius: pillSize / 2,
            backgroundColor: '#25D366',
          },
        ]}
        disabled={loading}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Entrar com WhatsApp"
        onPress={() => handlePress('whatsapp', onWhatsApp)}
      >
        <WhatsAppGlyph color="#FFFFFF" size={iconSize} />
      </TouchableOpacity>

      {/* Botão E-mail */}
      <TouchableOpacity
        style={[
          styles.iconBtn,
          {
            width: pillSize,
            height: pillSize,
            borderRadius: pillSize / 2,
            backgroundColor: palette.ink,
          },
        ]}
        disabled={loading}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Entrar com e-mail"
        onPress={() => handlePress('email', onEmail)}
      >
        <MailIcon color={palette.bg} size={iconSize} />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    gap: 12,
    padding: 8,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 22,
    elevation: 4,
  } as ViewStyle,
  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
})
