import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native'
import { useTheme } from '../../context/ThemeContext'
import { loginPalette } from './loginPalette'
import { EyeIcon } from './DemoIcons'
import { normalizeEmail, validateEmailAuth } from './emailAuth'

export type EmailSheetMode = 'login' | 'register'

export interface EmailSheetProps {
  visible: boolean
  mode?: EmailSheetMode
  onClose: () => void
  onLogin: (email: string, password: string) => void
  onRegister?: (name: string, email: string, password: string) => void
  onSwitchMode?: (mode: EmailSheetMode) => void
  isLoading?: boolean
  error?: string | null
  style?: StyleProp<ViewStyle>
}

const INPUT_HEIGHT = 54
const CTA_HEIGHT = 52

/**
 * Bottom sheet de login e criação de conta por e-mail em paridade visual com login-vito.html:
 * - Suporta dois modos: `'login'` ("Entrar com e-mail") e `'register'` ("Criar conta com e-mail")
 * - No modo `'register'`, exibe campo de Nome completo + E-mail + Senha com validação imediata
 * - Permite alternar entre Login e Cadastro diretamente dentro do modal
 */
export const EmailSheet: React.FC<EmailSheetProps> = ({
  visible,
  mode = 'login',
  onClose,
  onLogin,
  onRegister,
  onSwitchMode,
  isLoading = false,
  error = null,
  style,
}) => {
  const { isDark, colors } = useTheme()
  const palette = loginPalette(isDark)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const isRegister = mode === 'register'

  useEffect(() => {
    setLocalError(null)
  }, [mode, visible])

  const handleSubmit = useCallback(() => {
    const validationErr = validateEmailAuth({
      email,
      password,
      name,
      isRegister,
    })
    if (validationErr) {
      setLocalError(validationErr)
      return
    }
    setLocalError(null)
    const normalizedEmail = normalizeEmail(email)
    if (isRegister) {
      if (onRegister) {
        onRegister(name.trim(), normalizedEmail, password)
      } else {
        onLogin(normalizedEmail, password)
      }
    } else {
      onLogin(normalizedEmail, password)
    }
  }, [email, password, name, isRegister, onRegister, onLogin])

  const handleTogglePassword = useCallback(() => {
    setShowPassword((prev) => !prev)
  }, [])

  const handleToggleMode = useCallback(() => {
    setLocalError(null)
    onSwitchMode?.(isRegister ? 'login' : 'register')
  }, [isRegister, onSwitchMode])

  const displayedError = localError || error

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      style={style}
    >
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.scrim} />
        </TouchableWithoutFeedback>

        <View
          style={[
            styles.sheet,
            { backgroundColor: palette.bg },
          ]}
        >
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}
            accessibilityRole="button"
            accessibilityLabel="Fechar"
          >
            <View
              style={[
                styles.handle,
                { backgroundColor: palette.line },
              ]}
            />
          </TouchableOpacity>

          <Text style={[styles.title, { color: palette.ink }]}>
            {isRegister ? 'Criar conta com e-mail' : 'Entrar com e-mail'}
          </Text>

          {isRegister && (
            <View style={styles.inpWrap}>
              <RNTextInput
                placeholder="Seu nome"
                placeholderTextColor={palette.muted}
                value={name}
                onChangeText={(v) => {
                  setName(v)
                  if (localError) setLocalError(null)
                }}
                autoCapitalize="words"
                autoComplete="name"
                accessibilityLabel="Seu nome"
                style={[
                  styles.input,
                  {
                    borderColor: palette.muted,
                    backgroundColor: palette.surf,
                    color: palette.ink,
                  },
                ]}
              />
            </View>
          )}

          <View style={styles.inpWrap}>
            <RNTextInput
              placeholder="E-mail"
              placeholderTextColor={palette.muted}
              value={email}
              onChangeText={(v) => {
                setEmail(v)
                if (localError) setLocalError(null)
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              accessibilityLabel="E-mail"
              style={[
                styles.input,
                {
                  borderColor: palette.muted,
                  backgroundColor: palette.surf,
                  color: palette.ink,
                },
              ]}
            />
          </View>

          <View style={styles.inpWrap}>
            <RNTextInput
              placeholder={isRegister ? 'Criar senha (mín. 6 caracteres)' : 'Senha'}
              placeholderTextColor={palette.muted}
              value={password}
              onChangeText={(v) => {
                setPassword(v)
                if (localError) setLocalError(null)
              }}
              secureTextEntry={!showPassword}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              accessibilityLabel="Senha"
              style={[
                styles.input,
                {
                  borderColor: palette.muted,
                  backgroundColor: palette.surf,
                  color: palette.ink,
                  paddingRight: 48,
                },
              ]}
            />
            <TouchableOpacity
              onPress={handleTogglePassword}
              style={styles.eyeBtn}
              accessibilityRole="button"
              accessibilityLabel={
                showPassword ? 'Ocultar senha' : 'Mostrar senha'
              }
            >
              <EyeIcon color={palette.muted} />
            </TouchableOpacity>
          </View>

          {!!displayedError && (
            <Text style={[styles.errorText, { color: colors.error }]}>
              {displayedError}
            </Text>
          )}

          <TouchableOpacity
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel={isRegister ? 'Criar conta' : 'Entrar'}
            style={[styles.cta, { backgroundColor: palette.ink }]}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={palette.bg} />
            ) : (
              <Text style={[styles.ctaText, { color: palette.bg }]}>
                {isRegister ? 'Criar conta' : 'Entrar'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.footerLinks}>
            {onSwitchMode && (
              <TouchableOpacity
                onPress={handleToggleMode}
                activeOpacity={0.75}
                style={styles.switchModeBtn}
                accessibilityRole="button"
                accessibilityLabel={
                  isRegister
                    ? 'Já tem uma conta? Entrar'
                    : 'Não tem conta? Cadastre-se'
                }
              >
                <Text style={[styles.switchModeText, { color: palette.ink }]}>
                  {isRegister
                    ? 'Já tem uma conta? Entrar'
                    : 'Não tem conta? Cadastre-se'}
                </Text>
              </TouchableOpacity>
            )}

            {!isRegister && (
              <TouchableOpacity
                onPress={onClose}
                activeOpacity={0.75}
                style={styles.forgotWrap}
                accessibilityRole="button"
                accessibilityLabel="Esqueci a senha"
              >
                <Text style={[styles.forgotText, { color: palette.muted }]}>
                  Esqueci a senha
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  } as ViewStyle,
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
  } as ViewStyle,
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
    elevation: 16,
  } as ViewStyle,
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    marginBottom: 14,
  } as ViewStyle,
  title: {
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 22,
    letterSpacing: -0.44,
    marginBottom: 14,
  } as TextStyle,
  inpWrap: {
    position: 'relative',
    marginBottom: 12,
  } as ViewStyle,
  input: {
    width: '100%',
    height: INPUT_HEIGHT,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
  } as TextStyle,
  eyeBtn: {
    position: 'absolute',
    right: 6,
    top: 7,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    marginBottom: 8,
  } as TextStyle,
  cta: {
    width: '100%',
    height: CTA_HEIGHT,
    borderRadius: CTA_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  } as ViewStyle,
  ctaText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  } as TextStyle,
  footerLinks: {
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  } as ViewStyle,
  switchModeBtn: {
    paddingVertical: 4,
  } as ViewStyle,
  switchModeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  } as TextStyle,
  forgotWrap: {
    alignItems: 'center',
    paddingVertical: 4,
  } as ViewStyle,
  forgotText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
  } as TextStyle,
})
