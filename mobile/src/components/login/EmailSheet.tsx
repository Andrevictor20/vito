import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTheme } from '../../context/ThemeContext'
import { type ThemeTokens } from '../../theme/tokens'
import { TextInput } from '../../components/ui/TextInput'

export interface EmailSheetProps {
  visible: boolean
  onClose: () => void
  onLogin: (email: string, password: string) => void
  isLoading?: boolean
  error?: string | null
  style?: StyleProp<ViewStyle>
}

const INPUT_HEIGHT = 54
const CTA_HEIGHT = 52

/**
 * Bottom sheet de login por e-mail (tela de login v2).
 * Reaproveita TextInput existente (validação + máscara de erro) e infra de modal
 * (scrim 40%, teclado, fechar por scrim/alça/voltar do Android).
 * Não altera a lógica de autenticação — apenas chama onLogin.
 */
export const EmailSheet: React.FC<EmailSheetProps> = ({
  visible,
  onClose,
  onLogin,
  isLoading = false,
  error = null,
  style,
}) => {
  const { colors } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Abre: foca o campo de e-mail após a animação de subida (~380 ms).
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => {}, 380)
    return () => clearTimeout(t)
  }, [visible])

  const handleLoginPress = useCallback(() => {
    onLogin(email, password)
  }, [email, password, onLogin])

  const handleTogglePassword = useCallback(() => {
    setShowPassword((prev) => !prev)
  }, [])

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      style={style}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'center' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.scrim} />
        </TouchableWithoutFeedback>
        <View style={[styles.sheet, { backgroundColor: colors.bg }]}>
          <View style={[styles.handle, { backgroundColor: colors.outlineVariant }]} />
          <Text style={[styles.title, { color: colors.onSurface }]}>
            Entrar com e-mail
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              label="E-mail"
              placeholder="seu@email.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              variant="outlined"
              style={{ minHeight: INPUT_HEIGHT }}
            />
            <TextInput
              label="Senha"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="current-password"
              variant="outlined"
              style={{
                minHeight: INPUT_HEIGHT,
                paddingRight: 44,
              }}
            />
            <TouchableWithoutFeedback
              onPress={handleTogglePassword}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={
                showPassword ? 'Ocultar senha' : 'Exibir senha'
              }
            >
              <View style={styles.eyeWrap}>
                <MaterialIcons
                  name={showPassword ? 'visibility-off' : 'visibility'}
                  size={22}
                  color={colors.onSurfaceVariant}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>

          {!!error && (
            <Text style={[styles.errorText, { color: colors.error }]}>
              {error}
            </Text>
          )}

          <TouchableWithoutFeedback
            onPress={handleLoginPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Entrar"
          >
            <View style={[styles.cta, { backgroundColor: colors.primary }]}>
              {isLoading ? (
                <ActivityIndicator
                  size="small"
                  color={colors.onPrimary}
                  style={styles.indicator}
                />
              ) : (
                <Text style={[styles.ctaText, { color: colors.onPrimary }]}>
                  Entrar
                </Text>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 26,
    maxHeight: '90%',
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    marginBottom: 14,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 22,
    letterSpacing: -0.6,
    marginBottom: 14,
    textAlign: 'center',
  },
  inputContainer: {
    gap: 12,
    marginBottom: 12,
  },
  eyeWrap: {
    position: 'absolute',
    right: 6,
    top: 7,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 16,
  },
  cta: {
    height: CTA_HEIGHT,
    borderRadius: CTA_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  ctaText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  indicator: {
    marginLeft: 4,
  },
})
