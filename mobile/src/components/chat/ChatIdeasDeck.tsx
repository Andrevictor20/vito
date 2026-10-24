import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  PanResponder,
  PanResponderGestureState,
  GestureResponderEvent,
  Animated,
  Easing,
  AccessibilityInfo,
  Platform,
} from 'react-native';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';
import { pagerSwipeLockBus } from '../../services/dataSync';
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

const SPEC_M2 = getCardVisualSpec(-2);
const SPEC_M1 = getCardVisualSpec(-1);
const SPEC_0 = getCardVisualSpec(0);
const SPEC_P1 = getCardVisualSpec(1);
const SPEC_P2 = getCardVisualSpec(2);

/**
 * Carrossel 3D de ideias da tela inicial do Chat (paridade com .deck de vito-telas.html).
 *
 * Arquitetura de animação contínua sem travamentos (Zero-Snap / Zero-Remount):
 * - Cada card possui seu próprio `Animated.Value` persistente (`cardAnims[i]`) representando
 *   sua posição contínua na pilha (-2, -1, 0, +1, +2).
 * - Os nós de interpolação (`translateX`, `rotate`, `scale`, `opacity`) são criados UMA ÚNICA VEZ
 *   na montagem e rodam 100% na UI thread (`useNativeDriver: true`).
 * - A ordem dos elementos nunca é reordenada (`.sort()` removido), eliminando remounts nativos.
 * - O índice `cur` é atualizado no INÍCIO da transição (como no HTML), atualizando `zIndex`
 *   imediatamente e animando cada card diretamente até seu destino sem `setValue(0)` no final.
 * - No toque inicial (`onTouchStart` + `onStartShouldSetPanResponder`), bloqueia imediatamente
 *   o `PagerView` / `FlatList` pai via `pagerSwipeLockBus` e `onShouldBlockNativeResponder`,
 *   permitindo deslizar os cards livremente com o dedo no celular.
 */
