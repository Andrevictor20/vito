import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import { MascotAnimationState, MascotPart } from './mascotPalettes';
import { buildStateSequences, MascotAnimRefs } from './mascotAnimationBuilders';

export interface UseMascotAnimationOptions {
  state: MascotAnimationState;
  animated: boolean;
  speed?: number;
}

export function useMascotAnimation({
  state,
  animated,
  speed = 1,
}: UseMascotAnimationOptions) {
  const safeSpeed = Math.max(0.25, speed);

  const wholeX = useRef(new Animated.Value(0)).current;
  const wholeY = useRef(new Animated.Value(0)).current;
  const wholeRotate = useRef(new Animated.Value(0)).current;
  const hatX = useRef(new Animated.Value(0)).current;
  const hatY = useRef(new Animated.Value(0)).current;
  const hatRotate = useRef(new Animated.Value(0)).current;
  const eyesX = useRef(new Animated.Value(0)).current;
  const eyesY = useRef(new Animated.Value(0)).current;
  const eyeLeftScaleY = useRef(new Animated.Value(1)).current;
  const eyeRightScaleY = useRef(new Animated.Value(1)).current;
  const eyeLeftScale = useRef(new Animated.Value(1)).current;
  const eyeRightScale = useRef(new Animated.Value(1)).current;
  const bowtieX = useRef(new Animated.Value(0)).current;
  const bowtieY = useRef(new Animated.Value(0)).current;
  const bowtieRotate = useRef(new Animated.Value(0)).current;
  const bowtieScale = useRef(new Animated.Value(1)).current;

  const fxSparkleOpacity = useRef(new Animated.Value(0)).current;
  const fxSparkleY = useRef(new Animated.Value(4)).current;
  const fxSparkleScale = useRef(new Animated.Value(0.85)).current;
  const fxAlertOpacity = useRef(new Animated.Value(0)).current;
  const fxAlertScale = useRef(new Animated.Value(0.8)).current;
  const fxDot1Opacity = useRef(new Animated.Value(0.25)).current;
  const fxDot2Opacity = useRef(new Animated.Value(0.25)).current;
  const fxDot3Opacity = useRef(new Animated.Value(0.25)).current;
  const fxDot1Y = useRef(new Animated.Value(3)).current;
  const fxDot2Y = useRef(new Animated.Value(3)).current;
  const fxDot3Y = useRef(new Animated.Value(3)).current;
  const fxZ1Opacity = useRef(new Animated.Value(0)).current;
  const fxZ1X = useRef(new Animated.Value(0)).current;
  const fxZ1Y = useRef(new Animated.Value(8)).current;
  const fxZ2Opacity = useRef(new Animated.Value(0)).current;
  const fxZ2X = useRef(new Animated.Value(0)).current;
  const fxZ2Y = useRef(new Animated.Value(8)).current;
  const fxZ3Opacity = useRef(new Animated.Value(0)).current;
  const fxZ3X = useRef(new Animated.Value(0)).current;
  const fxZ3Y = useRef(new Animated.Value(8)).current;

  const refs: MascotAnimRefs = useMemo(
    () => ({
      wholeX, wholeY, wholeRotate,
      hatX, hatY, hatRotate,
      eyesX, eyesY,
      eyeLeftScaleY, eyeRightScaleY, eyeLeftScale, eyeRightScale,
      bowtieX, bowtieY, bowtieRotate, bowtieScale,
      fxSparkleOpacity, fxSparkleY, fxSparkleScale,
      fxAlertOpacity, fxAlertScale,
      fxDot1Opacity, fxDot2Opacity, fxDot3Opacity,
      fxDot1Y, fxDot2Y, fxDot3Y,
      fxZ1Opacity, fxZ1X, fxZ1Y,
      fxZ2Opacity, fxZ2X, fxZ2Y,
      fxZ3Opacity, fxZ3X, fxZ3Y,
    }),
    [
      bowtieRotate, bowtieScale, bowtieX, bowtieY,
      eyeLeftScale, eyeLeftScaleY, eyeRightScale, eyeRightScaleY, eyesX, eyesY,
      fxAlertOpacity, fxAlertScale, fxDot1Opacity, fxDot1Y, fxDot2Opacity, fxDot2Y,
      fxDot3Opacity, fxDot3Y, fxSparkleOpacity, fxSparkleScale, fxSparkleY,
      fxZ1Opacity, fxZ1X, fxZ1Y, fxZ2Opacity, fxZ2X, fxZ2Y, fxZ3Opacity, fxZ3X, fxZ3Y,
      hatRotate, hatX, hatY, wholeRotate, wholeX, wholeY,
    ]
  );

  const reduceMotionRef = useRef(false);

  const resetAll = useCallback(() => {
    [
      wholeX, wholeY, wholeRotate, hatX, hatY, hatRotate, eyesX, eyesY,
      bowtieX, bowtieY, bowtieRotate, fxAlertOpacity,
      fxZ1Opacity, fxZ2Opacity, fxZ3Opacity, fxZ1X, fxZ2X, fxZ3X,
    ].forEach((v) => {
      v.stopAnimation();
      v.setValue(0);
    });
    [eyeLeftScaleY, eyeRightScaleY, eyeLeftScale, eyeRightScale, bowtieScale].forEach((v) => {
      v.stopAnimation();
      v.setValue(1);
    });
    fxSparkleOpacity.stopAnimation();
    fxSparkleOpacity.setValue(state === 'happy' ? 1 : 0);
    fxSparkleY.setValue(0);
    fxSparkleScale.setValue(1);
    fxAlertScale.setValue(1);
    [fxDot1Opacity, fxDot2Opacity, fxDot3Opacity].forEach((v) => {
      v.stopAnimation();
      v.setValue(state === 'thinking' ? 0.85 : 0.25);
    });
    [fxDot1Y, fxDot2Y, fxDot3Y, fxZ1Y, fxZ2Y, fxZ3Y].forEach((v) => v.setValue(0));
  }, [
    bowtieRotate, bowtieScale, bowtieX, bowtieY,
    eyeLeftScale, eyeLeftScaleY, eyeRightScale, eyeRightScaleY, eyesX, eyesY,
    fxAlertOpacity, fxAlertScale, fxDot1Opacity, fxDot1Y, fxDot2Opacity, fxDot2Y,
    fxDot3Opacity, fxDot3Y, fxSparkleOpacity, fxSparkleScale, fxSparkleY,
    fxZ1Opacity, fxZ1X, fxZ1Y, fxZ2Opacity, fxZ2X, fxZ2Y, fxZ3Opacity, fxZ3X, fxZ3Y,
    hatRotate, hatX, hatY, state, wholeRotate, wholeX, wholeY,
  ]);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) reduceMotionRef.current = enabled;
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (enabled) => {
      reduceMotionRef.current = enabled;
      if (enabled) resetAll();
    });
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, [resetAll]);

  useEffect(() => {
    resetAll();
    if (!animated || reduceMotionRef.current) return;

    const loops = buildStateSequences(state, refs, safeSpeed).map((seq) => Animated.loop(seq));
    loops.forEach((l) => l.start());
    return () => {
      loops.forEach((l) => l.stop());
    };
  }, [animated, refs, resetAll, safeSpeed, state]);

  const triggerPartReaction = useCallback(
    (part: MascotPart) => {
      if (reduceMotionRef.current) return;
      if (part === 'hat') {
        Animated.sequence([
          Animated.parallel([
            Animated.timing(hatX, { toValue: 16, duration: 240, easing: Easing.out(Easing.back(1.6)), useNativeDriver: false }),
            Animated.timing(hatY, { toValue: -26, duration: 240, easing: Easing.out(Easing.back(1.6)), useNativeDriver: false }),
            Animated.timing(hatRotate, { toValue: 20, duration: 240, easing: Easing.out(Easing.back(1.6)), useNativeDriver: false }),
          ]),
          Animated.delay(140),
          Animated.parallel([
            Animated.timing(hatX, { toValue: 0, duration: 220, useNativeDriver: false }),
            Animated.timing(hatY, { toValue: 0, duration: 220, useNativeDriver: false }),
            Animated.timing(hatRotate, { toValue: 0, duration: 220, useNativeDriver: false }),
          ]),
        ]).start();
      } else if (part === 'bowtie') {
        bowtieRotate.setValue(0);
        Animated.sequence([
          Animated.parallel([
            Animated.timing(bowtieRotate, { toValue: 360, duration: 520, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
            Animated.timing(bowtieScale, { toValue: 1.18, duration: 260, useNativeDriver: false }),
          ]),
          Animated.timing(bowtieScale, { toValue: 1, duration: 180, useNativeDriver: false }),
        ]).start(() => bowtieRotate.setValue(0));
      } else {
        Animated.sequence([
          Animated.parallel([
            Animated.timing(eyeLeftScaleY, { toValue: 0.08, duration: 90, useNativeDriver: false }),
            Animated.timing(eyeRightScaleY, { toValue: 0.08, duration: 90, useNativeDriver: false }),
          ]),
          Animated.parallel([
            Animated.timing(eyeLeftScaleY, { toValue: 1, duration: 110, useNativeDriver: false }),
            Animated.timing(eyeRightScaleY, { toValue: 1, duration: 110, useNativeDriver: false }),
          ]),
        ]).start();
      }
    },
    [bowtieRotate, bowtieScale, eyeLeftScaleY, eyeRightScaleY, hatRotate, hatX, hatY]
  );

  return {
    ...refs,
    triggerPartReaction,
  };
}
