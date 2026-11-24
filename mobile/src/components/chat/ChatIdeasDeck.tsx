import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  GestureResponderEvent,
  PanResponder,
  PanResponderGestureState,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { getBezier } from '../../ds/tokens';
import { pagerSwipeLockBus } from '../../services/dataSync';
import { MOTION_CURVES, hapticFeedback } from '../../theme/motion';
import { v5Radii } from '../../theme/tokens';
import { useReduceMotion } from '../../theme/vitoMotion';
import {
  CAROUSEL_TIMING,
  IDEA_CARDS,
  getCardOffset,
  type IdeaCard,
} from '../../utils/chatIdeasDeckMotion';
import {
  CalIcon,
  CheckCircleIcon,
  MailIcon,
  RadarIcon,
  WhatsAppGlyph,
} from '../login/DemoIcons';

export { IDEA_CARDS, CAROUSEL_TIMING, getCardOffset, type IdeaCard };

interface ChatIdeasDeckProps {
  onUseIdea: (prompt: string) => void;
  disabled?: boolean;
  cards?: IdeaCard[];
}

function getSymmetricSpec(distance: number) {
  if (distance === 0) return { tx: 0, scale: 1, op: 1 };
  if (distance === 1) return { tx: 38, scale: 0.9, op: 1 };
  if (distance === -1) return { tx: -38, scale: 0.9, op: 1 };
  if (distance >= 2) return { tx: 60, scale: 0.82, op: 0 };
  return { tx: -60, scale: 0.82, op: 0 };
}

const SPEC_M2 = getSymmetricSpec(-2);
const SPEC_M1 = getSymmetricSpec(-1);
const SPEC_0 = getSymmetricSpec(0);
const SPEC_P1 = getSymmetricSpec(1);
const SPEC_P2 = getSymmetricSpec(2);

/**
 * Deck estático e simétrico (.zc) v5 — sem rotação automática (WCAG 2.2.2) e sem faixa .sg.
 */
