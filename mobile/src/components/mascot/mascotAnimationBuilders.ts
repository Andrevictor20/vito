import { Animated, Easing } from 'react-native';
import { MascotAnimationState } from './mascotPalettes';

export interface MascotAnimRefs {
  wholeX: Animated.Value;
  wholeY: Animated.Value;
  wholeRotate: Animated.Value;
  hatX: Animated.Value;
  hatY: Animated.Value;
  hatRotate: Animated.Value;
  eyesX: Animated.Value;
  eyesY: Animated.Value;
  eyeLeftScaleY: Animated.Value;
  eyeRightScaleY: Animated.Value;
  eyeLeftScale: Animated.Value;
  eyeRightScale: Animated.Value;
  bowtieX: Animated.Value;
  bowtieY: Animated.Value;
  bowtieRotate: Animated.Value;
  bowtieScale: Animated.Value;
  fxSparkleOpacity: Animated.Value;
  fxSparkleY: Animated.Value;
  fxSparkleScale: Animated.Value;
  fxAlertOpacity: Animated.Value;
  fxAlertScale: Animated.Value;
  fxDot1Opacity: Animated.Value;
  fxDot2Opacity: Animated.Value;
  fxDot3Opacity: Animated.Value;
  fxDot1Y: Animated.Value;
  fxDot2Y: Animated.Value;
  fxDot3Y: Animated.Value;
  fxZ1Opacity: Animated.Value;
  fxZ2Opacity: Animated.Value;
  fxZ3Opacity: Animated.Value;
  fxZ1X: Animated.Value;
  fxZ2X: Animated.Value;
  fxZ3X: Animated.Value;
  fxZ1Y: Animated.Value;
  fxZ2Y: Animated.Value;
  fxZ3Y: Animated.Value;
}

const sinEase = Easing.inOut(Easing.sin);
const stdEase = Easing.bezier(0.4, 0, 0.2, 1);
const tipEase = Easing.bezier(0.34, 1.45, 0.64, 1);

const t = (
  val: Animated.Value,
  toValue: number,
  duration: number,
  easing = stdEase
) =>
  Animated.timing(val, {
    toValue,
    duration,
    easing,
    useNativeDriver: false,
  });

export function buildBlinkSequence(
  refs: MascotAnimRefs,
  periodMs: number,
  d: (ms: number) => number
): Animated.CompositeAnimation {
  const blinkPair = (toVal: number, dur: number) =>
    Animated.parallel([
      t(refs.eyeLeftScaleY, toVal, dur),
      t(refs.eyeRightScaleY, toVal, dur),
    ]);
  return Animated.sequence([
    Animated.delay(d(periodMs * 0.44)),
    blinkPair(0.06, d(90)),
    blinkPair(1, d(110)),
    Animated.delay(d(periodMs * 0.25)),
    blinkPair(0.06, d(90)),
    blinkPair(1, d(110)),
    Animated.delay(d(periodMs * 0.16)),
  ]);
}

