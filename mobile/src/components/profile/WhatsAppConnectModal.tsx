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
  ScrollView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../context/ThemeContext';
import { tokens } from '../../theme/tokens';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { api, WhatsAppIntegrationStatus } from '../../services/api';
import { formatPhoneNumber, isValidPhoneNumber } from '../../utils/phoneFormat';

interface WhatsAppConnectModalProps {
  visible: boolean;
  onClose: () => void;
  defaultPhone?: string;
  onStatusChanged?: () => void;
}

export const WhatsAppConnectModal: React.FC<WhatsAppConnectModalProps> = ({
  visible,
  onClose,
  defaultPhone = '',
  onStatusChanged,
}) => {
  const { colors } = useTheme();

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [phone, setPhone] = useState(defaultPhone ? formatPhoneNumber(defaultPhone) : '');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [connectedPhone, setConnectedPhone] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res: WhatsAppIntegrationStatus = await api.getWhatsAppStatus();
      if (res?.status) {
        setStatus(res.status);
      }
      if (res?.phone) {
        setConnectedPhone(res.phone);
        if (!phone) {
          setPhone(formatPhoneNumber(res.phone));
        }
      }
      if (res?.pairing_code && res.status === 'connecting') {
        setPairingCode(res.pairing_code);
      }
    } catch (err: any) {
      // Ignora erro inicial se não houver conexão salva
    } finally {
      setLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    if (visible) {
      if (defaultPhone && !phone) {
        setPhone(formatPhoneNumber(defaultPhone));
      }
      fetchStatus();
    } else {
      setPairingCode(null);
      setCopied(false);
      setErrorMessage(null);
    }
  }, [visible, defaultPhone, fetchStatus]);

  const handlePhoneChange = (text: string) => {
    setPhone(formatPhoneNumber(text));
    setErrorMessage(null);
  };

  const handleRequestPairingCode = async () => {
    if (!isValidPhoneNumber(phone)) {
      setErrorMessage('Por favor, informe um número de celular válido com DDD.');
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.requestWhatsAppPairingCode(phone);
      if (res?.pairing_code) {
        setPairingCode(res.pairing_code);
        setStatus('connecting');
        onStatusChanged?.();
      } else {
        setErrorMessage('Não foi possível obter o código de pareamento. Verifique a Evolution API.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao solicitar código de pareamento.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!pairingCode) return;
    await Clipboard.setStringAsync(pairingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenWhatsApp = async () => {
    const waUrl = 'whatsapp://';
    try {
      const supported = await Linking.canOpenURL(waUrl);
      if (supported) {
        await Linking.openURL(waUrl);
      } else {
        await Linking.openURL('https://web.whatsapp.com');
      }
    } catch {
      Alert.alert('WhatsApp', 'Não foi possível abrir o WhatsApp automaticamente no dispositivo.');
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Desconectar WhatsApp',
      'Deseja desconectar a integração do Vito com seu WhatsApp?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await api.disconnectWhatsApp();
              setStatus('disconnected');
              setPairingCode(null);
              setConnectedPhone('');
              onStatusChanged?.();
            } catch (err: any) {
              Alert.alert('Erro ao Desconectar', err?.message || 'Falha ao desconectar WhatsApp.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const isConnected = status === 'connected';

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Conectar WhatsApp"
      subtitle="Evolution API v2 & Inteligência no Mensageiro"
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.onSurfaceVariant }]}>
              Carregando estado da integração...
            </Text>
          </View>
        ) : isConnected ? (
          <View style={styles.section}>
            {/* Card Conectado */}
            <View
              style={[
                styles.connectedCard,
                {
                  backgroundColor: colors.surfaceContainer,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <View style={styles.statusRow}>
                <View style={[styles.statusBadge, { backgroundColor: '#E8F5E9' }]}>
                  <MaterialIcons name="check-circle" size={16} color="#2E7D32" />
                  <Text style={[styles.statusBadgeText, { color: '#1B5E20' }]}>CONECTADO</Text>
                </View>
                <Text style={[styles.phoneLabel, { color: colors.onSurface }]}>
                  {formatPhoneNumber(connectedPhone || phone)}
                </Text>
              </View>

              <Text style={[styles.cardDescription, { color: colors.onSurfaceVariant }]}>
                Seu Vito agora está vinculado ao WhatsApp! Você pode enviar mensagens diretamente para ele ou chamá-lo em grupos.
              </Text>

              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <MaterialIcons name="chat" size={18} color={colors.primary} />
                  <Text style={[styles.featureText, { color: colors.onSurface }]}>
                    Converse diretamente para criar tarefas e gerenciar sua agenda.
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialIcons name="alternate-email" size={18} color={colors.primary} />
                  <Text style={[styles.featureText, { color: colors.onSurface }]}>
                    Use <Text style={{ fontWeight: '700' }}>@vito</Text> em grupos para obter respostas instantâneas.
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialIcons name="security" size={18} color={colors.primary} />
                  <Text style={[styles.featureText, { color: colors.onSurface }]}>
                    Privacidade total: mensagens sem @vito em grupos são 100% ignoradas.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.disconnectBtn, { borderColor: colors.error }]}
                onPress={handleDisconnect}
                disabled={actionLoading}
                accessibilityRole="button"
                accessibilityLabel="Desconectar WhatsApp"
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <>
                    <MaterialIcons name="link-off" size={18} color={colors.error} />
                    <Text style={[styles.disconnectBtnText, { color: colors.error }]}>
                      Desconectar WhatsApp
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            {/* Card Pareamento com Código */}
            <View
              style={[
                styles.pairingCard,
                {
                  backgroundColor: colors.surfaceContainer,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <Text style={[styles.inputLabel, { color: colors.onSurface }]}>
                Número de Celular com DDD
              </Text>
              <Text style={[styles.inputHint, { color: colors.onSurfaceVariant }]}>
                Exemplo: (11) 99999-8888
              </Text>

              <View
                style={[
                  styles.inputBox,
                  {
                    backgroundColor: colors.surfaceContainerHigh,
                    borderColor: errorMessage ? colors.error : colors.outlineVariant,
                  },
                ]}
              >
                <MaterialIcons name="phone" size={20} color={colors.onSurfaceVariant} />
                <TextInput
                  style={[styles.textInput, { color: colors.onSurface }]}
                  placeholder="(11) 99999-8888"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={handlePhoneChange}
                  editable={!actionLoading}
                />
              </View>

              {errorMessage && (
                <Text style={[styles.errorMsg, { color: colors.error }]}>{errorMessage}</Text>
              )}

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  { backgroundColor: colors.primary },
                  actionLoading && { opacity: 0.7 },
                ]}
                onPress={handleRequestPairingCode}
                disabled={actionLoading}
                accessibilityRole="button"
                accessibilityLabel="Gerar código de pareamento"
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <>
                    <MaterialIcons name="vpn-key" size={18} color={colors.onPrimary} />
                    <Text style={[styles.primaryBtnText, { color: colors.onPrimary }]}>
                      Gerar Código de Pareamento
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {pairingCode && (
              <View
                style={[
                  styles.codeDisplayCard,
                  {
                    backgroundColor: colors.surfaceContainerLow,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Text style={[styles.codeCardTitle, { color: colors.primary }]}>
                  Código de Pareamento de 8 Dígitos
                </Text>

                <View style={[styles.codeHighlightBox, { backgroundColor: colors.surfaceContainerHighest }]}>
                  <Text style={[styles.codeText, { color: colors.onSurface }]}>
                    {pairingCode}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.copyBtn,
                    { backgroundColor: copied ? '#E8F5E9' : colors.surfaceContainerHigh },
                  ]}
                  onPress={handleCopyCode}
                  accessibilityRole="button"
                  accessibilityLabel="Copiar código"
                >
                  <MaterialIcons
                    name={copied ? 'check' : 'content-copy'}
                    size={18}
                    color={copied ? '#2E7D32' : colors.primary}
                  />
                  <Text
                    style={[
                      styles.copyBtnText,
                      { color: copied ? '#1B5E20' : colors.primary },
                    ]}
                  >
                    {copied ? 'Código Copiado!' : 'Copiar Código'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.instructionsBox}>
                  <Text style={[styles.instructionsTitle, { color: colors.onSurface }]}>
                    Como conectar no seu WhatsApp:
                  </Text>
                  <Text style={[styles.instructionStep, { color: colors.onSurfaceVariant }]}>
                    1. Abra o WhatsApp no seu smartphone.
                  </Text>
                  <Text style={[styles.instructionStep, { color: colors.onSurfaceVariant }]}>
                    2. Toque em <Text style={{ fontWeight: '700' }}>Configurações / Aparelhos Conectados</Text>.
                  </Text>
                  <Text style={[styles.instructionStep, { color: colors.onSurfaceVariant }]}>
                    3. Toque em <Text style={{ fontWeight: '700' }}>Conectar um aparelho</Text> e depois em{' '}
                    <Text style={{ fontWeight: '700' }}>Conectar com número de telefone</Text>.
                  </Text>
                  <Text style={[styles.instructionStep, { color: colors.onSurfaceVariant }]}>
                    4. Cole o código <Text style={{ fontWeight: '700' }}>{pairingCode}</Text> e confirme.
                  </Text>
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.secondaryActionBtn, { borderColor: colors.outlineVariant }]}
                    onPress={handleOpenWhatsApp}
                    accessibilityRole="button"
                    accessibilityLabel="Abrir WhatsApp"
                  >
                    <MaterialIcons name="open-in-new" size={18} color={colors.primary} />
                    <Text style={[styles.secondaryActionText, { color: colors.primary }]}>
                      Abrir WhatsApp
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.secondaryActionBtn, { borderColor: colors.outlineVariant }]}
                    onPress={fetchStatus}
                    accessibilityRole="button"
                    accessibilityLabel="Verificar conexão"
                  >
                    <MaterialIcons name="refresh" size={18} color={colors.onSurface} />
                    <Text style={[styles.secondaryActionText, { color: colors.onSurface }]}>
                      Verificar Conexão
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl,
  },
  centerBox: {
    padding: tokens.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: tokens.spacing.sm,
    fontSize: tokens.typography.size.sm,
  },
  section: {
    gap: tokens.spacing.md,
  },
  connectedCard: {
    padding: tokens.spacing.lg,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    gap: tokens.spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 4,
    borderRadius: tokens.radii.full,
  },
  statusBadgeText: {
    fontSize: tokens.typography.size.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  phoneLabel: {
    fontSize: tokens.typography.size.md,
    fontWeight: '700',
  },
  cardDescription: {
    fontSize: tokens.typography.size.sm,
    lineHeight: 20,
  },
  featuresList: {
    gap: tokens.spacing.sm,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.sm,
  },
  featureText: {
    flex: 1,
    fontSize: tokens.typography.size.sm,
    lineHeight: 18,
  },
  disconnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    marginTop: tokens.spacing.xs,
  },
  disconnectBtnText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: '600',
  },
  pairingCard: {
    padding: tokens.spacing.lg,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    gap: tokens.spacing.sm,
  },
  inputLabel: {
    fontSize: tokens.typography.size.sm,
    fontWeight: '600',
  },
  inputHint: {
    fontSize: tokens.typography.size.xs,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
  },
  textInput: {
    flex: 1,
    fontSize: tokens.typography.size.md,
    paddingVertical: tokens.spacing.xs,
  },
  errorMsg: {
    fontSize: tokens.typography.size.xs,
    marginTop: 2,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    marginTop: tokens.spacing.sm,
  },
  primaryBtnText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: '600',
  },
  codeDisplayCard: {
    padding: tokens.spacing.lg,
    borderRadius: tokens.radii.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    gap: tokens.spacing.md,
    alignItems: 'center',
  },
  codeCardTitle: {
    fontSize: tokens.typography.size.sm,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  codeHighlightBox: {
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.xl,
    borderRadius: tokens.radii.md,
    alignItems: 'center',
  },
  codeText: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.lg,
    borderRadius: tokens.radii.full,
  },
  copyBtnText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: '600',
  },
  instructionsBox: {
    alignSelf: 'stretch',
    gap: 6,
    paddingTop: tokens.spacing.xs,
  },
  instructionsTitle: {
    fontSize: tokens.typography.size.sm,
    fontWeight: '700',
    marginBottom: 2,
  },
  instructionStep: {
    fontSize: tokens.typography.size.xs,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
    width: '100%',
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
  },
  secondaryActionText: {
    fontSize: tokens.typography.size.xs,
    fontWeight: '600',
  },
});
