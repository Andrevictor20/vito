import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  Alert,
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  type ViewStyle,
  type TextStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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
 * Tela de login do Vito v2 em paridade total com login-vito.html.
 * Layout em coluna flexível estrita (sem ScrollView bloqueando o flex:1 do palco):
 * 1. Hero (Logo animada + Título com HeadlineReel colorido)
 * 2. Stage (Palco com feed ancorado embaixo, empurrão físico suave e degradê superior onde as mensagens somem)
 * 3. Auth Footer (Pílula com 3 botões circulares de 58px + link Cadastre-se)
 */
export const LoginScreen: React.FC<LoginScreenProps> = () => {
  const { login, register, loginWithGoogle, isLoading } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const insets = useSafeAreaInsets()
  const { state: demoState, advanceScene, reduceMotion } = useDemoLoop()
  const currentScene = DEMO_SCENES[demoState.sceneIndex]
  const palette = loginPalette(isDark)

  const [isRegister, setIsRegister] = useState(false)
  const [emailSheetVisible, setEmailSheetVisible] = useState(false)
  const [whatsappAuthVisible, setWhatsappAuthVisible] = useState(false)
  const [sheetError, setSheetError] = useState<string | null>(null)
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { currentlyRunning } = Updates.useUpdates()

  const handleGoogleLogin = useCallback(() => {
    loginWithGoogle()
  }, [loginWithGoogle])

  const handleWhatsAppLogin = useCallback(() => {
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
    setEmailSheetVisible(true)
  }, [])

  const handleManualCheckUpdate = useCallback(async () => {
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

  const rootStyle = useMemo<ViewStyle>(
    () => ({
      flex: 1,
      backgroundColor: palette.bg,
      paddingTop: Math.max(insets.top, 6),
      paddingBottom: Math.max(insets.bottom, 12),
    }),
    [palette.bg, insets.top, insets.bottom],
  )

  return (
    <View style={rootStyle}>
      <View
        onTouchStart={handleLongPressStart}
        onTouchEnd={handleLongPressEnd}
        onTouchCancel={handleLongPressEnd}
      >
        <LoginHeader
          isDark={isDark}
          toggleTheme={toggleTheme}
          currentHeadline={currentScene?.headline}
          currentTone={currentScene?.tone}
          reduceMotion={reduceMotion}
          style={{ backgroundColor: palette.bg }}
        />
      </View>

      <DemoStage
        state={demoState}
        advanceScene={advanceScene}
        reduceMotion={reduceMotion}
        onAdvance={handleDemoAdvance}
        style={styles.stage}
      />

      <View style={styles.authFooter}>
        <AuthIconPill
          onGoogle={handleGoogleLogin}
          onWhatsApp={handleWhatsAppLogin}
          onEmail={() => setEmailSheetVisible(true)}
          loading={isLoading}
        />

        <TouchableOpacity
          onPress={handleSignupPress}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}
          accessibilityRole="button"
          accessibilityLabel="Não tem conta? Cadastre-se"
          style={styles.signupWrap}
        >
          <Text style={[styles.signupText, { color: palette.ink }]}>
            {isRegister
              ? 'Já possui uma conta? Faça login'
              : 'Não tem conta? Cadastre-se'}
          </Text>
        </TouchableOpacity>
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
          setEmailSheetVisible(true)
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    minHeight: 0,
  } as ViewStyle,
  authFooter: {
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 8,
    alignItems: 'center',
  } as ViewStyle,
  signupWrap: {
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  signupText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  } as TextStyle,
})
