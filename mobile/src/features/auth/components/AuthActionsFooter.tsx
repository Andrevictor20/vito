import React from 'react'
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { GoogleIcon } from '../../../components/common/GoogleIcon'
import { MailIcon, WhatsAppGlyph } from '../demo/DemoIcons'
import { useTheme } from '../../../context/ThemeContext'
import { loginPalette } from '../utils/loginPalette'
import type { LegalDocKind } from './LegalDocModal'

export interface AuthActionsFooterProps {
  onGoogle: () => void
  onWhatsApp: () => void
  onEmail: () => void
  onOpenLegal: (doc: LegalDocKind) => void
  loading?: boolean
}

/**
 * Rodape de autenticacao v5 (#s-login .lg-auth):
 * - CTA primario pill: "Continuar com Google"
 * - Linha secundaria: "WhatsApp" + "E-mail"
 * - Aviso legal clicavel: Termos de Uso e Politica de Privacidade ("Uso a partir de 13 anos.")
 */
export const AuthActionsFooter: React.FC<AuthActionsFooterProps> = ({
  onGoogle,
  onWhatsApp,
  onEmail,
  onOpenLegal,
  loading = false,
}) => {
  const { isDark } = useTheme()
  const palette = loginPalette(isDark)

  return (
    <View style={styles.authFooter}>
      <TouchableOpacity
        testID="lg-google"
        onPress={onGoogle}
        disabled={loading}
        activeOpacity={0.86}
        accessibilityRole="button"
        accessibilityLabel="Continuar com Google"
        style={[
          styles.primaryBtn,
          {
            backgroundColor: palette.ink,
            opacity: loading ? 0.6 : 1,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={palette.bg} />
        ) : (
          <View style={styles.googleBadge}>
            <GoogleIcon size={15} />
          </View>
        )}
        <Text style={[styles.primaryBtnText, { color: palette.bg }]}>
          Continuar com Google
        </Text>
      </TouchableOpacity>

      <View style={styles.secRow}>
        <TouchableOpacity
          testID="lg-wa"
          onPress={onWhatsApp}
          disabled={loading}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel="Entrar com WhatsApp"
          style={[
            styles.secBtn,
            {
              backgroundColor: palette.surf,
              borderColor: palette.hairline,
            },
          ]}
        >
          <WhatsAppGlyph color={palette.wa} size={18} />
          <Text style={[styles.secBtnText, { color: palette.ink }]}>
            WhatsApp
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="lg-mail"
          onPress={onEmail}
          disabled={loading}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel="Entrar com E-mail"
          style={[
            styles.secBtn,
            {
              backgroundColor: palette.surf,
              borderColor: palette.hairline,
            },
          ]}
        >
          <MailIcon color={palette.ink} size={18} />
          <Text style={[styles.secBtnText, { color: palette.ink }]}>
            E-mail
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.legalText, { color: palette.muted }]}>
        Ao continuar, você concorda com os{' '}
        <Text
          onPress={() => onOpenLegal('terms')}
          accessibilityRole="link"
          style={[styles.legalLink, { color: palette.ink }]}
        >
          Termos de Uso
        </Text>
        {' '}e a{' '}
        <Text
          onPress={() => onOpenLegal('priv')}
          accessibilityRole="link"
          style={[styles.legalLink, { color: palette.ink }]}
        >
          Política de Privacidade
        </Text>
        . Uso a partir de 13 anos.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  authFooter: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 10,
  } as ViewStyle,
  primaryBtn: {
    width: '100%',
    height: 52,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.14,
        shadowRadius: 20,
      },
      default: {},
    }),
  } as ViewStyle,
  googleBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  primaryBtnText: {
    fontFamily: 'Geist_600SemiBold',
    fontSize: 15,
    letterSpacing: -0.15,
  } as TextStyle,
  secRow: {
    flexDirection: 'row',
    gap: 10,
  } as ViewStyle,
  secBtn: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  } as ViewStyle,
  secBtnText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 14,
  } as TextStyle,
  legalText: {
    textAlign: 'center',
    fontFamily: 'Geist_400Regular',
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 4,
  } as TextStyle,
  legalLink: {
    fontFamily: 'Geist_600SemiBold',
    textDecorationLine: 'underline',
  } as TextStyle,
})
