import React, { useEffect, useState } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
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
import { SCREEN_TRANSITIONS, type ScreenTransitionMode } from '../../theme/motion';
import { ScreenFocusProvider } from '../../theme/screenFocusContext';

export { SCREEN_TRANSITIONS, type ScreenTransitionMode } from '../../theme/motion';
export type SectionTransitionMode = ScreenTransitionMode;

export interface SectionTransitionProps {
  visible: boolean;
  mode?: SectionTransitionMode;
  reduceMotion?: boolean;
  style?: StyleProp<ViewStyle>;
  onExited?: () => void;
  children: React.ReactNode;
}

/**
 * Container de transição entre seções (Agenda, Chat, Bots, Finanças, Perfil e sub-telas)
 * usando curvas e offsets canônicos de `SCREEN_TRANSITIONS` na UI thread (Reanimated 4).
 * Mantém o conteúdo montado até o término da animação de saída.
 */
export const SectionTransition: React.FC<SectionTransitionProps> = ({
  visible,
  mode = 'tab',
  reduceMotion = false,
  style,
  onExited,
  children,
}) => {
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);
  const isLeaving = useSharedValue(visible ? 0 : 1);

  useEffect(() => {
    const finishExit = () => {
      setMounted(false);
      onExited?.();
    };

    if (visible) {
      setMounted(true);
      isLeaving.value = 0;
      if (reduceMotion) {
        cancelAnimation(progress);
        progress.value = 1;
        return;
      }
      const spec = SCREEN_TRANSITIONS[mode];
      const [x1, y1, x2, y2] = spec.enterCurve;
      cancelAnimation(progress);
      progress.value = 0;
      const enterTiming = withTiming(1, {
        duration: spec.enterMs,
        easing: Easing.bezier(x1, y1, x2, y2),
      });
      progress.value =
        spec.enterDelayMs > 0 ? withDelay(spec.enterDelayMs, enterTiming) : enterTiming;
      return () => cancelAnimation(progress);
    }

    if (!mounted) return;
    isLeaving.value = 1;
    if (reduceMotion) {
      cancelAnimation(progress);
      progress.value = 0;
      finishExit();
      return;
    }
    const spec = SCREEN_TRANSITIONS[mode];
    const [lx1, ly1, lx2, ly2] = spec.leaveCurve;
    cancelAnimation(progress);
    progress.value = withTiming(
      0,
      {
        duration: spec.leaveMs,
        easing: Easing.bezier(lx1, ly1, lx2, ly2),
      },
      (finished) => {
        if (finished) {
          scheduleOnRN(finishExit);
        }
      },
    );
    return () => cancelAnimation(progress);
  }, [visible, mounted, mode, reduceMotion, progress, isLeaving, onExited]);

  const spec = SCREEN_TRANSITIONS[mode];
  const enterFromX = spec.enterOffset.x;
  const enterFromY = spec.enterOffset.y;
  const leaveToX = spec.leaveOffset.x;
  const leaveToY = spec.leaveOffset.y;

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const leaving = isLeaving.value > 0.5;
    const tx = interpolate(
      p,
      [0, 1],
      [leaving ? leaveToX : enterFromX, 0],
      Extrapolation.CLAMP,
    );
    const ty = interpolate(
      p,
      [0, 1],
      [leaving ? leaveToY : enterFromY, 0],
      Extrapolation.CLAMP,
    );
    return {
      opacity: p,
      transform: [{ translateX: tx }, { translateY: ty }],
    };
  }, [enterFromX, enterFromY, leaveToX, leaveToY]);

  if (!mounted) return null;

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.base, style, animatedStyle]}
    >
      <ScreenFocusProvider active={visible}>{children}</ScreenFocusProvider>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  base: {
    flex: 1,
    minHeight: 0,
  },
});
