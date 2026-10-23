import React, { useCallback, useMemo } from 'react'
import {
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { GoogleIcon } from '../common/GoogleIcon'
import { useTheme } from '../../context/ThemeContext'
import { type ThemeTokens } from '../../theme/tokens'

export type AuthIconKind = 'google' | 'whatsapp' | 'email'

export interface AuthIconPillProps {
  onGoogle: () => void
  onWhatsApp: () => void
  onEmail: () => void
  loading?: boolean
  iconSize?: number
  pillSize?: number
  style?: ViewStyle | ViewStyle[] | null | undefined
}

/**
 * Pílula flutuante com três botões circulares de ícone (só ícone, sem label):
 * Google, WhatsApp e E-mail. Reaproveita o GoogleIcon oficial do app.
 * Não altera a lógica de autenticação — apenas dispara os handlers existentes.
 */
export const AuthIconPill: React.FC<AuthIconPillProps> = ({
  onGoogle,
  onWhatsApp,
  onEmail,
  loading = false,
  iconSize = 22,
  pillSize = 52,
  style,
}) => {
  const { colors } = useTheme()

  const styles = useMemo<{ pill: ViewStyle; iconButton: ViewStyle }>(
    () => ({
      pill: {
        flexDirection: 'row',
        gap: 12,
        padding: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 9999,
        backgroundColor: colors.surfaceContainer,
      },
      iconButton: {
        borderRadius: 9999,
        alignItems: 'center',
        justifyContent: 'center',
      },
    }),
    [colors],
  )

  const handlePress = useCallback(
    (kind: AuthIconKind, handler: () => void) => {
      if (loading) return
      handler()
    },
    [loading],
  )

  const iconButton = (
    kind: AuthIconKind,
    icon: React.ReactNode,
    label: string,
    bgColor: string,
    iconColor: string,
    borderColor?: string,
  ) => {
    const disabled = loading
    const btnStyle: ViewStyle = {
      ...styles.iconButton,
      width: pillSize,
      height: pillSize,
      backgroundColor: disabled ? colors.surfaceContainerHighest : bgColor,
      ...(borderColor ? { borderColor, borderWidth: 1 } : {}),
    }
    return (
      <TouchableOpacity
        key={kind}
        style={btnStyle}
        disabled={disabled}
        activeOpacity={0.92}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          if (kind === 'google') handlePress('google', onGoogle)
          else if (kind === 'whatsapp') handlePress('whatsapp', onWhatsApp)
          else handlePress('email', onEmail)
        }}
      >
        {icon}
      </TouchableOpacity>
    )
  }

  const whatsAppBg = '#25D366'

  return (
    <View style={[styles.pill, style]}>
      {iconButton(
        'google',
        <GoogleIcon size={iconSize} />,
        'Continuar com o Google',
        '#FFFFFF',
        colors.onSurface,
        colors.outlineVariant,
      )}
      {iconButton(
        'whatsapp',
        <MaterialIcons name="chat" size={iconSize} color="#FFFFFF" />,
        'Entrar com WhatsApp',
        whatsAppBg,
        '#FFFFFF',
      )}
      {iconButton(
        'email',
        <MaterialIcons name="email" size={iconSize} color={colors.onPrimary} />,
        'Entrar com e-mail',
        colors.primary,
        colors.onPrimary,
      )}
    </View>
  )
}
