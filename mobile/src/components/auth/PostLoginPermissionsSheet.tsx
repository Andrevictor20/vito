import React, { useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { ProtoUiIcon } from '../../icons/ProtoUiIcons';
import { useTheme } from '../../context/ThemeContext'
import { loginPalette } from '../login/loginPalette'
import { BellIcon, CalIcon, MicIcon } from '../login/DemoIcons'
import { notificationService } from '../../services/notificationService'
import { nativeCalendarService } from '../../services/nativeCalendarService'
import { SafeAudioRecorder } from '../../services/audioRecorder'
import {
  DEFAULT_PERM_PREFS,
  markPostLoginPermsPrompted,
  type PostLoginPermissionPrefs,
} from './onboardingStorage'

export interface PostLoginPermissionsSheetProps {
  visible: boolean
  onClose: () => void
}

/**
 * Sheet pos-login ("Permitir acesso?") exibido apos o 1o login concluido.
 * Switches para Notificacoes, Calendario e Microfone.
 */
export const PostLoginPermissionsSheet: React.FC<PostLoginPermissionsSheetProps> = ({
  visible,
  onClose,
}) => {
  const { isDark } = useTheme()
  const palette = loginPalette(isDark)
  const [prefs, setPrefs] = useState<PostLoginPermissionPrefs>(DEFAULT_PERM_PREFS)
  const [submitting, setSubmitting] = useState(false)

  const toggle = (key: keyof PostLoginPermissionPrefs) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleContinue = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      if (prefs.notif) {
        await notificationService
          .requestPermissions()
          .then(() => notificationService.syncPushTokenWithBackend().catch(() => undefined))
          .catch(() => undefined)
      }
      if (prefs.cal) {
        await nativeCalendarService.requestPermissions().catch(() => undefined)
      }
      if (prefs.mic) {
        await SafeAudioRecorder.requestPermissions().catch(() => undefined)
      }
      await markPostLoginPermsPrompted(prefs)
    } finally {
      setSubmitting(false)
      onClose()
    }
  }

  const rows: {
    key: keyof PostLoginPermissionPrefs
    title: string
    subtitle: string
    icon: React.ReactNode
  }[] = [
    {
      key: 'notif',
      title: 'Notificações',
      subtitle: 'Avisar sobre eventos e tarefas',
      icon: <BellIcon color={palette.ink} size={20} />,
    },
    {
      key: 'cal',
      title: 'Calendário',
      subtitle: 'Sincronizar sua agenda',
      icon: <CalIcon color={palette.ink} size={20} />,
    },
    {
      key: 'mic',
      title: 'Microfone',
      subtitle: 'Falar com o Vito por voz',
      icon: <MicIcon color={palette.ink} size={20} />,
    },
  ]

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleContinue}
    >
      <View style={styles.root}>
        <TouchableWithoutFeedback onPress={handleContinue}>
          <View style={styles.scrim} />
        </TouchableWithoutFeedback>

        <View testID="perms-sheet" style={[styles.sheet, { backgroundColor: palette.bg }]}>
          <View style={[styles.handle, { backgroundColor: palette.line }]} />

          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: palette.ink }]}>Permitir acesso?</Text>
              <Text style={[styles.subtitle, { color: palette.muted }]}>
                Você pode mudar isso depois em Privacidade e dados
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleContinue}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              style={[styles.closeBtn, { backgroundColor: palette.btn }]}
            >
              <ProtoUiIcon name="close" size={18} color={palette.ink} />
            </TouchableOpacity>
          </View>

          <View style={[styles.listCard, { backgroundColor: palette.surf, borderColor: palette.hairline }]}>
            {rows.map((row, idx) => (
              <View
                key={row.key}
                style={[
                  styles.row,
                  idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line },
                ]}
              >
                <View style={styles.rowIcon}>{row.icon}</View>
                <View style={styles.rowBody}>
                  <Text style={[styles.rowTitle, { color: palette.ink }]}>{row.title}</Text>
                  <Text style={[styles.rowSub, { color: palette.muted }]}>{row.subtitle}</Text>
                </View>
                <Switch
                  value={prefs[row.key]}
                  onValueChange={() => toggle(row.key)}
                  accessibilityLabel={row.title}
                  trackColor={{ false: palette.line, true: palette.acc }}
                  thumbColor="#ffffff"
                />
              </View>
            ))}
          </View>

          <Text style={[styles.finePrint, { color: palette.muted }]}>
            O sistema pedirá confirmação para cada permissão.
          </Text>

          <TouchableOpacity
            onPress={handleContinue}
            disabled={submitting}
            activeOpacity={0.86}
            accessibilityRole="button"
            accessibilityLabel="Continuar"
            style={[styles.ctaBtn, { backgroundColor: palette.ink }]}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={palette.bg} />
            ) : (
              <Text style={[styles.ctaText, { color: palette.bg }]}>Continuar</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  } as ViewStyle,
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  } as ViewStyle,
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 28,
  } as ViewStyle,
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  } as ViewStyle,
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  } as ViewStyle,
  headerText: {
    flex: 1,
  } as ViewStyle,
  title: {
    fontFamily: 'Geist_600SemiBold',
    fontSize: 22,
    letterSpacing: -0.44,
  } as TextStyle,
  subtitle: {
    fontFamily: 'Geist_400Regular',
    fontSize: 13.5,
    marginTop: 2,
  } as TextStyle,
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  listCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  } as ViewStyle,
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  } as ViewStyle,
  rowIcon: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  rowBody: {
    flex: 1,
    minWidth: 0,
  } as ViewStyle,
  rowTitle: {
    fontFamily: 'Geist_500Medium',
    fontSize: 15,
  } as TextStyle,
  rowSub: {
    fontFamily: 'Geist_400Regular',
    fontSize: 12.5,
    marginTop: 2,
  } as TextStyle,
  finePrint: {
    fontFamily: 'Geist_400Regular',
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 10,
  } as TextStyle,
  ctaBtn: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  } as ViewStyle,
  ctaText: {
    fontFamily: 'Geist_600SemiBold',
    fontSize: 15.5,
  } as TextStyle,
})
