import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { TextInput } from '../ui/TextInput';
import { Button } from '../ui/Button';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { tokens } from '../../theme/tokens';

interface WhatsAppAuthModalProps {
  visible: boolean;
  onClose: () => void;
}

export const WhatsAppAuthModal: React.FC<WhatsAppAuthModalProps> = ({ visible, onClose }) => {
  const { colors } = useTheme();
  const { loginWithWhatsApp } = useAuth();

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    setStep('phone');
    setCode('');
    setError(null);
    setLoading(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleRequestOTP = async () => {
    setError(null);
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setError('Informe um número de telefone celular válido com DDD.');
      return;
    }

    setLoading(true);
    try {
      await api.requestWhatsAppOTP(cleanPhone);
      setStep('otp');
    } catch (err: any) {
      setError(err?.message || 'Falha ao enviar código via WhatsApp. Verifique o número.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setError(null);
    const cleanCode = code.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setError('O código de verificação deve ter 6 dígitos.');
      return;
    }

    setLoading(true);
    try {
      const cleanPhone = phone.replace(/[^\d+]/g, '');
      await loginWithWhatsApp(cleanPhone, cleanCode);
      handleClose();
    } catch (err: any) {
      setError(err?.message || 'Código incorreto ou expirado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={handleClose}
      title="Entrar com WhatsApp"
      subtitle="Acesso rápido e seguro sem precisar digitar senha"
    >
      <View style={styles.container}>
        {/* Banner Informativo */}
        <View style={[styles.infoCard, { backgroundColor: colors.surfaceContainerHigh }]}>
          <MaterialIcons name="chat" size={24} color="#25D366" />
          <Text style={[styles.infoText, { color: colors.onSurfaceVariant }]}>
            {step === 'phone'
              ? 'Enviaremos um código numérico de 6 dígitos para o seu WhatsApp oficial.'
              : `Digite o código de 6 dígitos enviado para ${phone}.`}
          </Text>
        </View>

        {!!error && (
          <View style={[styles.errorBox, { backgroundColor: colors.errorContainer }]}>
            <MaterialIcons name="error-outline" size={16} color={colors.onErrorContainer} />
            <Text style={[styles.errorText, { color: colors.onErrorContainer }]}>{error}</Text>
          </View>
        )}

        {step === 'phone' ? (
          <View style={styles.formSection}>
            <TextInput
              label="Número do WhatsApp"
              placeholder="+55 (11) 99999-8888"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(txt) => {
                setPhone(txt);
                if (error) setError(null);
              }}
              variant="outlined"
            />

            <Button
              label="Receber Código no WhatsApp"
              variant="filled"
              onPress={handleRequestOTP}
              isLoading={loading}
              style={{ marginTop: tokens.spacing.md }}
            />
          </View>
        ) : (
          <View style={styles.formSection}>
            <TextInput
              label="Código de 6 dígitos"
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={(txt) => {
                setCode(txt);
                if (error) setError(null);
              }}
              variant="outlined"
            />

            <Button
              label="Confirmar e Entrar"
              variant="filled"
              onPress={handleVerifyOTP}
              isLoading={loading}
              style={{ marginTop: tokens.spacing.md }}
            />

            <View style={styles.resendRow}>
              <TouchableOpacity
                onPress={() => {
                  setError(null);
                  setStep('phone');
                }}
                disabled={loading}
              >
                <Text style={[styles.resendText, { color: colors.primary }]}>
                  Alterar número
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleRequestOTP} disabled={loading}>
                <Text style={[styles.resendText, { color: colors.primary }]}>
                  Reenviar código
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: tokens.spacing.sm,
    gap: tokens.spacing.md,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    padding: tokens.spacing.md,
    borderRadius: tokens.radii.md,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: tokens.spacing.sm + 2,
    borderRadius: tokens.radii.sm,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  formSection: {
    gap: tokens.spacing.sm,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.xs,
    marginTop: tokens.spacing.sm,
  },
  resendText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