export const ChatIdeasDeck: React.FC<ChatIdeasDeckProps> = ({
  onUseIdea,
  disabled,
  cards = IDEA_CARDS,
}) => {
  const { colors, isDark } = useTheme();
  const reduceMotion = useReduceMotion();
  const n = cards.length;

  const [cur, setCur] = useState(0);
  const curRef = useRef(0);
  const reduceMotionRef = useRef(reduceMotion);
  const viewportWidthRef = useRef(340);
  const heroDeckAnim = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const heroDotsAnim = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    reduceMotionRef.current = reduceMotion;
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion) {
      heroDeckAnim.setValue(1);
      heroDotsAnim.setValue(1);
      return;
    }
    heroDeckAnim.setValue(0);
    heroDotsAnim.setValue(0);
    const easeQ = Easing.bezier(...getBezier('--ease-q'));
    const anim = Animated.parallel([
      Animated.sequence([
        Animated.delay(70),
        Animated.timing(heroDeckAnim, {
          toValue: 1,
          duration: 620,
          easing: easeQ,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(150),
        Animated.timing(heroDotsAnim, {
          toValue: 1,
          duration: 500,
          easing: easeQ,
          useNativeDriver: true,
        }),
      ]),
    ]);
    anim.start();
    return () => anim.stop();
  }, [reduceMotion, heroDeckAnim, heroDotsAnim]);

  const cardAnims = useRef<Animated.Value[]>(
    IDEA_CARDS.map((_, i) => new Animated.Value(getCardOffset(i, 0, n)))
  ).current;

  const cardInterpolations = useRef(
    cardAnims.map((anim) => ({
      translateX: anim.interpolate({
        inputRange: [-2, -1, 0, 1, 2],
        outputRange: [SPEC_M2.tx, SPEC_M1.tx, SPEC_0.tx, SPEC_P1.tx, SPEC_P2.tx],
        extrapolate: 'clamp',
      }),
      scale: anim.interpolate({
        inputRange: [-2, -1, 0, 1, 2],
        outputRange: [SPEC_M2.scale, SPEC_M1.scale, SPEC_0.scale, SPEC_P1.scale, SPEC_P2.scale],
        extrapolate: 'clamp',
      }),
      opacity: anim.interpolate({
        inputRange: [-2, -1.35, -1, 0, 1, 1.35, 2],
        outputRange: [SPEC_M2.op, 0, SPEC_M1.op, SPEC_0.op, SPEC_P1.op, 0, SPEC_P2.op],
        extrapolate: 'clamp',
      }),
    }))
  ).current;

  useEffect(() => {
    return () => {
      pagerSwipeLockBus.notify(false);
      cardAnims.forEach((a) => a.stopAnimation());
    };
  }, [cardAnims]);

  const animateToIndex = useCallback(
    (nextCur: number) => {
      const prevCur = curRef.current;
      curRef.current = nextCur;
      setCur(nextCur);
      hapticFeedback.selection();

      if (reduceMotionRef.current) {
        cardAnims.forEach((anim, i) => {
          anim.stopAnimation();
          anim.setValue(getCardOffset(i, nextCur, n));
        });
        return;
      }

      const animations: Animated.CompositeAnimation[] = [];
      cardAnims.forEach((anim, i) => {
        const oldD = getCardOffset(i, prevCur, n);
        const newD = getCardOffset(i, nextCur, n);
        anim.stopAnimation();
        if (Math.abs(newD - oldD) > 2) {
          anim.setValue(newD);
          return;
        }
        animations.push(
          Animated.timing(anim, {
            toValue: newD,
            duration: 560,
            easing: Easing.bezier(...MOTION_CURVES.q),
            useNativeDriver: true,
          })
        );
      });
      Animated.parallel(animations).start();
    },
    [cardAnims, n]
  );

  const snapBackToCurrent = useCallback(() => {
    const activeCur = curRef.current;
    const animations = cardAnims.map((anim, i) => {
      anim.stopAnimation();
      return Animated.spring(anim, {
        toValue: getCardOffset(i, activeCur, n),
        damping: CAROUSEL_TIMING.spring.damping,
        stiffness: CAROUSEL_TIMING.spring.stiffness,
        mass: CAROUSEL_TIMING.spring.mass,
        useNativeDriver: true,
      });
    });
    Animated.parallel(animations).start();
  }, [cardAnims, n]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs: PanResponderGestureState) =>
        Math.abs(gs.dx) > 4 && Math.abs(gs.dx) >= Math.abs(gs.dy) * 0.7,
      onMoveShouldSetPanResponderCapture: (_, gs: PanResponderGestureState) =>
        Math.abs(gs.dx) > 6 && Math.abs(gs.dx) >= Math.abs(gs.dy) * 0.7,
      onPanResponderGrant: () => {
        pagerSwipeLockBus.notify(true);
        cardAnims.forEach((a) => a.stopAnimation());
      },
      onPanResponderMove: (_, gs: PanResponderGestureState) => {
        const dragDelta = Math.max(-1.15, Math.min(1.15, gs.dx / CAROUSEL_TIMING.dragScalePx));
        const activeCur = curRef.current;
        cardAnims.forEach((anim, i) => {
          anim.setValue(getCardOffset(i, activeCur, n) + dragDelta);
        });
      },
      onPanResponderRelease: (evt: GestureResponderEvent, gs: PanResponderGestureState) => {
        pagerSwipeLockBus.notify(false);
        const { dx, dy, vx } = gs;
        const isSwipeNext = dx < -CAROUSEL_TIMING.swipeThresholdPx || (dx < -10 && vx < -0.25);
        const isSwipePrev = dx > CAROUSEL_TIMING.swipeThresholdPx || (dx > 10 && vx > 0.25);

        if (isSwipeNext) {
          animateToIndex((curRef.current + 1) % n);
          return;
        }
        if (isSwipePrev) {
          animateToIndex((curRef.current - 1 + n) % n);
          return;
        }
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
          const locX = evt.nativeEvent.locationX;
          const vw = viewportWidthRef.current;
          if (typeof locX === 'number' && vw > 0) {
            if (locX > vw * 0.72) {
              animateToIndex((curRef.current + 1) % n);
              return;
            }
            if (locX < vw * 0.28) {
              animateToIndex((curRef.current - 1 + n) % n);
              return;
            }
          }
        }
        if (Math.abs(dx) > 0.5) {
          snapBackToCurrent();
        }
      },
      onPanResponderTerminate: () => {
        pagerSwipeLockBus.notify(false);
        snapBackToCurrent();
      },
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    })
  ).current;

  const getVisualForLayout = (layout: IdeaCard['layout']) => {
    switch (layout) {
      case 'agenda':
        return { tintBg: isDark ? '#192434' : '#dce9f9', chipBg: colors.blueBg, icon: <CalIcon color={colors.blue} /> };
      case 'gmail':
        return { tintBg: isDark ? '#2e1c1e' : '#f4dada', chipBg: colors.redBg, icon: <MailIcon color={colors.red} size={20} /> };
      case 'whatsapp':
        return { tintBg: isDark ? '#182920' : '#dcf2e6', chipBg: colors.greenBg, icon: <WhatsAppGlyph color={colors.acc} size={22} /> };
      case 'radar':
        return { tintBg: isDark ? '#2c2419' : '#ede6d6', chipBg: colors.orangeBg, icon: <RadarIcon color={colors.orange} /> };
      case 'task':
      default:
        return { tintBg: isDark ? '#2b1c26' : '#f3e0ec', chipBg: colors.purpleBg, icon: <CheckCircleIcon color={colors.purple} /> };
    }
  };

  const heroDeckStyle = {
    opacity: heroDeckAnim,
    transform: [
      {
        translateY: heroDeckAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [16, 0],
        }),
      },
    ],
  };

  const heroDotsStyle = {
    opacity: heroDotsAnim,
    transform: [
      {
        translateY: heroDotsAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [16, 0],
        }),
      },
    ],
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.deckViewport,
          heroDeckStyle,
          Platform.OS === 'web'
            ? ({ touchAction: 'pan-y', userSelect: 'none' } as Record<string, string>)
            : null,
        ]}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0) viewportWidthRef.current = w;
        }}
        onTouchStart={() => pagerSwipeLockBus.notify(true)}
        onTouchEnd={() => pagerSwipeLockBus.notify(false)}
        onTouchCancel={() => pagerSwipeLockBus.notify(false)}
        {...panResponder.panHandlers}
      >
        {IDEA_CARDS.map((card, i) => {
          const d = getCardOffset(i, cur, n);
          const isCurrent = d === 0;
          const isSide = Math.abs(d) === 1;
          const zIndex = isCurrent ? 10 : isSide ? 5 : 1;
          const interp = cardInterpolations[i];
          const visual = getVisualForLayout(card.layout);

          return (
            <Animated.View
              key={card.id}
              style={[
                styles.zc,
                {
                  backgroundColor: visual.tintBg,
                  borderColor: isCurrent ? colors.bg : colors.hairline,
                  borderWidth: isCurrent ? 4 : 1,
                  zIndex,
                  opacity: interp.opacity,
                  transform: [
                    { translateX: interp.translateX },
                    { scale: interp.scale },
                  ],
                },
              ]}
              pointerEvents={isCurrent ? 'box-none' : 'none'}
            >
              <View
                style={[styles.zcInner, { opacity: isCurrent ? 1 : 0 }]}
                pointerEvents={isCurrent ? 'box-none' : 'none'}
              >
                <View style={styles.zcTop} pointerEvents="none">
                  <View style={[styles.chip, { backgroundColor: visual.chipBg }]}>
                    {visual.icon}
                  </View>
                </View>

                <View style={styles.zcMiddle} pointerEvents="none">
                  <Text style={[styles.zcTitle, { color: colors.ink }]} numberOfLines={3}>
                    {card.title}
                  </Text>
                </View>

                <View style={styles.zcBottom} pointerEvents="box-none">
                  <TouchableOpacity
                    style={[styles.useButton, { backgroundColor: colors.ink }]}
                    onPress={() => {
                      hapticFeedback.medium();
                      onUseIdea(card.prompt);
                    }}
                    disabled={disabled || !isCurrent}
                    activeOpacity={0.82}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={[styles.useButtonText, { color: colors.bg }]}>Usar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          );
        })}
      </Animated.View>

      {/* .dk-dots indicador estático abaixo do deck */}
      <Animated.View style={[styles.dotsRow, heroDotsStyle]} accessibilityElementsHidden>
        {IDEA_CARDS.map((card, i) => {
          const active = i === cur;
          return (
            <TouchableOpacity
              key={card.id}
              onPress={() => animateToIndex(i)}
              hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
              style={[
                styles.dot,
                {
                  width: active ? 18 : 6,
                  backgroundColor: active ? colors.ink : colors.line,
                },
              ]}
              accessibilityLabel={`Ideia ${i + 1}`}
            />
          );
        })}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 8,
    width: '100%',
  },
  deckViewport: {
    width: '100%',
    maxWidth: 358,
    height: 216,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  zc: {
    position: 'absolute',
    width: 266,
    height: 216,
    borderRadius: v5Radii.card,
    overflow: 'hidden',
  },
  zcInner: {
    flex: 1,
    padding: 18,
    justifyContent: 'space-between',
  },
  zcTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  chip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zcMiddle: {
    flex: 1,
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  zcTitle: {
    fontFamily: 'Geist_500Medium',
    fontSize: 19,
    fontWeight: '500',
    lineHeight: 24,
    letterSpacing: -0.35,
  },
  zcBottom: {
    alignItems: 'flex-start',
  },
  useButton: {
    height: 40,
    paddingHorizontal: 20,
    borderRadius: v5Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  useButtonText: {
    fontFamily: 'Geist',
    fontSize: 14,
    fontWeight: '500',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    height: 8,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
});
