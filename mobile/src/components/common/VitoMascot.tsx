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
 * Componente executivo do mascote Vito (O Polvo Executivo).
 * Design comercial ultra-polido:
 * - Corpo estável e elegante (sem pulos ou giros infantis).
 * - Olhar vivo e atento com piscar orgânico (3.5s - 5.5s).
 * - Movimento ocular de raciocínio (thinking): olhos olham para o alto/laterais de forma sutil.
 * - Confirmação expressiva (success): piscadela orgânica de conclusão.
 */
export const VitoMascot: React.FC<VitoMascotProps> = ({
  size = 48,
  animated = true,
  state = 'idle',
  style,
}) => {
  // Valores animados exclusivamente faciais/oculares
  const blinkAnim = useRef(new Animated.Value(1)).current;
  const eyeMoveX = useRef(new Animated.Value(0)).current;
  const eyeMoveY = useRef(new Animated.Value(0)).current;

  // 1. Loop Orgânico de Piscar de Olhos (Blink)
  useEffect(() => {
    if (!animated) return;

    let isMounted = true;
    let blinkTimer: ReturnType<typeof setTimeout> | null = null;

    const triggerBlink = () => {
      if (!isMounted) return;

      Animated.sequence([
        Animated.timing(blinkAnim, {
          toValue: 0.08,
          duration: 85,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 110,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (!isMounted) return;
        // Intervalo aleatório natural entre 3.2s e 5.8s
        const nextDelay = 3200 + Math.random() * 2600;
        blinkTimer = setTimeout(triggerBlink, nextDelay);
      });
    };

    blinkTimer = setTimeout(triggerBlink, 1800);

    return () => {
      isMounted = false;
      if (blinkTimer) clearTimeout(blinkTimer);
    };
  }, [animated, blinkAnim]);

  // 2. Movimentação Ocular Dinâmica (Idle / Thinking / Success)
  useEffect(() => {
    if (!animated) return;

    if (state === 'thinking') {
      // Pensando: olhos se movem com curiosidade e foco (olhando para cima e lados)
      const thinkingLoop = Animated.loop(
        Animated.sequence([
          // Olha sutilmente para cima e à direita (buscando dados/pensando)
          Animated.parallel([
            Animated.timing(eyeMoveX, {
              toValue: 1.8,
              duration: 450,
              easing: Easing.inOut(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(eyeMoveY, {
              toValue: -1.6,
              duration: 450,
              easing: Easing.inOut(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
          Animated.delay(650),
          // Desliza para o lado esquerdo
          Animated.parallel([
            Animated.timing(eyeMoveX, {
              toValue: -1.8,
              duration: 550,
              easing: Easing.inOut(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(eyeMoveY, {
              toValue: -1.0,
              duration: 550,
              easing: Easing.inOut(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
          Animated.delay(650),
          // Retorna suavemente ao centro
          Animated.parallel([
            Animated.timing(eyeMoveX, {
              toValue: 0,
              duration: 400,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(eyeMoveY, {
              toValue: 0,
              duration: 400,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          Animated.delay(400),
        ])
      );

      thinkingLoop.start();
      return () => thinkingLoop.stop();
    } else if (state === 'success') {
      // Sucesso: breve piscadela com retorno imediato e estável ao centro
      Animated.parallel([
        Animated.timing(eyeMoveX, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(eyeMoveY, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(blinkAnim, {
            toValue: 0.08,
            duration: 90,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(blinkAnim, {
            toValue: 1,
            duration: 120,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    } else {
      // Idle: Olhos centralizados com micro-olhadas ocasionais e imperceptíveis
      let isMounted = true;
      let idleTimer: ReturnType<typeof setTimeout> | null = null;

      const triggerIdleGaze = () => {
        if (!isMounted) return;

        // Deslocamento sutil de 1px a 1.5px
        const direction = Math.random() > 0.5 ? 1.2 : -1.2;
        Animated.sequence([
          Animated.timing(eyeMoveX, {
            toValue: direction,
            duration: 350,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(1200),
          Animated.timing(eyeMoveX, {
            toValue: 0,
            duration: 350,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (!isMounted) return;
          const nextGaze = 6000 + Math.random() * 4000;
          idleTimer = setTimeout(triggerIdleGaze, nextGaze);
        });
      };

      idleTimer = setTimeout(triggerIdleGaze, 4500);

      return () => {
        isMounted = false;
        if (idleTimer) clearTimeout(idleTimer);
      };
    }
  }, [animated, state, eyeMoveX, eyeMoveY, blinkAnim]);

  // Proporções geométricas exatas dos olhos (calibradas a partir do canvas 512x512)
  const eyeWidth = Math.max(2, size * 0.055);
  const eyeHeight = Math.max(3, size * 0.137);
  const eyeBorderRadius = eyeWidth / 2;

  const eyeTop = size * 0.354;
  const leftEyeLeft = size * 0.392;
  const rightEyeLeft = size * 0.553;

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {/* Imagem de alta fidelidade do mascote Vito — Corpo estático e nítido */}
      <Image
        source={MASCOT_IMAGE}
        style={{
          width: size,
          height: size,
        }}
        resizeMode="contain"
      />

      {/* Camada Ocular Ativa — Olhos Vivos com Piscar e Movimentação */}
      {animated && (
        <>
          {/* Olho Esquerdo */}
          <AnimatedView
            pointerEvents="none"
            style={[
              styles.eyePill,
              {
                width: eyeWidth,
                height: eyeHeight,
                borderRadius: eyeBorderRadius,
                top: eyeTop,
                left: leftEyeLeft,
                transform: [
                  { translateX: eyeMoveX },
                  { translateY: eyeMoveY },
                  { scaleY: blinkAnim },
                ],
              },
            ]}
          />

          {/* Olho Direito */}
          <AnimatedView
            pointerEvents="none"
            style={[
              styles.eyePill,
              {
                width: eyeWidth,
                height: eyeHeight,
                borderRadius: eyeBorderRadius,
                top: eyeTop,
                left: rightEyeLeft,
                transform: [
                  { translateX: eyeMoveX },
                  { translateY: eyeMoveY },
                  { scaleY: blinkAnim },
                ],
              },
            ]}
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  eyePill: {
    position: 'absolute',
    backgroundColor: '#0A0A0C', // Preto profundo idêntico às pupilas do mascote
  },
});

