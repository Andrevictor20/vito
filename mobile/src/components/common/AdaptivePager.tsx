import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { getBezier } from '../../ds/tokens';
import { SECTION_TRANSITION_SPECS } from '../../ds/transitionSpecs';
import { ScreenFocusProvider } from '../../theme/screenFocusContext';
import { useReduceMotion } from '../../theme/useReduceMotion';

export interface AdaptivePagerRef {
  setPage: (index: number) => void;
  setPageWithoutAnimation: (index: number) => void;
}

interface AdaptivePagerProps {
  initialPage?: number;
  /** Mantido por compatibilidade: o protótipo não permite arrastar entre abas. */
  scrollEnabled?: boolean;
  onPageSelected?: (position: number) => void;
  children: React.ReactNode[];
  style?: object;
}

const TAB_SLIDE_Y = 8;
const TAB_SLIDE_X = 28;
const TAB_LEAVE_X = 18;

/**
 * Host de abas fluido na UI thread (Reanimated 4):
 * - sem swipe (as abas trocam por toque na navbar);
 * - todas as abas permanecem sempre montadas (zero remontagem / zero flash);
 * - transição direcional horizontal acompanhando a ordem das abas na navbar
 *   (slide direcional + micro-escala + fade em --ease-q 340ms);
 * - limpeza de leavingIndex isolada do ciclo de entrada (nunca corta o enter no meio).
 */
export const AdaptivePager = forwardRef<AdaptivePagerRef, AdaptivePagerProps>(
  ({ initialPage = 0, onPageSelected, children, style }, ref) => {
    const reduceMotion = useReduceMotion();
    const count = React.Children.count(children);
    const [activeIndex, setActiveIndex] = useState(initialPage);
    const [leavingIndex, setLeavingIndex] = useState<number | null>(null);
    const [transitionId, setTransitionId] = useState(0);

    const enter = useSharedValue(1);
    const leave = useSharedValue(0);
    const direction = useSharedValue(1);
    const activeRef = useRef(initialPage);
    const leavingRef = useRef<number | null>(null);
    const animatedRef = useRef(false);

    const tabSpec = SECTION_TRANSITION_SPECS.tab;

    const animateTo = useCallback(
      (nextIndex: number, animated: boolean) => {
        const previous = activeRef.current;
        if (nextIndex === previous || nextIndex < 0 || nextIndex >= count) return;

        const shouldAnim = animated && !reduceMotion;
        direction.value = nextIndex > previous ? 1 : -1;
        activeRef.current = nextIndex;
        animatedRef.current = shouldAnim;
        leavingRef.current = shouldAnim ? previous : null;
        setLeavingIndex(shouldAnim ? previous : null);
        setActiveIndex(nextIndex);
        setTransitionId((n) => n + 1);
        onPageSelected?.(nextIndex);
      },
      [count, direction, onPageSelected, reduceMotion]
    );

    useEffect(() => {
      if (transitionId === 0) return;
      cancelAnimation(enter);
      cancelAnimation(leave);

      if (!animatedRef.current || reduceMotion || leavingRef.current === null) {
        enter.value = 1;
        leave.value = 0;
        return;
      }

      const [qx1, qy1, qx2, qy2] = getBezier('--ease-q');
      const [sx1, sy1, sx2, sy2] = getBezier('--ease-std');

      enter.value = 0;
      leave.value = 1;

      enter.value = withDelay(
        16,
        withTiming(1, {
          duration: 340,
          easing: Easing.bezier(qx1, qy1, qx2, qy2),
        })
      );

      leave.value = withTiming(
        0,
        {
          duration: 210,
          easing: Easing.bezier(sx1, sy1, sx2, sy2),
        },
        (finished) => {
          if (finished) {
            scheduleOnRN(setLeavingIndex, null);
          }
        }
      );

      return () => {
        cancelAnimation(enter);
        cancelAnimation(leave);
      };
    }, [transitionId, reduceMotion, enter, leave]);

    useImperativeHandle(
      ref,
      () => ({
        setPage: (index: number) => animateTo(index, true),
        setPageWithoutAnimation: (index: number) => animateTo(index, false),
      }),
      [animateTo]
    );

    useEffect(() => {
      if (initialPage >= 0 && initialPage < count && initialPage !== activeRef.current) {
        activeRef.current = initialPage;
        animatedRef.current = false;
        leavingRef.current = null;
        setLeavingIndex(null);
        setActiveIndex(initialPage);
      }
    }, [count, initialPage]);

    const leaveToY = tabSpec.leave.toY;

    const enterStyle = useAnimatedStyle(() => {
      const p = enter.value;
      const dir = direction.value;
      return {
        opacity: interpolate(p, [0, 0.25, 1], [0, 0.85, 1], Extrapolation.CLAMP),
        transform: [
          {
            translateX: interpolate(p, [0, 1], [dir * TAB_SLIDE_X, 0], Extrapolation.CLAMP),
          },
          {
            translateY: interpolate(p, [0, 1], [TAB_SLIDE_Y, 0], Extrapolation.CLAMP),
          },
          {
            scale: interpolate(p, [0, 1], [0.985, 1], Extrapolation.CLAMP),
          },
        ],
      };
    });

    const leaveStyle = useAnimatedStyle(() => {
      const p = leave.value;
      const dir = direction.value;
      return {
        opacity: p,
        transform: [
          {
            translateX: interpolate(p, [0, 1], [-dir * TAB_LEAVE_X, 0], Extrapolation.CLAMP),
          },
          {
            translateY: interpolate(p, [0, 1], [leaveToY, 0], Extrapolation.CLAMP),
          },
          {
            scale: interpolate(p, [0, 1], [0.988, 1], Extrapolation.CLAMP),
          },
        ],
      };
    }, [leaveToY]);

    return (
      <View style={style}>
        {React.Children.map(children, (child, index) => {
          const isActive = index === activeIndex;
          const isLeaving = index === leavingIndex;
          return (
            <Animated.View
              key={index}
              style={[
                styles.page,
                isActive ? enterStyle : isLeaving ? leaveStyle : styles.hiddenPage,
                { zIndex: isActive ? 2 : isLeaving ? 1 : 0 },
              ]}
              pointerEvents={isActive ? 'auto' : 'none'}
              accessibilityElementsHidden={!isActive}
              importantForAccessibility={isActive ? 'auto' : 'no-hide-descendants'}
            >
              <ScreenFocusProvider active={isActive}>{child}</ScreenFocusProvider>
            </Animated.View>
          );
        })}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  page: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  hiddenPage: {
    opacity: 0,
  },
});
