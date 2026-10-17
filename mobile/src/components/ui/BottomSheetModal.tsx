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
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { resolveKeyboardHeight, computeSheetBottomMetrics } from '../../utils/keyboardHeight';

export interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export const BottomSheetModal: React.FC<BottomSheetModalProps> = ({
  visible,
  onClose,
  children,
  title,
  subtitle,
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardOpenRef = useRef(false);
  const keyboardHeightRef = useRef(0);

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

  const bottomMetrics = computeSheetBottomMetrics(keyboardHeight, insets.bottom, Platform.OS);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderColor: colors.outlineVariant,
              marginBottom: bottomMetrics.marginBottom,
              paddingBottom: bottomMetrics.paddingBottom,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.outlineVariant }]} />
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
              onPress={onClose}
              hitSlop={12}
              accessibilityLabel="Fechar"
              accessibilityRole="button"
            >
              <MaterialIcons name="close" size={20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  titleWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'left',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 17,
    textAlign: 'left',
  },
  titleSpacer: {
    flex: 1,
  },
});
