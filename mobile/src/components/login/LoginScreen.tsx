import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import * as Updates from 'expo-updates'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { WhatsAppAuthModal } from '../auth/WhatsAppAuthModal'
import { hasSeenOnboarding, markOnboardingSeen } from '../auth/onboardingStorage'
import { OnboardingScreen } from '../../screens/OnboardingScreen'
import { LoginHeader } from './LoginHeader'
import { DemoStage } from './DemoStage'
import { AuthActionsFooter } from './AuthActionsFooter'
import { EmailSheet, type EmailSheetMode } from './EmailSheet'
import { LegalDocModal, type LegalDocKind } from './LegalDocModal'
import { useDemoLoop } from './useDemoLoop'
import { DEMO_SCENES, headlineColor } from './demoScenes'
import { loginPalette } from './loginPalette'

export interface LoginScreenProps {
  serverUrl?: string
  onToggleServer?: () => void
}

const LONG_PRESS_MS = 600

/**
 * Tela de login v5 (#s-login) com gate de Onboarding (#vonb) para novos usuarios.
 * - Topbar com #vito + "vito" + alternador circular de tema (#lg-th-tgl)
 * - Glow radial dinamico sincronizado a cena atual
 * - Palco central com 6 cenas interativas (toque avanca)
 * - Rodape com Google pill + linha WhatsApp/E-mail + Termos/Privacidade (13+)
 */
export const LoginScreen: React.FC<LoginScreenProps> = () => {
  const { login, register, loginWithGoogle, isLoading } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const insets = useSafeAreaInsets()
  const { state: demoState, advanceScene, reduceMotion } = useDemoLoop()
  const currentScene = DEMO_SCENES[demoState.sceneIndex]
  const palette = loginPalette(isDark)
  const glowColor = headlineColor(currentScene.tone, palette)

  const [onboardingChecked, setOnboardingChecked] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  const [sheetMode, setSheetMode] = useState<EmailSheetMode>('login')
  const [emailSheetVisible, setEmailSheetVisible] = useState(false)
  const [whatsappAuthVisible, setWhatsappAuthVisible] = useState(false)
  const [legalDoc, setLegalDoc] = useState<LegalDocKind | null>(null)
  const [sheetError, setSheetError] = useState<string | null>(null)
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { currentlyRunning } = Updates.useUpdates()

  useEffect(() => {
    let alive = true
    hasSeenOnboarding()
      .then((seen) => {
        if (!alive) return
        setShowOnboarding(!seen)
        setOnboardingChecked(true)
      })
      .catch(() => {
        if (!alive) return
        setShowOnboarding(false)
        setOnboardingChecked(true)
      })
    return () => {
      alive = false
    }
  }, [])

  const handleCompleteOnboarding = useCallback(() => {
    void markOnboardingSeen()
    setShowOnboarding(false)
  }, [])

  const handleGoogleLogin = useCallback(() => {
    loginWithGoogle()
  }, [loginWithGoogle])

  const handleWhatsAppLogin = useCallback(() => {
    setWhatsappAuthVisible(true)
  }, [])

  const handleOpenEmailLogin = useCallback(() => {
    setSheetMode('login')
    setSheetError(null)
    setEmailSheetVisible(true)
  }, [])

  const handleEmailLogin = useCallback(
    async (email: string, password: string) => {
      setSheetError(null)
      try {
        await login(email, password)
        setEmailSheetVisible(false)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : ''
        setSheetError(msg || 'Não foi possível entrar. Verifique seu e-mail e senha.')
      }
    },
    [login],
  )

  const handleEmailRegister = useCallback(
    async (name: string, email: string, password: string) => {
      setSheetError(null)
      try {
        await register(name, email, password)
        setEmailSheetVisible(false)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : ''
        setSheetError(msg || 'Não foi possível criar sua conta. Tente novamente.')
      }
    },
    [register],
  )

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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Falha de conexão.'
      console.warn('[LoginScreen] Erro ao verificar atualização:', e)
      Alert.alert('Verificação de Atualização', `Não foi possível verificar: ${msg}`)
    }
  }, [])

  const showBuildToast = useCallback(() => {
    const updateId = currentlyRunning?.updateId
    const buildText = updateId ? `OTA ${updateId.slice(0, 7)}` : 'v0.1.32'
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
    // Toque no palco avanca a cena (tratado no DemoStage).
  }, [])

  const rootStyle = useMemo<ViewStyle>(
    () => ({
      flex: 1,
      backgroundColor: palette.bg,
      paddingTop: Math.max(insets.top, 8),
      paddingBottom: Math.max(insets.bottom, 12),
    }),
    [palette.bg, insets.top, insets.bottom],
  )

  if (!onboardingChecked) {
    return <View style={{ flex: 1, backgroundColor: palette.bg }} />
  }

  if (showOnboarding) {
    return <OnboardingScreen onComplete={handleCompleteOnboarding} />
  }

  return (
    <View testID="s-login" style={rootStyle}>
      <View style={styles.glowBackdrop} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="lgGlowGrad" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={glowColor} stopOpacity={isDark ? GLOW_OPACITY_DARK : GLOW_OPACITY_LIGHT} />
              <Stop offset="100%" stopColor={glowColor} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#lgGlowGrad)" />
        </Svg>
      </View>

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
        />
      </View>

      <DemoStage
        state={demoState}
        advanceScene={advanceScene}
        reduceMotion={reduceMotion}
        onAdvance={handleDemoAdvance}
        style={styles.stage}
      />

      <AuthActionsFooter
        onGoogle={handleGoogleLogin}
        onWhatsApp={handleWhatsAppLogin}
        onEmail={handleOpenEmailLogin}
        onOpenLegal={setLegalDoc}
        loading={isLoading}
      />

      <EmailSheet
        visible={emailSheetVisible}
        mode={sheetMode}
        onClose={() => setEmailSheetVisible(false)}
        onLogin={handleEmailLogin}
        onRegister={handleEmailRegister}
        onSwitchMode={(nextMode) => {
          setSheetError(null)
          setSheetMode(nextMode)
        }}
        isLoading={isLoading}
        error={sheetError}
      />

      <WhatsAppAuthModal
        visible={whatsappAuthVisible}
        onClose={() => setWhatsappAuthVisible(false)}
        onPhoneNotLinked={(message) => {
          setWhatsappAuthVisible(false)
          setSheetMode('register')
          setSheetError(
            `${message} Crie sua conta com e-mail ou Google para continuar e vincule seu WhatsApp depois (Perfil → Conectar WhatsApp).`,
          )
          setEmailSheetVisible(true)
        }}
      />

      <LegalDocModal doc={legalDoc} onClose={() => setLegalDoc(null)} />
    </View>
  )
}

/** .lg-glow: 320px, opacity .14 (claro) / .20 (escuro). */
export const GLOW_SIZE = 320
const GLOW_OPACITY_LIGHT = '0.14'
const GLOW_OPACITY_DARK = '0.20'

const styles = StyleSheet.create({
  glowBackdrop: {
    position: 'absolute',
    top: '16%',
    left: '50%',
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    marginLeft: -GLOW_SIZE / 2,
    zIndex: 0,
  } as ViewStyle,
  stage: {
    flex: 1,
    minHeight: 0,
    zIndex: 1,
  } as ViewStyle,
})
