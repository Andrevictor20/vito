import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Keyboard,
  type KeyboardEvent,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';
import { resolveKeyboardHeight } from '../../utils/keyboardHeight';
import { useReduceMotion } from '../../theme/useReduceMotion';

export interface VitoSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  /** Alça superior de arrastar/fechar (padrão do protótipo). */
  showHandle?: boolean;
}

/**
 * VitoSheet — port fiel do `.sheet2` de Vito-telas-atualizadas.html (L511–L516, L1126–L1130).
 *
 * - scrim `rgba(0,0,0,.4)` com `backdrop-filter: blur(6px)`, fade 340ms ease-std;
 * - sheet sobe de `translateY(105%)` para `0` em 460ms ease-q e desce em 300ms ease-in;
 * - raio superior 28px, `max-height: 94%`, sombra `0 -10px 40px rgba(0,0,0,.2)`;
 * - alça `.hd` (barra 38×4) e botão `.sh-close` circular de 44px;
 * - respeita ReduceMotion e sobe acima do teclado.
 */
export const VitoSheet: React.FC<VitoSheetProps> = ({
  visible,
  onClose,
  children,
  title,
  subtitle,
  showHandle = true,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const reduceMotion = useReduceMotion();
  const { height: windowHeight } = useWindowDimensions();

  const [mounted, setMounted] = useState(visible);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardOpenRef = useRef(false);
  const keyboardHeightRef = useRef(0);

  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const scrim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  const handleClose = useCallback(() => {
    hapticFeedback.light();
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, handleClose]);

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

  useEffect(() => {
    animationRef.current?.stop();

    if (visible) {
      setMounted(true);
      if (reduceMotion) {
        progress.setValue(1);
        scrim.setValue(1);
        return;
      }
      progress.setValue(0);
      scrim.setValue(0);
      animationRef.current = Animated.parallel([
        Animated.timing(progress, {
          toValue: 1,
          duration: 460,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: true,
        }),
        Animated.timing(scrim, {
          toValue: 1,
          duration: 340,
          easing: Easing.bezier(0.2, 0.8, 0.2, 1),
          useNativeDriver: true,
        }),
      ]);
      animationRef.current.start();
      return;
    }

    if (!mounted) return;
    if (reduceMotion) {
      progress.setValue(0);
      scrim.setValue(0);
      setMounted(false);
      return;
    }
    animationRef.current = Animated.parallel([
      Animated.timing(progress, {
        toValue: 0,
        duration: 300,
        easing: Easing.bezier(0.4, 0, 1, 1),
        useNativeDriver: true,
      }),
      Animated.timing(scrim, {
        toValue: 0,
        duration: 340,
        easing: Easing.bezier(0.2, 0.8, 0.2, 1),
        useNativeDriver: true,
      }),
    ]);
    animationRef.current.start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [visible, reduceMotion, progress, scrim, mounted]);

  if (!mounted) return null;

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [windowHeight, 0],
  });

  const scrimColor = isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.4)';
  const sheetBg = colors.surface ?? colors.bg;
  const bottomPad = keyboardHeight > 0 ? keyboardHeight + 8 : insets.bottom + 20;

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: scrim }]}>
          <BlurView
            intensity={22}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
            experimentalBlurMethod="dimezisBlurView"
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: scrimColor }]} />
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleClose}
            accessibilityLabel="Fechar"
            accessibilityRole="button"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: sheetBg,
              maxHeight: windowHeight * 0.94,
              paddingBottom: bottomPad,
              transform: [{ translateY }],
            },
          ]}
        >
          {showHandle ? (
            <Pressable
              onPress={handleClose}
              style={styles.handleHit}
              accessibilityLabel="Arrastar ou fechar"
              accessibilityRole="button"
              hitSlop={8}
            >
              <View style={[styles.handleBar, { backgroundColor: colors.outlineVariant }]} />
            </Pressable>
          ) : null}

          {title || subtitle ? (
            <View style={styles.headerRow}>
              <View style={styles.titleWrap}>
                {title ? <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text> : null}
                {subtitle ? (
                  <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
                ) : null}
              </View>
              <Pressable
                onPress={handleClose}
                style={[
                  styles.closeBtn,
                  {
                    borderColor: colors.outlineVariant,
                    backgroundColor: colors.surfaceVariant,
                  },
                ]}
                accessibilityLabel="Fechar"
                accessibilityRole="button"
                hitSlop={6}
              >
                <MaterialIcons name="close" size={18} color={colors.onSurface} />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.body}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    paddingHorizontal: 20,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  handleHit: {
    minHeight: 18,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4,
    marginRight: -4,
  },
  body: {
    flexShrink: 1,
  },
});
