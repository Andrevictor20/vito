import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { hapticFeedback } from '../../theme/motion';
import { api } from '../../services/api';
import { formatPhoneNumber, cleanPhoneNumber, isValidPhoneNumber } from '../../utils/phoneFormat';

interface PhoneEditModalProps {
  visible: boolean;
  currentPhone?: string;
  onClose: () => void;
  onPhoneUpdated: (newPhone: string) => void;
}

export const PhoneEditModal: React.FC<PhoneEditModalProps> = ({
  visible,
  currentPhone = '',
  onClose,
  onPhoneUpdated,
}) => {
  const { colors } = useTheme();
  const [phone, setPhone] = useState(formatPhoneNumber(currentPhone));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setPhone(formatPhoneNumber(currentPhone));
    }
  }, [visible, currentPhone]);

  const handleChangeText = (text: string) => {
    setPhone(formatPhoneNumber(text));
  };

  const handleSave = async () => {
    const cleaned = cleanPhoneNumber(phone);
    if (!cleaned) {
      Alert.alert('Telefone Inválido', 'Por favor, informe seu número de telefone.');
      return;
    }
    if (!isValidPhoneNumber(cleaned)) {
      Alert.alert('Telefone Inválido', 'O número deve conter DDD e de 10 a 15 dígitos.');
      return;
    }

    setSaving(true);
    try {
      await api.updatePhone(cleaned);
      hapticFeedback.success();
      onPhoneUpdated(cleaned);
      onClose();
    } catch (err: any) {
      hapticFeedback.medium();
      Alert.alert('Falha ao Salvar', err?.message || 'Não foi possível atualizar o telefone.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title="Número de Telefone">
      <View style={styles.content}>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Seu número é utilizado para matching seguro (Zero-Knowledge) com outros usuários do Vito na sua agenda de contatos.
        </Text>

        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: colors.onSurface }]}>Telefone Celular com DDD</Text>
          <View style={[styles.inputBox, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant }]}>
            <MaterialIcons name="phone" size={18} color={colors.primary} style={styles.icon} />
            <TextInput
              style={[styles.input, { color: colors.onSurface }]}
              placeholder="+55 (11) 98765-4321"
              placeholderTextColor={colors.onSurfaceVariant}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={handleChangeText}
              autoFocus
            />
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: colors.outlineVariant }]}
            onPress={onClose}
            disabled={saving}
            activeOpacity={0.7}
          >
            <Text style={[styles.cancelBtnText, { color: colors.onSurface }]}>Cancelar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <>
                <MaterialIcons name="check" size={18} color={colors.onPrimary} />
                <Text style={[styles.saveBtnText, { color: colors.onPrimary }]}>Salvar</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
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
    fontSize: tokens.typography.size.sm,
    lineHeight: 20,
    fontFamily: tokens.typography.family.regular,
  },
  inputContainer: {
    gap: 6,
    marginTop: 4,
  },
  label: {
    fontSize: tokens.typography.size.xs + 1,
    fontWeight: tokens.typography.weight.semibold,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: MD3Shapes.extraSmall,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: tokens.typography.size.md,
    fontFamily: tokens.typography.family.medium,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.md,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: MD3Shapes.extraSmall,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: MD3Shapes.extraSmall,
    gap: 6,
  },
  saveBtnText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.bold,
  },
});
