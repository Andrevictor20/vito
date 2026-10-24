import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import * as Updates from 'expo-updates'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { WhatsAppAuthModal } from '../auth/WhatsAppAuthModal'
import { LoginHeader } from './LoginHeader'
import { DemoStage } from './DemoStage'
import { AuthIconPill } from './AuthIconPill'
import { EmailSheet } from './EmailSheet'
import { useDemoLoop } from './useDemoLoop'
import { DEMO_SCENES } from './demoScenes'
import { loginPalette } from './loginPalette'

export interface LoginScreenProps {
  serverUrl?: string
  onToggleServer?: () => void
}

const LONG_PRESS_MS = 600

/**
 * Nova tela de login do Vito (v2).
 * Substitui o card com e-mail/senha por uma demonstração animada que ocupa
 * quase a tela inteira, com autenticação em três botões só com ícone.
 * Não altera a lógica de autenticação: reutiliza os handlers existentes
 * (login, register, loginWithGoogle, loginWithWhatsApp) via useAuth().
 */
export const LoginScreen: React.FC<LoginScreenProps> = ({
  serverUrl,
  onToggleServer,
}) => {
  const { login, register, loginWithGoogle, loginWithWhatsApp, isLoading } =
    useAuth()
  const { isDark, toggleTheme } = useTheme()
  const { state: demoState, advanceScene, reduceMotion } = useDemoLoop()
  const currentScene = DEMO_SCENES[demoState.sceneIndex]
  const palette = loginPalette(isDark)
  const [isRegister, setIsRegister] = useState(false)
  const [emailSheetVisible, setEmailSheetVisible] = useState(false)
  const [whatsappAuthVisible, setWhatsappAuthVisible] = useState(false)
  const [sheetError, setSheetError] = useState<string | null>(null)
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { colors } = useTheme()
  const { currentlyRunning } = Updates.useUpdates()

  const handleGoogleLogin = useCallback(() => {
    loginWithGoogle()
  }, [loginWithGoogle])

  const handleWhatsAppLogin = useCallback(() => {
    // Mesmo handler de "Entrar com WhatsApp" da tela atual: abre o modal de OTP.
    setWhatsappAuthVisible(true)
  }, [])

  const handleEmailLogin = useCallback(
    (email: string, password: string) => {
      const name = isRegister ? email.split('@')[0] : ''
      if (isRegister) {
        register(name, email, password)
      } else {
        login(email, password)
      }
      setEmailSheetVisible(false)
    },
    [login, register, isRegister],
  )

  const handleSignupPress = useCallback(() => {
    setIsRegister((prev) => !prev)
    setSheetError(null)
  }, [])

  const handleManualCheckUpdate = useCallback(async () => {
    setIsCheckingUpdate(true)
    try {
      if (!Updates.isEnabled) {
        Alert.alert(
          'Atualizações OTA',
          'O serviço de atualizações OTA está desativado em ambiente de desenvolvimento (Metro).',
        )
        return
      }
      const result = await Updates.checkForUpdateAsync()
      if (result.isAvailable) {
        Alert.alert(
          'Atualização Encontrada',
          'Baixando a versão mais recente em segundo plano...',
          [
            {
              text: 'Aplicar Agora',
              onPress: async () => {
                await Updates.fetchUpdateAsync()
                await Updates.reloadAsync()
              },
            },
          ],
        )
      } else {
        Alert.alert('Aplicativo Atualizado', 'Você já está na versão mais recente.')
      }
    } catch (e: any) {
      console.warn('[LoginScreen] Erro ao verificar atualização:', e)
      Alert.alert(
        'Verificação de Atualização',
        `Não foi possível verificar: ${e?.message || 'Falha de conexão.'}`,
      )
    } finally {
      setIsCheckingUpdate(false)
    }
  }, [])

  const showBuildToast = useCallback(() => {
    const updateId = currentlyRunning?.updateId
    const buildText = updateId ? `OTA ${updateId.slice(0, 7)}` : 'v0.1.16'
    Alert.alert('Build do Vito', buildText, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Buscar update', onPress: handleManualCheckUpdate },
    ])
  }, [currentlyRunning, handleManualCheckUpdate])

  const handleLongPressStart = useCallback(() => {
    longPressRef.current = setTimeout(showBuildToast, LONG_PRESS_MS)
  }, [showBuildToast])

  const handleLongPressEnd = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current)
      longPressRef.current = null
    }
  }, [])

  const handleDemoAdvance = useCallback(() => {
    // Toque no palco avança a cena (tratado no DemoStage).
  }, [])

  const headerStyle = useMemo<ViewStyle>(
    () => ({
      backgroundColor: colors.bg,
    }),
    [colors.bg],
  )

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, width: '100%' }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={{ width: '100%', backgroundColor: colors.bg }}
        >
          <LoginHeader
            isDark={isDark}
            toggleTheme={toggleTheme}
            currentHeadline={currentScene?.headline}
            currentTone={currentScene?.tone}
            reduceMotion={reduceMotion}
            style={headerStyle}
          />

          <DemoStage
            state={demoState}
            advanceScene={advanceScene}
            reduceMotion={reduceMotion}
            onAdvance={handleDemoAdvance}
            style={{ flex: 1 }}
          />

          <View style={styles.authFooter}>
            <AuthIconPill
              onGoogle={handleGoogleLogin}
              onWhatsApp={handleWhatsAppLogin}
              onEmail={() => setEmailSheetVisible(true)}
              loading={isLoading}
            />

            <TouchableWithoutFeedback
              onPress={handleSignupPress}
              hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}
              accessibilityRole="button"
              accessibilityLabel="Não tem conta? Cadastre-se"
            >
              <View style={styles.signupWrap}>
                <Text style={[styles.signupText, { color: palette.ink }]}>
                  {isRegister
                    ? 'Já possui uma conta? Faça login'
                    : 'Não tem conta? Cadastre-se'}
                </Text>
              </View>
            </TouchableWithoutFeedback>
          </View>

          <EmailSheet
            visible={emailSheetVisible}
            onClose={() => setEmailSheetVisible(false)}
            onLogin={handleEmailLogin}
            isLoading={isLoading}
            error={sheetError}
          />

          <WhatsAppAuthModal
            visible={whatsappAuthVisible}
            onClose={() => setWhatsappAuthVisible(false)}
            onPhoneNotLinked={(message) => {
              setWhatsappAuthVisible(false)
              setIsRegister(true)
              setSheetError(
                `${message} Crie sua conta com e-mail ou Google para continuar e vincule seu WhatsApp depois (Perfil → Conectar WhatsApp).`,
              )
            }}
          />
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  authFooter: {
    padding: 12,
    alignItems: 'center',
    paddingBottom: 24,
  },
  signupWrap: {
    alignItems: 'center',
    marginTop: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  signupText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#09090B',
  },
})