export function buildStateSequences(
  state: MascotAnimationState,
  refs: MascotAnimRefs,
  speed: number
): Animated.CompositeAnimation[] {
  const d = (ms: number) => Math.round(ms / Math.max(0.25, speed));

  if (state === 'blink' || state === 'interactive') {
    return [buildBlinkSequence(refs, state === 'blink' ? 3600 : 4200, d)];
  }

  if (state === 'idle') {
    return [
      Animated.sequence([
        Animated.parallel([
          t(refs.wholeY, -9, d(1600), sinEase),
          t(refs.hatX, 1, d(1700), sinEase),
          t(refs.hatY, -3.5, d(1700), sinEase),
          t(refs.hatRotate, 1.6, d(1700), sinEase),
          t(refs.eyesY, -2, d(1600), sinEase),
          t(refs.bowtieY, -1.5, d(1650), sinEase),
          t(refs.bowtieScale, 1.025, d(1650), sinEase),
        ]),
        Animated.parallel([
          t(refs.wholeY, 0, d(1600), sinEase),
          t(refs.hatX, 0, d(1500), sinEase),
          t(refs.hatY, 0, d(1500), sinEase),
          t(refs.hatRotate, 0, d(1500), sinEase),
          t(refs.eyesY, 0, d(1600), sinEase),
          t(refs.bowtieY, 0, d(1550), sinEase),
          t(refs.bowtieScale, 1, d(1550), sinEase),
        ]),
      ]),
      buildBlinkSequence(refs, 4200, d),
    ];
  }

  if (state === 'gentleman') {
    return [
      Animated.sequence([
        Animated.delay(d(540)),
        Animated.parallel([
          t(refs.wholeY, 4, d(540)),
          t(refs.wholeRotate, 2.5, d(540)),
          t(refs.eyesX, 3, d(540)),
          t(refs.eyesY, 4, d(540)),
          t(refs.hatX, 16, d(600), tipEase),
          t(refs.hatY, -25, d(600), tipEase),
          t(refs.hatRotate, 21, d(600), tipEase),
          t(refs.eyeRightScaleY, 0.08, d(240)),
          Animated.sequence([
            t(refs.bowtieRotate, -7, d(240)),
            t(refs.bowtieRotate, 7, d(240)),
            t(refs.bowtieRotate, -4, d(240)),
            t(refs.bowtieRotate, 0, d(240)),
          ]),
        ]),
        Animated.delay(d(600)),
        Animated.parallel([
          t(refs.wholeY, 0, d(660)),
          t(refs.wholeRotate, 0, d(660)),
          t(refs.eyesX, 0, d(660)),
          t(refs.eyesY, 0, d(660)),
          t(refs.hatX, 0, d(660)),
          t(refs.hatY, 0, d(660)),
          t(refs.hatRotate, 0, d(660)),
          t(refs.eyeRightScaleY, 1, d(240)),
        ]),
        Animated.delay(d(500)),
      ]),
    ];
  }

  if (state === 'happy') {
    return [
      Animated.sequence([
        Animated.parallel([
          t(refs.wholeY, -18, d(500), sinEase),
          t(refs.wholeRotate, -1.5, d(500), sinEase),
          t(refs.hatX, -2, d(500), sinEase),
          t(refs.hatY, -9, d(500), sinEase),
          t(refs.hatRotate, -4, d(500), sinEase),
          t(refs.bowtieRotate, 180, d(800)),
          t(refs.bowtieScale, 1.08, d(500)),
          t(refs.fxSparkleOpacity, 1, d(450)),
          t(refs.fxSparkleY, -4, d(500)),
          t(refs.fxSparkleScale, 1, d(500)),
        ]),
        Animated.parallel([
          t(refs.wholeY, 0, d(500), sinEase),
          t(refs.wholeRotate, 0, d(500), sinEase),
          t(refs.hatX, 0, d(500), sinEase),
          t(refs.hatY, 0, d(500), sinEase),
          t(refs.hatRotate, 0, d(500), sinEase),
        ]),
        Animated.parallel([
          t(refs.wholeY, -18, d(500), sinEase),
          t(refs.wholeRotate, 1.5, d(500), sinEase),
          t(refs.hatX, 2, d(500), sinEase),
          t(refs.hatY, -9, d(500), sinEase),
          t(refs.hatRotate, 5, d(500), sinEase),
          t(refs.bowtieRotate, 360, d(700)),
          t(refs.bowtieScale, 1, d(500)),
        ]),
        Animated.parallel([
          t(refs.wholeY, 0, d(500), sinEase),
          t(refs.wholeRotate, 0, d(500), sinEase),
          t(refs.hatX, 0, d(500), sinEase),
          t(refs.hatY, 0, d(500), sinEase),
          t(refs.hatRotate, 0, d(500), sinEase),
          t(refs.fxSparkleOpacity, 0, d(450)),
          t(refs.fxSparkleY, 4, d(450)),
          t(refs.bowtieRotate, 0, 0),
        ]),
      ]),
    ];
  }

  if (state === 'thinking') {
    const makeDot = (op: Animated.Value, y: Animated.Value, delayMs: number) =>
      Animated.sequence([
        Animated.delay(d(delayMs)),
        Animated.parallel([t(op, 1, d(650), sinEase), t(y, -4, d(650), sinEase)]),
        Animated.parallel([t(op, 0.25, d(650), sinEase), t(y, 3, d(650), sinEase)]),
      ]);
    return [
      Animated.sequence([
        Animated.delay(d(400)),
        Animated.parallel([
          t(refs.wholeY, -5, d(650), sinEase),
          t(refs.wholeRotate, -1.8, d(650), sinEase),
          t(refs.eyesX, 11, d(650)),
          t(refs.eyesY, -12, d(650)),
          t(refs.bowtieX, 4, d(650)),
          t(refs.bowtieY, -3, d(650)),
          t(refs.eyeLeftScaleY, 0.72, d(650)),
          t(refs.hatRotate, -3.5, d(650), sinEase),
          t(refs.hatX, -2, d(650), sinEase),
          t(refs.hatY, -3, d(650), sinEase),
        ]),
        Animated.delay(d(1500)),
        Animated.parallel([
          t(refs.wholeY, 0, d(850), sinEase),
          t(refs.wholeRotate, 0, d(850), sinEase),
          t(refs.eyesX, 0, d(850)),
          t(refs.eyesY, 0, d(850)),
          t(refs.bowtieX, 0, d(850)),
          t(refs.bowtieY, 0, d(850)),
          t(refs.eyeLeftScaleY, 1, d(850)),
          t(refs.hatRotate, 0, d(850), sinEase),
          t(refs.hatX, 0, d(850), sinEase),
          t(refs.hatY, 0, d(850), sinEase),
        ]),
      ]),
      makeDot(refs.fxDot1Opacity, refs.fxDot1Y, 0),
      makeDot(refs.fxDot2Opacity, refs.fxDot2Y, 250),
      makeDot(refs.fxDot3Opacity, refs.fxDot3Y, 500),
    ];
  }

  if (state === 'curious') {
    return [
      Animated.sequence([
        Animated.delay(d(450)),
        Animated.parallel([
          t(refs.wholeRotate, -2.2, d(500)),
          t(refs.wholeX, -4, d(500)),
          t(refs.eyesX, -18, d(500)),
          t(refs.eyesY, -2, d(500)),
          t(refs.bowtieX, -7, d(500)),
          t(refs.hatX, 5, d(500)),
          t(refs.hatRotate, -2.5, d(500)),
          t(refs.eyeLeftScaleY, 1.06, d(500)),
          t(refs.eyeRightScaleY, 0.65, d(500)),
        ]),
        Animated.delay(d(700)),
        Animated.parallel([
          t(refs.wholeRotate, 2.2, d(550)),
          t(refs.wholeX, 4, d(550)),
          t(refs.eyesX, 18, d(550)),
          t(refs.bowtieX, 7, d(550)),
          t(refs.hatX, -5, d(550)),
          t(refs.hatRotate, 2.5, d(550)),
          t(refs.eyeLeftScaleY, 0.65, d(550)),
          t(refs.eyeRightScaleY, 1.06, d(550)),
        ]),
        Animated.delay(d(700)),
        Animated.parallel([
          t(refs.wholeRotate, 0, d(500)),
          t(refs.wholeX, 0, d(500)),
          t(refs.eyesX, 0, d(500)),
          t(refs.eyesY, 0, d(500)),
          t(refs.bowtieX, 0, d(500)),
          t(refs.hatX, 0, d(500)),
          t(refs.hatRotate, 0, d(500)),
          t(refs.eyeLeftScaleY, 1, d(500)),
          t(refs.eyeRightScaleY, 1, d(500)),
        ]),
      ]),
    ];
  }

  if (state === 'surprised') {
    return [
      Animated.sequence([
        Animated.delay(d(450)),
        t(refs.wholeY, 5, d(150)),
        Animated.parallel([
          t(refs.wholeY, -14, d(260)),
          t(refs.hatX, 6, d(260)),
          t(refs.hatY, -28, d(260)),
          t(refs.hatRotate, -8, d(260)),
          t(refs.eyeLeftScale, 1.16, d(220)),
          t(refs.eyeRightScale, 1.16, d(220)),
          t(refs.bowtieScale, 1.18, d(220)),
          Animated.sequence([
            t(refs.bowtieRotate, -6, d(140)),
            t(refs.bowtieRotate, 6, d(140)),
            t(refs.bowtieRotate, 0, d(140)),
          ]),
          t(refs.fxAlertOpacity, 1, d(200)),
          t(refs.fxAlertScale, 1, d(200)),
        ]),
        Animated.delay(d(450)),
        Animated.parallel([
          t(refs.wholeY, 0, d(550)),
          t(refs.hatX, 0, d(550)),
          t(refs.hatY, 0, d(550)),
          t(refs.hatRotate, 0, d(550)),
          t(refs.eyeLeftScale, 1, d(500)),
          t(refs.eyeRightScale, 1, d(500)),
          t(refs.bowtieScale, 1, d(500)),
          t(refs.fxAlertOpacity, 0, d(350)),
        ]),
      ]),
    ];
  }

  if (state === 'sleeping') {
    const makeZ = (op: Animated.Value, x: Animated.Value, y: Animated.Value, delayMs: number) =>
      Animated.sequence([
        Animated.delay(d(delayMs)),
        Animated.parallel([t(op, 1, d(800)), t(x, 9, d(1000)), t(y, -12, d(1000))]),
        Animated.parallel([t(op, 0, d(1200)), t(x, 18, d(1200)), t(y, -28, d(1200))]),
        Animated.parallel([t(x, 0, 0), t(y, 8, 0)]),
      ]);
    return [
      Animated.sequence([
        Animated.parallel([
          t(refs.wholeY, -4, d(2000), sinEase),
          t(refs.hatX, -6, d(2000), sinEase),
          t(refs.hatY, 2, d(2000), sinEase),
          t(refs.hatRotate, -6.5, d(2000), sinEase),
          t(refs.eyesY, -2, d(2000), sinEase),
        ]),
        Animated.parallel([
          t(refs.wholeY, 3, d(2000), sinEase),
          t(refs.hatX, -8, d(2000), sinEase),
          t(refs.hatY, 6, d(2000), sinEase),
          t(refs.hatRotate, -9, d(2000), sinEase),
          t(refs.eyesY, 3, d(2000), sinEase),
        ]),
      ]),
      makeZ(refs.fxZ1Opacity, refs.fxZ1X, refs.fxZ1Y, 0),
      makeZ(refs.fxZ2Opacity, refs.fxZ2X, refs.fxZ2Y, 1000),
      makeZ(refs.fxZ3Opacity, refs.fxZ3X, refs.fxZ3Y, 2000),
    ];
  }

  if (state === 'dance') {
    const step = (wx: number, wy: number, wr: number, ex: number, ey: number, hy: number, hr: number) =>
      Animated.parallel([
        t(refs.wholeX, wx, d(450), sinEase),
        t(refs.wholeY, wy, d(450), sinEase),
        t(refs.wholeRotate, wr, d(450), sinEase),
        t(refs.eyesX, ex, d(450), sinEase),
        t(refs.eyesY, ey, d(450), sinEase),
        t(refs.hatY, hy, d(450), sinEase),
        t(refs.hatRotate, hr, d(450), sinEase),
      ]);

    return [
      Animated.sequence([
        step(0, -10, 0, 0, -3, -6, 2),
        step(7, 0, 2.5, 6, 0, 0, 3),
        step(0, -10, 0, 0, -3, -6, -2),
        step(-7, 0, -2.5, -6, 0, 0, -3),
      ]),
      Animated.sequence([
        Animated.parallel([
          t(refs.bowtieX, 3, d(450), sinEase),
          t(refs.bowtieRotate, 6, d(450), sinEase),
          t(refs.bowtieScale, 1.04, d(450), sinEase),
        ]),
        Animated.parallel([
          t(refs.bowtieX, -3, d(450), sinEase),
          t(refs.bowtieRotate, -6, d(450), sinEase),
        ]),
      ]),
      buildBlinkSequence(refs, 3600, d),
    ];
  }

  return [];
}
