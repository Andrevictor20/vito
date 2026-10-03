import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, StyleProp, ViewStyle, Image } from 'react-native';

const AnimatedView = Animated.createAnimatedComponent(View);
const MASCOT_IMAGE = require('../../../assets/mascot.png');

export interface VitoMascotProps {
  size?: number;
  animated?: boolean;
  state?: 'idle' | 'thinking' | 'success';
  style?: StyleProp<ViewStyle>;
}

/**
 * Componente vetorial nativo do mascote executivo do Vito (O Polvo Executivo).
 * Suporta animações nativas a 60-120fps via React Native Animated:
 * - idle: Piscar orgânico de olhos a cada 4s + respiração sutil
 * - thinking: Ondulação rítmica enquanto a IA processa
 * - success: Pequeno salto elástico (bounce) da cartola e mascote
 */
export const VitoMascot: React.FC<VitoMascotProps> = ({
  size = 48,
  animated = true,
  state = 'idle',
  style,
}) => {
  // Valores animados
  const floatAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(1)).current;

  // 2. Loop de Pensamento (Thinking) / Respiração Sutil (Idle)
  useEffect(() => {
    if (!animated) return;

    if (state === 'thinking') {
      const thinkingLoop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(floatAnim, {
              toValue: -3,
              duration: 600,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(rotateAnim, {
              toValue: 1,
              duration: 600,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(floatAnim, {
              toValue: 3,
              duration: 600,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(rotateAnim, {
              toValue: -1,
              duration: 600,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      thinkingLoop.start();
      return () => thinkingLoop.stop();
    } else if (state === 'success') {
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: 1.15,
          duration: 200,
          easing: Easing.out(Easing.back(2)),
          useNativeDriver: true,
        }),
        Animated.spring(bounceAnim, {
          toValue: 1,
          friction: 4,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Idle: flutuação quase imperceptível (1px)
      const idleLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: -1.5,
            duration: 1800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 1800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      idleLoop.start();
      return () => idleLoop.stop();
    }
  }, [animated, state, floatAnim, rotateAnim, bounceAnim]);

  const rotation = rotateAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-3deg', '3deg'],
  });

  return (
    <AnimatedView
      style={[
        styles.container,
        {
          width: size,
          height: size,
          transform: [
            { translateY: floatAnim },
            { rotate: rotation },
            { scale: bounceAnim },
          ],
        },
        style,
      ]}
    >
      <Image
        source={MASCOT_IMAGE}
        style={{
          width: size,
          height: size,
        }}
        resizeMode="contain"
      />
    </AnimatedView>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
