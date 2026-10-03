import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, StyleProp, ViewStyle } from 'react-native';
import Svg, { G, Path, Circle, Ellipse } from 'react-native-svg';

const AnimatedView = Animated.createAnimatedComponent(View);

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
  const blinkAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(1)).current;

  // 1. Loop de Piscar de Olhos (Blink)
  useEffect(() => {
    if (!animated) return;

    let isMounted = true;
    const triggerBlink = () => {
      if (!isMounted) return;
      Animated.sequence([
        Animated.timing(blinkAnim, {
          toValue: 0.1,
          duration: 90,
          useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }),
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 110,
          useNativeDriver: true,
          easing: Easing.in(Easing.quad),
        }),
      ]).start(() => {
        if (!isMounted) return;
        // Intervalo aleatório de 3.5 a 5 segundos para naturalidade
        const delay = 3500 + Math.random() * 1500;
        setTimeout(triggerBlink, delay);
      });
    };

    const initialTimeout = setTimeout(triggerBlink, 2000);
    return () => {
      isMounted = false;
      clearTimeout(initialTimeout);
    };
  }, [animated, blinkAnim]);

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
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* CORPO & CABEÇA (BRANCO PURO COM STROKE PRETO GROSSO) */}
        <G>
          {/* Cabeça redonda com base anatômica */}
          <Path
            d="M 50 16 
               C 34 16, 22 28, 22 45 
               C 22 55, 27 63, 33 67 
               C 32 72, 27 75, 22 75 
               C 17 75, 14 71, 15 67 
               C 16 63, 20 62, 23 64 
               C 21 68, 17 70, 20 73 
               C 24 77, 31 75, 33 71
               C 35 75, 39 77, 44 77
               C 47 77, 49 74, 49 70
               C 49 66, 44 65, 41 68
               C 43 71, 46 72, 45 74
               C 43 75, 38 73, 37 68
               C 41 67, 46 66, 50 66
               C 54 66, 59 67, 63 68
               C 62 73, 57 75, 55 74
               C 54 72, 57 71, 59 68
               C 56 65, 51 66, 51 70
               C 51 74, 53 77, 56 77
               C 61 77, 65 75, 67 71
               C 69 75, 76 77, 80 73
               C 83 70, 79 68, 77 64
               C 80 62, 84 63, 85 67
               C 86 71, 83 75, 78 75
               C 73 75, 68 72, 67 67
               C 73 63, 78 55, 78 45
               C 78 28, 66 16, 50 16 Z"
            fill="#FFFFFF"
            stroke="#111111"
            strokeWidth="5.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Curvaturas internas dos tentáculos em espiral */}
          <Path
            d="M 23 68 C 21 72, 26 74, 29 72 C 31 70, 31 67, 28 66"
            fill="none"
            stroke="#111111"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <Path
            d="M 77 68 C 79 72, 74 74, 71 72 C 69 70, 69 67, 72 66"
            fill="none"
            stroke="#111111"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <Path
            d="M 40 70 C 39 74, 44 75, 46 73 C 48 71, 47 68, 44 68"
            fill="none"
            stroke="#111111"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <Path
            d="M 60 70 C 61 74, 56 75, 54 73 C 52 71, 53 68, 56 68"
            fill="none"
            stroke="#111111"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </G>



        {/* GRAVATA BORBOLETA EXECUTIVA */}
        <G>
          {/* Laço Esquerdo */}
          <Path
            d="M 43 56 L 49 59 L 43 62 Z"
            fill="#111111"
            stroke="#111111"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Laço Direito */}
          <Path
            d="M 57 56 L 51 59 L 57 62 Z"
            fill="#111111"
            stroke="#111111"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Nó Central */}
          <Circle cx="50" cy="59" r="2.5" fill="#111111" />
        </G>

        {/* MINI CARTOLA INCLINADA */}
        <G transform="rotate(18, 62, 19)">
          {/* Aba da cartola */}
          <Ellipse
            cx="62"
            cy="21"
            rx="13"
            ry="3.5"
            fill="#111111"
            stroke="#111111"
            strokeWidth="1"
          />
          {/* Copa da cartola */}
          <Path
            d="M 54 20 L 55 9 C 55 7, 57 6, 60 6 L 65 6 C 68 6, 70 7, 70 9 L 71 20 Z"
            fill="#111111"
            stroke="#111111"
            strokeWidth="1"
            strokeLinejoin="round"
          />
          {/* Fita elegante na cartola */}
          <Path
            d="M 54.5 17.5 L 70.5 17.5"
            stroke="#FFFFFF"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </G>
      </Svg>

      {/* OLHOS EM CÁPSULA VERTICAL COM PISCAR NATIVO ANIMADO */}
      <AnimatedView
        style={[
          styles.eyesRow,
          {
            top: size * 0.39,
            height: Math.max(3, size * 0.13),
            gap: Math.max(2, size * 0.06),
            transform: [{ scaleY: blinkAnim }],
          },
        ]}
      >
        <View
          style={[
            styles.eyePill,
            {
              width: Math.max(2, size * 0.06),
              height: Math.max(3, size * 0.13),
              borderRadius: Math.max(1, size * 0.03),
            },
          ]}
        />
        <View
          style={[
            styles.eyePill,
            {
              width: Math.max(2, size * 0.06),
              height: Math.max(3, size * 0.13),
              borderRadius: Math.max(1, size * 0.03),
            },
          ]}
        />
      </AnimatedView>
    </AnimatedView>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  eyesRow: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  eyePill: {
    backgroundColor: '#111111',
  },
});
