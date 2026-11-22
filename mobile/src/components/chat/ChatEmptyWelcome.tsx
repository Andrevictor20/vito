import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { MOTION_CURVES, hapticFeedback } from '../../theme/motion';
import { useReduceMotion } from '../../theme/vitoMotion';
import { VitoMascot } from '../common/VitoMascot';
import { ChatIdeasDeck } from './ChatIdeasDeck';

const HERO_CYCLE_STATES = ['gentleman', 'happy', 'curious', 'dance', 'idle'] as const;
type HeroMascotState = (typeof HERO_CYCLE_STATES)[number];

export interface ChatEmptyWelcomeProps {
  welcomeGreeting?: string;
  userName?: string;
  loading?: boolean;
  onSelectIdea?: (prompt: string) => void;
}

export const ChatEmptyWelcome: React.FC<ChatEmptyWelcomeProps> = ({
  welcomeGreeting,
  loading = false,
  onSelectIdea,
}) => {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [heroIndex, setHeroIndex] = useState(0);
  const heroAnim = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const deckAnim = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      heroAnim.setValue(1);
      deckAnim.setValue(1);
      return;
    }
    heroAnim.setValue(0);
    deckAnim.setValue(0);
    Animated.stagger(70, [
      Animated.timing(heroAnim, {
        toValue: 1,
        duration: 620,
        easing: Easing.bezier(...MOTION_CURVES.q),
        useNativeDriver: true,
      }),
      Animated.timing(deckAnim, {
        toValue: 1,
        duration: 620,
        easing: Easing.bezier(...MOTION_CURVES.q),
        useNativeDriver: true,
      }),
    ]).start();
  }, [reduceMotion, heroAnim, deckAnim]);

  const currentHeroState: HeroMascotState = HERO_CYCLE_STATES[heroIndex];
  const mascotStateProp = loading ? 'thinking' : currentHeroState;

  const handleCycleHero = () => {
    hapticFeedback.light();
    setHeroIndex((prev) => (prev + 1) % HERO_CYCLE_STATES.length);
  };

  const titleText = welcomeGreeting || 'Como posso ajudar hoje?';

  return (
    <View style={styles.cheroContainer}>
      <Animated.View
        style={[
          styles.heroBlock,
          {
            opacity: heroAnim,
            transform: [
              {
                translateY: heroAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 0],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.mascotWrapper}
          onPress={handleCycleHero}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Interagir com o mascote Vito"
          testID="chero-rig"
        >
          {React.createElement(
            VitoMascot as unknown as React.ComponentType<Record<string, unknown>>,
            {
              size: 76,
              animated: true,
              state: mascotStateProp,
              interactiveParts: false,
            }
          )}
        </TouchableOpacity>

        <Text style={[styles.heroTitle, { color: colors.ink }]}>
          {titleText}
        </Text>
      </Animated.View>

      {onSelectIdea && (
        <Animated.View
          style={[
            styles.deckWrap,
            {
              opacity: deckAnim,
              transform: [
                {
                  translateY: deckAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <ChatIdeasDeck onUseIdea={onSelectIdea} disabled={loading} />
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cheroContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 4,
    width: '100%',
  },
  heroBlock: {
    alignItems: 'center',
    width: '100%',
  },
  mascotWrapper: {
    marginBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontFamily: 'Geist',
    fontSize: 23,
    fontWeight: '500',
    letterSpacing: -0.58,
    textAlign: 'center',
    marginHorizontal: 12,
    marginTop: 6,
    lineHeight: 28,
  },
  deckWrap: {
    width: '100%',
    alignItems: 'center',
  },
});
