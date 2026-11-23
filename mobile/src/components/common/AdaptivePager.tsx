import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { MOTION_CURVES, SCREEN_TRANSITIONS } from '../../theme/motion';
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

/**
 * Host de abas fiel ao protótipo (#vito-motion):
 * - sem swipe (as abas só trocam por toque);
 * - a aba nova entra com tr-tab (translateY 6px + fade, 360ms, delay 50ms);
 * - a aba anterior sai com lv-tab (fade 170ms);
 * - todas as abas permanecem montadas (mesmo comportamento do PagerView), sem perder estado.
 */
export const AdaptivePager = forwardRef<AdaptivePagerRef, AdaptivePagerProps>(
  ({ initialPage = 0, onPageSelected, children, style }, ref) => {
    const reduceMotion = useReduceMotion();
    const count = React.Children.count(children);
    const [activeIndex, setActiveIndex] = useState(initialPage);
    const [leavingIndex, setLeavingIndex] = useState<number | null>(null);

    const enter = useRef(new Animated.Value(1)).current;
    const leave = useRef(new Animated.Value(1)).current;
    const activeRef = useRef(initialPage);

    const tabSpec = SCREEN_TRANSITIONS.tab;

    const animateTo = useCallback(
      (nextIndex: number, animated: boolean) => {
        const previous = activeRef.current;
        if (nextIndex === previous || nextIndex < 0 || nextIndex >= count) return;

        activeRef.current = nextIndex;
        setLeavingIndex(previous);
        setActiveIndex(nextIndex);
        onPageSelected?.(nextIndex);

        if (!animated || reduceMotion) {
          enter.setValue(1);
          leave.setValue(0);
          setLeavingIndex(null);
          return;
        }

        enter.setValue(0);
        leave.setValue(1);

        Animated.parallel([
          Animated.timing(enter, {
            toValue: 1,
            duration: tabSpec.enterMs,
            delay: tabSpec.enterDelayMs,
            easing: Easing.bezier(...MOTION_CURVES.q),
            useNativeDriver: true,
          }),
          Animated.timing(leave, {
            toValue: 0,
            duration: tabSpec.leaveMs,
            easing: Easing.bezier(...MOTION_CURVES.in),
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (finished) setLeavingIndex(null);
        });
      },
      [count, enter, leave, onPageSelected, reduceMotion, tabSpec.enterDelayMs, tabSpec.enterMs, tabSpec.leaveMs]
    );

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
        setActiveIndex(initialPage);
      }
    }, [count, initialPage]);

    const enterStyle = useMemo(
      () => ({
        opacity: enter,
        transform: [
          {
            translateY: enter.interpolate({
              inputRange: [0, 1],
              outputRange: [tabSpec.enterOffset.y, 0],
            }),
          },
        ],
      }),
      [enter, tabSpec.enterOffset.y]
    );

    const leaveStyle = useMemo(
      () => ({
        opacity: leave,
        transform: [
          {
            translateY: leave.interpolate({
              inputRange: [0, 1],
              outputRange: [tabSpec.leaveOffset.y, 0],
            }),
          },
        ],
      }),
      [leave, tabSpec.leaveOffset.y]
    );

    return (
      <View style={style}>
        {React.Children.map(children, (child, index) => {
          const isActive = index === activeIndex;
          const isLeaving = index === leavingIndex;
          if (!isActive && !isLeaving) {
            return (
              <View
                key={index}
                style={styles.hiddenPage}
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                {child}
              </View>
            );
          }
          return (
            <Animated.View
              key={index}
              style={[styles.page, isActive ? enterStyle : leaveStyle, { zIndex: isActive ? 2 : 1 }]}
              pointerEvents={isActive ? 'auto' : 'none'}
              accessibilityElementsHidden={!isActive}
              importantForAccessibility={isActive ? 'auto' : 'no-hide-descendants'}
            >
              {child}
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  },
});
