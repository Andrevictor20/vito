import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  KeyboardEvent,
  BackHandler,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';
import { resolveKeyboardHeight } from '../../utils/keyboardHeight';

export interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

/**
 * Modal centralizado no design system do Vito (cartão flutuante com cantos arredondados de 24px,
 * animação fade, backdrop suave e responsivo ao teclado).
 */
export const BottomSheetModal: React.FC<BottomSheetModalProps> = ({
  visible,
  onClose,
  children,
  title,
  subtitle,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardOpenRef = useRef(false);
  const keyboardHeightRef = useRef(0);

  useEffect(() => {
    if (!visible) return;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });

    return () => sub.remove();
  }, [visible, onClose]);

  useEffect(() => {
    if (!visible) {
      keyboardOpenRef.current = false;
      keyboardHeightRef.current = 0;
      setKeyboardHeight(0);
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: KeyboardEvent) => {
      const h = e?.endCoordinates?.height || 0;
      const resolved = resolveKeyboardHeight(keyboardHeightRef.current, keyboardOpenRef.current, h);
      if (resolved === null) return;
      keyboardHeightRef.current = resolved;
      keyboardOpenRef.current = true;
      setKeyboardHeight(resolved);
    };

    const onHide = () => {
      keyboardHeightRef.current = 0;
      keyboardOpenRef.current = false;
      setKeyboardHeight(0);
    };

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [visible]);

  if (!visible) return null;

  const handleClose = () => {
    hapticFeedback.light();
    onClose();
  };

  const overlayBg = isDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(0, 0, 0, 0.45)';
  const cardBorder = colors.outlineVariant || (isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.08)');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        {/* Backdrop suave clicável */}
        <TouchableWithoutFeedback onPress={handleClose} accessibilityLabel="Fechar modal">
          <View style={[styles.overlay, { backgroundColor: overlayBg }]} />
        </TouchableWithoutFeedback>

        {/* Card Centralizado com proteção de teclado */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.avoidingWrap}
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: cardBorder,
              },
            ]}
          >
            <View style={styles.header}>
              <View style={styles.titleWrap}>
                {title ? (
                  <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>
                ) : (
                  <View style={styles.titleSpacer} />
                )}
                {subtitle ? (
                  <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={handleClose}
                hitSlop={12}
                accessibilityLabel="Fechar"
                accessibilityRole="button"
                style={styles.closeBtn}
              >
                <MaterialIcons name="close" size={20} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>
            {children}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  avoidingWrap: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 22,
    maxHeight: '88%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
  },
  titleWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'left',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'left',
  },
  titleSpacer: {
    flex: 1,
  },
  closeBtn: {
    padding: 4,
    borderRadius: 12,
  },
});
