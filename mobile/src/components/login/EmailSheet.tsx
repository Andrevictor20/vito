import React, { useCallback, useState } from 'react'
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
 * Bottom sheet de login por e-mail em paridade visual exata com login-vito.html:
 * - Ancorado na parte inferior (justifyContent: 'flex-end')
 * - Borda superior arredondada 28px, handle centralizado 38x4px
 * - Título "Entrar com e-mail" em Montserrat 800 22px
 * - Inputs de 54px com borda 1.5px muted, fundo surf, raio 10px e EyeIcon
 * - Botão CTA "Entrar" em pílula de 52px na cor ink
 * - Link "Esqueci a senha" centralizado abaixo
 */
export const EmailSheet: React.FC<EmailSheetProps> = ({
  visible,
  onClose,
  onLogin,
  isLoading = false,
  error = null,
  style,
}) => {
  const { isDark, colors } = useTheme()
  const palette = loginPalette(isDark)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

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
            Entrar com e-mail
          </Text>

          <View style={styles.inpWrap}>
            <RNTextInput
              placeholder="E-mail"
              placeholderTextColor={palette.muted}
              value={email}
              onChangeText={setEmail}
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
              placeholder="Senha"
              placeholderTextColor={palette.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="current-password"
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

          {!!error && (
            <Text style={[styles.errorText, { color: colors.error }]}>
              {error}
            </Text>
          )}

          <TouchableOpacity
            onPress={handleLoginPress}
            activeOpacity={0.85}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="Entrar"
            style={[styles.cta, { backgroundColor: palette.ink }]}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={palette.bg} />
            ) : (
              <Text style={[styles.ctaText, { color: palette.bg }]}>
                Entrar
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.75}
            style={styles.forgotWrap}
            accessibilityRole="button"
            accessibilityLabel="Esqueci a senha"
          >
            <Text style={[styles.forgotText, { color: palette.ink }]}>
              Esqueci a senha
            </Text>
          </TouchableOpacity>
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
  forgotWrap: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 4,
  } as ViewStyle,
  forgotText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13.5,
  } as TextStyle,
})
