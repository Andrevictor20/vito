import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  AccessibilityInfo,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { CHAT_CARD_ANIMATION, shouldReduceMotion } from '../../../utils/chatCardAnimation';

export interface SmoothCardEntranceProps {
  children: React.ReactNode;
  /**
   * Delay em ms antes do início da animação de entrada (padrão: 180ms).
   * Alinhado à paridade visual com login-vito.html (`animation: rise .45s .25s ease both`).
   */
  delay?: number;
  /**
   * Duração em ms da animação de entrada (padrão: 400ms).
   */
  duration?: number;
  /**
   * Deslocamento inicial no eixo Y em dp (padrão: 10dp).
   */
  offsetY?: number;
  /**
   * Estilo customizado para o container animado.
   */
  style?: StyleProp<ViewStyle>;
}

export const SmoothCardEntrance: React.FC<SmoothCardEntranceProps> = ({
  children,
  delay = CHAT_CARD_ANIMATION.delay,
  duration = CHAT_CARD_ANIMATION.duration,
  offsetY = CHAT_CARD_ANIMATION.offsetY,
  style,
}) => {
  const animOpacity = useRef(new Animated.Value(0)).current;
  const animTranslateY = useRef(new Animated.Value(offsetY)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let animComposite: Animated.CompositeAnimation | null = null;

    const startAnimation = () => {
      timer = setTimeout(() => {
        if (!isMounted) return;
        const [x1, y1, x2, y2] = CHAT_CARD_ANIMATION.bezier;
        const easeCurve = Easing.bezier(x1, y1, x2, y2);
        animComposite = Animated.parallel([
          Animated.timing(animOpacity, {
            toValue: 1,
            duration,
            easing: easeCurve,
            useNativeDriver: true,
          }),
          Animated.timing(animTranslateY, {
            toValue: 0,
            duration,
            easing: easeCurve,
            useNativeDriver: true,
          }),
        ]);
        animComposite.start();
      }, delay);
    };

    if (AccessibilityInfo?.isReduceMotionEnabled) {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((enabled) => {
          if (!isMounted) return;
          if (shouldReduceMotion(enabled)) {
            setReduceMotion(true);
            animOpacity.setValue(1);
            animTranslateY.setValue(0);
            return;
          }
          startAnimation();
        })
        .catch(() => {
          if (!isMounted) return;
          startAnimation();
        });
    } else {
      startAnimation();
    }

    const sub = AccessibilityInfo?.addEventListener
      ? AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled: boolean) => {
          if (shouldReduceMotion(enabled)) {
            setReduceMotion(true);
            if (timer) clearTimeout(timer);
            if (animComposite) animComposite.stop();
            animOpacity.setValue(1);
            animTranslateY.setValue(0);
          }
        })
      : null;

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
      if (animComposite) animComposite.stop();
      sub?.remove?.();
    };
  }, [animOpacity, animTranslateY, delay, duration, offsetY]);

  if (reduceMotion) {
    return <Animated.View style={[styles.container, style]}>{children}</Animated.View>;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        {
          opacity: animOpacity,
          transform: [{ translateY: animTranslateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});