export const ChatIdeasDeck: React.FC<ChatIdeasDeckProps> = ({ onUseIdea, disabled }) => {
  const { colors, isDark } = useTheme();
  const n = IDEA_CARDS.length;

  const [cur, setCur] = useState(0);
  const curRef = useRef(0);
  const reduceMotionRef = useRef(false);
  const viewportWidthRef = useRef(320);

  // Um Animated.Value persistente por card (nunca recriado)
  const cardAnims = useRef<Animated.Value[]>(
    IDEA_CARDS.map((_, i) => new Animated.Value(getCardOffset(i, 0, n)))
  ).current;

  // Interpolações persistentes por card (criadas uma única vez)
  const cardInterpolations = useRef(
    cardAnims.map((anim) => ({
      translateX: anim.interpolate({
        inputRange: [-2, -1, 0, 1, 2],
        outputRange: [SPEC_M2.tx, SPEC_M1.tx, SPEC_0.tx, SPEC_P1.tx, SPEC_P2.tx],
        extrapolate: 'clamp',
      }),
      rotate: anim.interpolate({
        inputRange: [-2, -1, 0, 1, 2],
        outputRange: [SPEC_M2.rot, SPEC_M1.rot, SPEC_0.rot, SPEC_P1.rot, SPEC_P2.rot],
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
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) reduceMotionRef.current = enabled;
      })
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener
      ? AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled: boolean) => {
          if (mounted) reduceMotionRef.current = enabled;
        })
      : null;

    return () => {
      mounted = false;
      pagerSwipeLockBus.notify(false);
      cardAnims.forEach((a) => a.stopAnimation());
      sub?.remove?.();
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

        // Card que dá a volta pelo fundo invisível (|d| >= 2 tem opacidade 0)
        if (Math.abs(newD - oldD) > 2) {
          anim.setValue(newD);
          return;
        }

        animations.push(
          Animated.timing(anim, {
            toValue: newD,
            duration: CAROUSEL_TIMING.durationMs,
            easing: Easing.bezier(
              CAROUSEL_TIMING.bezier[0],
              CAROUSEL_TIMING.bezier[1],
              CAROUSEL_TIMING.bezier[2],
              CAROUSEL_TIMING.bezier[3]
            ),
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
      const targetD = getCardOffset(i, activeCur, n);
      anim.stopAnimation();
      return Animated.spring(anim, {
        toValue: targetD,
        damping: CAROUSEL_TIMING.spring.damping,
        stiffness: CAROUSEL_TIMING.spring.stiffness,
        mass: CAROUSEL_TIMING.spring.mass,
        useNativeDriver: true,
      });
    });
    Animated.parallel(animations).start();
  }, [cardAnims, n]);

  const goNext = useCallback(() => {
    animateToIndex((curRef.current + 1) % n);
  }, [animateToIndex, n]);

  const goPrev = useCallback(() => {
    animateToIndex((curRef.current - 1 + n) % n);
  }, [animateToIndex, n]);

  const panResponder = useRef(
    PanResponder.create({
      // Reivindica o toque imediatamente no início (ACTION_DOWN) para que o ViewPager2 (Android)
      // respeite requestDisallowInterceptTouchEvent(true) e não roube o swipe horizontal.
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState: PanResponderGestureState) =>
        Math.abs(gestureState.dx) > 4 &&
        Math.abs(gestureState.dx) >= Math.abs(gestureState.dy) * 0.7,
      // Captura o arrasto mesmo se o dedo começou em cima do botão "Usar"
      onMoveShouldSetPanResponderCapture: (_, gestureState: PanResponderGestureState) =>
        Math.abs(gestureState.dx) > 6 &&
        Math.abs(gestureState.dx) >= Math.abs(gestureState.dy) * 0.7,
      onPanResponderGrant: () => {
        pagerSwipeLockBus.notify(true);
        cardAnims.forEach((a) => a.stopAnimation());
      },
      onPanResponderMove: (_, gestureState: PanResponderGestureState) => {
        const dragDelta = Math.max(
          -1.15,
          Math.min(1.15, gestureState.dx / CAROUSEL_TIMING.dragScalePx)
        );
        const activeCur = curRef.current;
        cardAnims.forEach((anim, i) => {
          const baseD = getCardOffset(i, activeCur, n);
          anim.setValue(baseD + dragDelta);
        });
      },
      onPanResponderRelease: (
        evt: GestureResponderEvent,
        gestureState: PanResponderGestureState
      ) => {
        pagerSwipeLockBus.notify(false);
        const { dx, dy, vx } = gestureState;

        const isSwipeNext =
          dx < -CAROUSEL_TIMING.swipeThresholdPx || (dx < -10 && vx < -0.25);
        const isSwipePrev =
          dx > CAROUSEL_TIMING.swipeThresholdPx || (dx > 10 && vx > 0.25);

        if (isSwipeNext) {
          animateToIndex((curRef.current + 1) % n);
          return;
        }
        if (isSwipePrev) {
          animateToIndex((curRef.current - 1 + n) % n);
          return;
        }

        // Se foi apenas um toque rápido nas bordas esquerda/direita do deck, navega para o card lateral
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

  const getChipAndTag = (layout: IdeaCard['layout']) => {
    switch (layout) {
      case 'agenda':
        return {
          chipBg: colors.blueBg,
          icon: <CalIcon color={colors.blue} />,
          tagBg: colors.blueBg,
          tagText: colors.blue,
        };
      case 'gmail':
        return {
          chipBg: colors.redBg,
          icon: <MailIcon color={colors.red} size={20} />,
          tagBg: colors.redBg,
          tagText: colors.red,
        };
      case 'whatsapp':
        return {
          chipBg: colors.greenBg,
          icon: <WhatsAppGlyph color={colors.acc} size={22} />,
          tagBg: colors.greenBg,
          tagText: colors.acc,
        };
      case 'radar':
        return {
          chipBg: colors.orangeBg,
          icon: <RadarIcon color={colors.orange} />,
          tagBg: colors.orangeBg,
          tagText: colors.orange,
        };
      case 'task':
      default:
        return {
          chipBg: colors.purpleBg,
          icon: <CheckCircleIcon color={colors.purple} />,
          tagBg: colors.purpleBg,
          tagText: colors.purple,
        };
    }
  };

  return (
    <View style={styles.container}>
      {/* Deck 3D Carousel */}
      <View
        style={[
          styles.deckViewport,
          Platform.OS === 'web' ? ({ touchAction: 'pan-y', userSelect: 'none' } as any) : null,
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
                  elevation: isCurrent ? 6 : isSide ? 2 : 0,
                  opacity: interp.opacity,
                  transform: [
                    { translateX: interp.translateX },
                    { rotate: interp.rotate },
                    { scale: interp.scale },
                  ],
                },
                isCurrent &&
                  (isDark ? styles.zcCurrentShadowDark : styles.zcCurrentShadow),
              ]}
              pointerEvents={isCurrent ? 'box-none' : 'none'}
            >
              {/* Top Row: Chip Arredondado 38x38px com Ícone Vetorial + Tag Pílula */}
              <View style={styles.zcTop} pointerEvents="none">
                <View style={[styles.chip, { backgroundColor: visual.chipBg }]}>
                  {visual.icon}
                </View>
                <View style={[styles.tag, { backgroundColor: visual.tagBg }]}>
                  <Text style={[styles.tagText, { color: visual.tagText }]}>
                    {card.tag}
                  </Text>
                </View>
              </View>

              {/* Middle: Título e Descrição */}
              <View style={styles.zcMiddle} pointerEvents="none">
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
              <View style={styles.zcBottom} pointerEvents="box-none">
                <TouchableOpacity
                  style={[styles.useButton, { backgroundColor: colors.ink }]}
                  onPress={() => {
                    hapticFeedback.medium();
                    onUseIdea(card.prompt);
                  }}
                  disabled={disabled || !isCurrent}
                  activeOpacity={0.8}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.useButtonText, { color: colors.bg }]}>
                    Usar
                  </Text>
                </TouchableOpacity>
              </View>
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
    width: '100%',
    maxWidth: 340,
    height: 246,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  zc: {
    position: 'absolute',
    width: 232,
    height: 232,
    borderRadius: 28,
    padding: 18,
    justifyContent: 'space-between',
  },
  zcCurrentShadow: {
    shadowColor: '#141916',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
  },
  zcCurrentShadowDark: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  tagText: {
    fontSize: 12,
    fontFamily: tokens.typography.family.semibold,
    fontWeight: '600',
  },
  zcMiddle: {
    flex: 1,
    justifyContent: 'center',
    marginVertical: 8,
  },
  zcTitle: {
    fontSize: 16.5,
    fontFamily: tokens.typography.family.semibold,
    fontWeight: '600',
    lineHeight: 21,
    marginBottom: 4,
  },
  zcSubtitle: {
    fontSize: 13,
    fontFamily: tokens.typography.family.regular,
    lineHeight: 18,
  },
  zcBottom: {
    alignItems: 'flex-start',
  },
  useButton: {
    height: 36,
    paddingHorizontal: 20,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  useButtonText: {
    fontSize: 14,
    fontFamily: tokens.typography.family.semibold,
    fontWeight: '600',
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
    fontFamily: tokens.typography.family.semibold,
    fontWeight: '600',
  },
});
