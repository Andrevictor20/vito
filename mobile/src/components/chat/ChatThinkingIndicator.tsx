import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Animated, Easing } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';

/**
 * Micro-ícone de inteligência orgânica (Sparkle) com pulso calmo e contínuo.
 */
function SparkleIcon({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"
        fill={color}
        stroke={color}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Indicador de pensamento do Vito no Chat (estilo editorial Claude / Gemini).
 * - Sem loops frenéticos de frases mockadas.
 * - Estado sóbrio e contínuo com "Pensando..." discreto.
 * - Onda suave e fluida de 3 pontos com interpolação de escala e translação vertical a 60fps.
 */
export const ChatThinkingIndicator: React.FC = () => {
  const { colors } = useTheme();

  // Animação de respiração orgânica da fagulha (pulso suave)
  const pulseAnim = useRef(new Animated.Value(0.7)).current;

  // Animações dos 3 pontos ondulantes (staggered wave)
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Pulso suave e contínuo da fagulha
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    // 2. Onda contínua e calma dos 3 pontos (60fps)
    const createDotAnimation = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 420,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.delay(Math.max(0, 420 - delay)),
        ])
      );

    const wave1 = createDotAnimation(dot1, 0);
    const wave2 = createDotAnimation(dot2, 160);
    const wave3 = createDotAnimation(dot3, 320);

    wave1.start();
    wave2.start();
    wave3.start();

    return () => {
      pulseLoop.stop();
      wave1.stop();
      wave2.stop();
      wave3.stop();
    };
  }, [pulseAnim, dot1, dot2, dot3]);

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Vito está pensando"
    >
      {/* Ícone de fagulha com respiração orgânica */}
      <Animated.View
        style={[
          styles.sparkleWrapper,
          {
            transform: [{ scale: pulseAnim }],
            opacity: pulseAnim,
          },
        ]}
      >
        <SparkleIcon color={colors.primary || colors.ink} size={14} />
      </Animated.View>

      {/* Três pontos ondulantes (fluid wave dots) */}
      <View style={styles.dotsRow}>
        {[dot1, dot2, dot3].map((anim, idx) => {
          const translateY = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -4],
          });
          const opacity = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.35, 1],
          });
          const scale = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.85, 1.15],
          });

          return (
            <Animated.View
              key={idx}
              style={[
                styles.dot,
                {
                  backgroundColor: colors.primary || colors.ink,
                  opacity,
                  transform: [{ translateY }, { scale }],
                },
              ]}
            />
          );
        })}
      </View>

      {/* Texto sóbrio e calmo constante */}
      <Text
        style={[
          styles.phraseText,
          { color: colors.onSurfaceVariant || colors.muted },
        ]}
      >
        Pensando...
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
    paddingVertical: 10,
    paddingHorizontal: 2,
    marginTop: 4,
    marginBottom: 8,
  },
  sparkleWrapper: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 12,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  phraseText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13.5,
    fontWeight: '500',
    letterSpacing: 0.15,
  },
});
