import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  BackHandler,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';

export interface ConfirmDeleteModalProps {
  visible: boolean;
  title: string;
  message: string;
  isRecurring?: boolean;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: (allSeries?: boolean) => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  visible,
  title,
  message,
  isRecurring = false,
  confirmLabel = 'Excluir',
  onClose,
  onConfirm,
}) => {
  const { colors, isDark } = useTheme();

  // Fecha no gesto de voltar do Android
  useEffect(() => {
    if (!visible) return;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });

    return () => sub.remove();
  }, [visible, onClose]);

  if (!visible) return null;

  const handleCancel = () => {
    hapticFeedback.light();
    onClose();
  };

  const handleConfirmSingle = () => {
    hapticFeedback.medium();
    onClose();
    onConfirm(false);
  };

  const handleConfirmSeries = () => {
    hapticFeedback.medium();
    onClose();
    onConfirm(true);
  };

  const overlayBg = isDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(0, 0, 0, 0.45)';
  const cardBg = colors.surface;
  const borderColor = colors.outlineVariant || (isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.08)');
  const dangerColor = colors.red || '#EF4444';
  const dangerBg = isDark ? 'rgba(239, 68, 68, 0.14)' : 'rgba(239, 68, 68, 0.08)';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        {/* Backdrop clicável */}
        <TouchableWithoutFeedback onPress={handleCancel} accessibilityLabel="Fechar diálogo">
          <View style={[styles.overlay, { backgroundColor: overlayBg }]} />
        </TouchableWithoutFeedback>

        {/* Card Centralizado (Design do Vito) */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: cardBg,
              borderColor,
            },
          ]}
          accessibilityRole="alert"
        >
          {/* Ícone de Perigo / Lixeira com halo */}
          <View style={[styles.iconBox, { backgroundColor: dangerBg }]}>
            <MaterialIcons name="delete-outline" size={24} color={dangerColor} />
          </View>

          {/* Título e Mensagem */}
          <Text style={[styles.title, { color: colors.onSurface }]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={[styles.message, { color: colors.textMuted }]}>
            {message}
          </Text>

          {/* Ações */}
          <View style={styles.buttonGroup}>
            {isRecurring ? (
              <>
                <TouchableOpacity
                  style={[styles.btn, styles.btnDanger, { backgroundColor: dangerColor }]}
                  onPress={handleConfirmSingle}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnDangerText}>Apenas este compromisso</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, styles.btnDangerOutline, { borderColor: dangerColor }]}
                  onPress={handleConfirmSeries}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.btnDangerOutlineText, { color: dangerColor }]}>
                    Toda a série recorrente
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, styles.btnCancel, { borderColor }]}
                  onPress={handleCancel}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.btnCancelText, { color: colors.onSurface }]}>Cancelar</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.rowButtons}>
                <TouchableOpacity
                  style={[styles.btnHalf, styles.btnCancel, { borderColor }]}
                  onPress={handleCancel}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.btnCancelText, { color: colors.onSurface }]}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btnHalf, styles.btnDanger, { backgroundColor: dangerColor }]}
                  onPress={handleConfirmSingle}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnDangerText}>{confirmLabel}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 24,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 17,
    textAlign: 'center',
    marginBottom: 6,
  },
  message: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  buttonGroup: {
    width: '100%',
    gap: 10,
  },
  rowButtons: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  btn: {
    width: '100%',
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnHalf: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDanger: {
    elevation: 2,
  },
  btnDangerText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  btnDangerOutline: {
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  btnDangerOutlineText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  btnCancel: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  btnCancelText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
});
