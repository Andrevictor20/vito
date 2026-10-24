import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  PanResponder,
  PanResponderGestureState,
  Animated,
  Easing,
  AccessibilityInfo,
} from 'react-native';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';
import {
  CalIcon,
  MailIcon,
  RadarIcon,
  CheckCircleIcon,
  WhatsAppGlyph,
} from '../login/DemoIcons';
import {
  IDEA_CARDS,
  CAROUSEL_TIMING,
  getCardOffset,
  getCardVisualSpec,
  type IdeaCard,
} from '../../utils/chatIdeasDeckMotion';

export { IDEA_CARDS, CAROUSEL_TIMING, getCardOffset, getCardVisualSpec, type IdeaCard };

interface ChatIdeasDeckProps {
  onUseIdea: (prompt: string) => void;
  disabled?: boolean;
}

export const ChatIdeasDeck: React.FC<ChatIdeasDeckProps> = ({ onUseIdea, disabled }) => {
  const { colors, isDark } = useTheme();
  const [cur, setCur] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const n = IDEA_CARDS.length;

  const animValue = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);
  const isDragging = useRef(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (isMounted.current) setReduceMotion(enabled);
      })
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener
      ? AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled: boolean) => {
          if (isMounted.current) setReduceMotion(enabled);
        })
      : null;

    return () => {
      isMounted.current = false;
      animValue.stopAnimation();
      sub?.remove?.();
    };
  }, [animValue]);

  const finishSwipe = (target: -1 | 1) => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    hapticFeedback.selection();

    if (reduceMotion) {
      setCur((prev) => (target === -1 ? (prev + 1) % n : (prev - 1 + n) % n));
      animValue.setValue(0);
      isAnimating.current = false;
      return;
    }

    Animated.spring(animValue, {
      toValue: target,
      damping: CAROUSEL_TIMING.spring.damping,
      stiffness: CAROUSEL_TIMING.spring.stiffness,
      mass: CAROUSEL_TIMING.spring.mass,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && isMounted.current) {
        setCur((prev) => (target === -1 ? (prev + 1) % n : (prev - 1 + n) % n));
        animValue.setValue(0);
      }
      isAnimating.current = false;
    });
  };

  const navigate = (dir: -1 | 1) => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    hapticFeedback.selection();

    if (reduceMotion) {
      setCur((prev) => (dir === -1 ? (prev + 1) % n : (prev - 1 + n) % n));
      animValue.setValue(0);
      isAnimating.current = false;
      return;
    }

    animValue.setValue(0);
    Animated.timing(animValue, {
      toValue: dir,
      duration: CAROUSEL_TIMING.durationMs,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && isMounted.current) {
        setCur((prev) => (dir === -1 ? (prev + 1) % n : (prev - 1 + n) % n));
        animValue.setValue(0);
      }
      isAnimating.current = false;
    });
  };

  const goNext = () => navigate(-1);
  const goPrev = () => navigate(1);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState: PanResponderGestureState) => {
        if (isAnimating.current) return false;
        return (
          Math.abs(gestureState.dx) > 10 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
        );
      },
      onPanResponderGrant: () => {
        isDragging.current = true;
      },
      onPanResponderMove: (_, gestureState: PanResponderGestureState) => {
        if (isAnimating.current) return;
        const progress = Math.max(
          -1.15,
          Math.min(1.15, gestureState.dx / CAROUSEL_TIMING.dragScalePx)
        );
        animValue.setValue(progress);
      },
      onPanResponderRelease: (_, gestureState: PanResponderGestureState) => {
        isDragging.current = false;
        if (isAnimating.current) return;

        const dx = gestureState.dx;
        const vx = gestureState.vx;
        const isSwipeNext =
          dx < -CAROUSEL_TIMING.swipeThresholdPx || (dx < -15 && vx < -0.5);
        const isSwipePrev =
          dx > CAROUSEL_TIMING.swipeThresholdPx || (dx > 15 && vx > 0.5);

        if (isSwipeNext) {
          finishSwipe(-1);
        } else if (isSwipePrev) {
          finishSwipe(1);
        } else {
          Animated.spring(animValue, {
            toValue: 0,
            damping: 20,
            stiffness: 260,
            mass: 0.8,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        isDragging.current = false;
        Animated.spring(animValue, {
          toValue: 0,
          damping: 20,
          stiffness: 260,
          mass: 0.8,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  const getChipAndTag = (layout: IdeaCard['layout']) => {
    switch (layout) {
      case 'agenda':
        return { chipBg: colors.blueBg, icon: <CalIcon color={colors.blue} />, tagBg: colors.blueBg, tagText: colors.blue };
      case 'gmail':
        return { chipBg: colors.redBg, icon: <MailIcon color={colors.red} size={20} />, tagBg: colors.redBg, tagText: colors.red };
      case 'whatsapp':
        return { chipBg: colors.greenBg, icon: <WhatsAppGlyph color={colors.acc} size={22} />, tagBg: colors.greenBg, tagText: colors.acc };
      case 'radar':
        return { chipBg: colors.orangeBg, icon: <RadarIcon color={colors.orange} />, tagBg: colors.orangeBg, tagText: colors.orange };
      case 'task':
      default:
        return { chipBg: colors.purpleBg, icon: <CheckCircleIcon color={colors.purple} />, tagBg: colors.purpleBg, tagText: colors.purple };
    }
  };

  const renderedItems = IDEA_CARDS.map((card, i) => {
    const d = getCardOffset(i, cur, n);
    return { card, i, d };
  })
    .filter((item) => Math.abs(item.d) <= 2)
    .sort((a, b) => {
      const zA = a.d === 0 ? 3 : Math.abs(a.d) === 1 ? 2 : 1;
      const zB = b.d === 0 ? 3 : Math.abs(b.d) === 1 ? 2 : 1;
      return zA - zB;
    });

  return (
    <View style={styles.container}>
      {/* Deck 3D Carousel */}
      <View style={styles.deckViewport} {...panResponder.panHandlers}>
        {renderedItems.map(({ card, i, d }) => {
          const isCurrent = d === 0;
          const isNext = d === 1;
          const isPrev = d === -1;

          const atMinus1 = getCardVisualSpec(d - 1);
          const atZero = getCardVisualSpec(d);
          const atPlus1 = getCardVisualSpec(d + 1);

          const translateX = animValue.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [atMinus1.tx, atZero.tx, atPlus1.tx],
            extrapolate: 'clamp',
          });

          const rotate = animValue.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [atMinus1.rot, atZero.rot, atPlus1.rot],
            extrapolate: 'clamp',
          });

          const scale = animValue.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [atMinus1.scale, atZero.scale, atPlus1.scale],
            extrapolate: 'clamp',
          });

          const opacity = animValue.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [atMinus1.op, atZero.op, atPlus1.op],
            extrapolate: 'clamp',
          });

          const zIndex = isCurrent ? 3 : isNext || isPrev ? 2 : 1;
          const visual = getChipAndTag(card.layout);

          return (
            <Animated.View
              key={card.id}
              style={[
                styles.zc,
                {
                  backgroundColor: colors.bg,
                  borderColor: colors.line,
                  borderWidth: 1,
                  zIndex,
                  opacity,
                  transform: [{ translateX }, { rotate }, { scale }],
                },
                isCurrent &&
                  (isDark ? styles.zcCurrentShadowDark : styles.zcCurrentShadow),
              ]}
              pointerEvents={Math.abs(d) <= 1 ? 'auto' : 'none'}
            >
              {/* Top Row: Chip Arredondado 38x38px com Ícone Vetorial + Tag Pílula (SEM emoji, SEM compartilhar) */}
              <View style={styles.zcTop}>
                <View style={[styles.chip, { backgroundColor: visual.chipBg }]}>
                  {visual.icon}
                </View>
                <View style={[styles.tag, { backgroundColor: visual.tagBg }]}>
                  <Text style={[styles.tagText, { color: visual.tagText }]}>
                    {card.tag}
                  </Text>
                </View>
              </View>

              {/* Middle: Título e Descrição no estilo dos Action Cards */}
              <View style={styles.zcMiddle}>
                <Text
                  style={[styles.zcTitle, { color: colors.ink }]}
                  numberOfLines={2}
                >
                  {card.title}
                </Text>
                <Text
                  style={[styles.zcSubtitle, { color: colors.muted }]}
                  numberOfLines={2}
                >
                  {card.subtitle}
                </Text>
              </View>

              {/* Bottom: Botão Pílula Usar */}
              <View style={styles.zcBottom}>
                <TouchableOpacity
                  style={[styles.useButton, { backgroundColor: colors.ink }]}
                  onPress={() => {
                    hapticFeedback.medium();
                    onUseIdea(card.prompt);
                  }}
                  disabled={disabled}
                  activeOpacity={0.8}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.useButtonText, { color: colors.bg }]}>
                    Usar
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Tap target para navegar quando tocar nos cards laterais */}
              {isNext && (
                <TouchableOpacity
                  style={StyleSheet.absoluteFill}
                  onPress={goNext}
                  activeOpacity={0.8}
                  accessibilityLabel={`Ir para ideia ${card.title}`}
                  accessibilityRole="button"
                />
              )}
              {isPrev && (
                <TouchableOpacity
                  style={StyleSheet.absoluteFill}
                  onPress={goPrev}
                  activeOpacity={0.8}
                  accessibilityLabel={`Voltar para ideia ${card.title}`}
                  accessibilityRole="button"
                />
              )}
            </Animated.View>
          );
        })}
      </View>

      {/* Botão Pílula "Ver mais ideias" (.moreb) */}
      <TouchableOpacity
        style={[
          styles.moreButton,
          { backgroundColor: colors.surf, borderColor: colors.line },
        ]}
        onPress={goNext}
        activeOpacity={0.7}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Text style={[styles.moreButtonText, { color: colors.ink }]}>
          Ver mais ideias
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 10,
    width: '100%',
  },
  deckViewport: {
    width: 280,
    height: 242,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  zc: {
    position: 'absolute',
    width: 232,
    height: 232,
    borderRadius: 24,
    padding: 16,
    justifyContent: 'space-between',
  },
  zcCurrentShadow: {
    shadowColor: '#141916',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 6,
  },
  zcCurrentShadowDark: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 6,
  },
  zcTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chip: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  tagText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11.5,
    fontWeight: '600',
  },
  zcMiddle: {
    marginTop: 6,
    marginBottom: 4,
  },
  zcTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  zcSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 4,
  },
  zcBottom: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  useButton: {
    height: 34,
    paddingHorizontal: 20,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  useButtonText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  moreButton: {
    marginTop: 8,
    height: 40,
    paddingHorizontal: 22,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreButtonText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
});
