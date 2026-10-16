import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  AppState,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { hapticFeedback } from '../../theme/motion';
import { api } from '../../services/api';
import { PhoneVerificationChallenge } from '../../services/api/p2pMeetingsApi';
import { formatPhoneNumber, isValidPhoneNumber, toE164Phone } from '../../utils/phoneFormat';
import { detectUserPhoneFromDevice } from '../../services/contactMatchingService';

interface PhoneEditModalProps {
  visible: boolean;
  currentPhone?: string;
  userName?: string;
  userEmail?: string;
  onClose: () => void;
  onPhoneUpdated: (newPhone: string) => void;
}

export const PhoneEditModal: React.FC<PhoneEditModalProps> = ({
  visible,
  currentPhone = '',
  userName,
  userEmail,
  onClose,
  onPhoneUpdated,
}) => {
  const { colors } = useTheme();
  const [phone, setPhone] = useState(formatPhoneNumber(currentPhone));
  const [suggestedPhone, setSuggestedPhone] = useState<string>('');
  const [step, setStep] = useState<'input' | 'verify'>('input');
  const [challenge, setChallenge] = useState<PhoneVerificationChallenge | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setPhone(formatPhoneNumber(currentPhone));
      setStep('input');
      setChallenge(null);
      setCode('');
      detectUserPhoneFromDevice(userEmail, userName).then(detected => {
        if (detected && detected !== toE164Phone(currentPhone)) {
          setSuggestedPhone(detected);
        } else {
          setSuggestedPhone('');
        }
      });
    }
  }, [visible, currentPhone, userEmail, userName]);

  const checkTokenStatus = useCallback(async (activeChallenge: PhoneVerificationChallenge) => {
    try {
      const res = await api.verifyPhoneCode({ token: activeChallenge.token });
      if (res?.verified && res.phone) {
        hapticFeedback.success();
        onPhoneUpdated(res.phone);
        onClose();
      }
    } catch {
      // Silencioso no polling em background
    }
  }, [onClose, onPhoneUpdated]);

  // Verifica automaticamente quando o usuário volta do WhatsApp para o Vito
  useEffect(() => {
    if (!visible || step !== 'verify' || !challenge) return;

    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        checkTokenStatus(challenge);
      }
    });

    const timer = setInterval(() => {
      checkTokenStatus(challenge);
    }, 3500);

    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [visible, step, challenge, checkTokenStatus]);

  const handleRequestWhatsAppVerification = async () => {
    const e164 = toE164Phone(phone);
    if (!e164 || !isValidPhoneNumber(e164)) {
      Alert.alert('Telefone Inválido', 'Informe seu celular com DDD (ex: 11 98765-4321).');
      return;
    }

    setLoading(true);
    try {
      const ch = await api.requestPhoneVerification(e164);
      setChallenge(ch);
      setStep('verify');
      hapticFeedback.light();

      if (ch.whatsapp_url) {
        try {
          await Linking.openURL(ch.whatsapp_url);
        } catch {
          // Caso o WhatsApp não abra automaticamente, o usuário pode tocar no botão ou digitar o código
        }
      }
    } catch (err: any) {
      hapticFeedback.medium();
      Alert.alert('Não foi possível iniciar', err?.message || 'Verifique o número informado.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCode = async () => {
    const trimmed = code.replace(/\D/g, '');
    if (trimmed.length !== 6) {
      Alert.alert('Código Inválido', 'Digite os 6 dígitos exibidos na mensagem do WhatsApp.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.verifyPhoneCode({ code: trimmed });
      if (res?.verified) {
        hapticFeedback.success();
        onPhoneUpdated(res.phone);
        onClose();
      }
    } catch (err: any) {
      hapticFeedback.medium();
      Alert.alert('Código Inválido', err?.message || 'O código informado está incorreto ou expirou.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title="Confirmar Telefone">
      <View style={styles.content}>
        {step === 'input' ? (
          <>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              Para encontrar seus contatos e agendar reuniões com mais facilidade, vamos confirmar seu número pelo WhatsApp.
            </Text>

            {suggestedPhone ? (
              <TouchableOpacity
                style={[styles.suggestionChip, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}
                onPress={() => {
                  hapticFeedback.light();
                  setPhone(formatPhoneNumber(suggestedPhone));
                }}
                activeOpacity={0.75}
              >
                <MaterialIcons name="smartphone" size={16} color={colors.primary} />
                <Text style={[styles.suggestionText, { color: colors.onSurface }]}>
                  Usar número detectado: <Text style={{ fontWeight: '700' }}>{formatPhoneNumber(suggestedPhone)}</Text>
                </Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>CELULAR COM DDD</Text>
              <View style={[styles.inputBox, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
                <MaterialIcons name="phone" size={18} color={colors.onSurfaceVariant} style={styles.icon} />
                <TextInput
                  style={[styles.input, { color: colors.onSurface }]}
                  placeholder="+55 (11) 98765-4321"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  importantForAutofill="yes"
                  value={phone}
                  onChangeText={t => setPhone(formatPhoneNumber(t))}
                  autoFocus
                />
              </View>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.outlineVariant }]}
                onPress={onClose}
                disabled={loading}
              >
                <Text style={[styles.cancelBtnText, { color: colors.onSurface }]}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={handleRequestWhatsAppVerification}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <>
                    <MaterialIcons name="verified-user" size={17} color={colors.onPrimary} />
                    <Text style={[styles.primaryBtnText, { color: colors.onPrimary }]}>Confirmar via WhatsApp</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={[styles.verifyCard, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
              <View style={styles.verifyPhoneRow}>
                <Text style={[styles.verifyPhoneText, { color: colors.onSurface }]}>
                  {formatPhoneNumber(challenge?.phone || phone)}
                </Text>
                <TouchableOpacity onPress={() => setStep('input')}>
                  <Text style={[styles.changePhoneLink, { color: colors.textSecondary }]}>Alterar</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.verifyHint, { color: colors.textSecondary }]}>
                1. Toque em enviar na mensagem que abriu no WhatsApp.{'\n'}
                2. Clique no link recebido <Text style={{ fontWeight: '700', color: colors.onSurface }}>ou</Text> digite o código de 6 dígitos abaixo:
              </Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>CÓDIGO DE 6 DÍGITOS</Text>
              <View style={[styles.inputBox, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
                <MaterialIcons name="lock-outline" size={18} color={colors.onSurfaceVariant} style={styles.icon} />
                <TextInput
                  style={[styles.input, styles.codeInput, { color: colors.onSurface }]}
                  placeholder="000000"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={code}
                  onChangeText={setCode}
                />
              </View>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.outlineVariant }]}
                onPress={() => challenge?.whatsapp_url && Linking.openURL(challenge.whatsapp_url)}
                disabled={loading}
              >
                <Text style={[styles.cancelBtnText, { color: colors.onSurface }]}>Abrir WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={handleConfirmCode}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <>
                    <MaterialIcons name="check" size={18} color={colors.onPrimary} />
                    <Text style={[styles.primaryBtnText, { color: colors.onPrimary }]}>Validar Código</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl,
    gap: tokens.spacing.md,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: MD3Shapes.medium,
    borderWidth: 1,
  },
  suggestionText: {
    fontSize: 13,
  },
  inputContainer: {
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 50,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  codeInput: {
    letterSpacing: 4,
    fontSize: 18,
    fontWeight: '700',
  },
  verifyCard: {
    padding: 14,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    gap: 8,
  },
  verifyPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  verifyPhoneText: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  changePhoneLink: {
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  verifyHint: {
    fontSize: 12,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: MD3Shapes.large,
    gap: 6,
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
