import {
  Easing,
  type EasingFunction,
  type EasingFunctionFactory,
  type SharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { MASCOT_TRACKS, type ProtoMascotState } from '../../../mascot/mascotSpecs';
import { MascotAnimationState } from './mascotPalettes';

function getProtoDuration(state: ProtoMascotState, part: string, fallbackMs: number): number {
  const track = MASCOT_TRACKS[state]?.find((tr) => tr.part === part);
  return track && track.durationMs > 0 ? track.durationMs : fallbackMs;
}

export interface MascotAnimValues {
  wholeX: SharedValue<number>;
  wholeY: SharedValue<number>;
  wholeRotate: SharedValue<number>;
  hatX: SharedValue<number>;
  hatY: SharedValue<number>;
  hatRotate: SharedValue<number>;
  eyesX: SharedValue<number>;
  eyesY: SharedValue<number>;
  eyeLeftScaleY: SharedValue<number>;
  eyeRightScaleY: SharedValue<number>;
  eyeLeftScale: SharedValue<number>;
  eyeRightScale: SharedValue<number>;
  bowtieX: SharedValue<number>;
  bowtieY: SharedValue<number>;
  bowtieRotate: SharedValue<number>;
  bowtieScale: SharedValue<number>;
  fxSparkleOpacity: SharedValue<number>;
  fxSparkleY: SharedValue<number>;
  fxSparkleScale: SharedValue<number>;
  fxAlertOpacity: SharedValue<number>;
  fxAlertScale: SharedValue<number>;
  fxDot1Opacity: SharedValue<number>;
  fxDot2Opacity: SharedValue<number>;
  fxDot3Opacity: SharedValue<number>;
  fxDot1Y: SharedValue<number>;
  fxDot2Y: SharedValue<number>;
  fxDot3Y: SharedValue<number>;
  fxZ1Opacity: SharedValue<number>;
  fxZ2Opacity: SharedValue<number>;
  fxZ3Opacity: SharedValue<number>;
  fxZ1X: SharedValue<number>;
  fxZ2X: SharedValue<number>;
  fxZ3X: SharedValue<number>;
  fxZ1Y: SharedValue<number>;
  fxZ2Y: SharedValue<number>;
  fxZ3Y: SharedValue<number>;
}

type MascotEasing = EasingFunction | EasingFunctionFactory;

const sinEase: MascotEasing = Easing.inOut(Easing.sin);
const blinkEase: MascotEasing = Easing.inOut(Easing.quad);
const stdEase: MascotEasing = Easing.bezier(0.4, 0, 0.2, 1);
const tipEase: MascotEasing = Easing.bezier(0.34, 1.45, 0.64, 1);

const tm = (toValue: number, duration: number, easing: MascotEasing = stdEase) =>
  withTiming(toValue, { duration: Math.max(0, Math.round(duration)), easing });

const loop = (anim: number) => withRepeat(anim, -1, false);

function startBlinkLoop(
  v: MascotAnimValues,
  periodMs: number,
  d: (ms: number) => number
): void {
  const buildEye = () =>
    loop(
      withSequence(
        withDelay(d(periodMs * 0.44), tm(0.06, d(115), blinkEase)),
        tm(1, d(135), blinkEase),
        withDelay(d(periodMs * 0.25), tm(0.06, d(115), blinkEase)),
        tm(1, d(135), blinkEase),
        withDelay(d(periodMs * 0.16), tm(1, 0, blinkEase))
      )
    );
  v.eyeLeftScaleY.value = buildEye();
  v.eyeRightScaleY.value = buildEye();
}

function startTrack(
  sv: SharedValue<number>,
  steps: Array<[number, number, MascotEasing?, number?]>
): void {
  const anims = steps.map(([to, dur, ease, delay]) => {
    const base = tm(to, dur, ease ?? stdEase);
    return delay && delay > 0 ? withDelay(delay, base) : base;
  });
  sv.value = loop(anims.length === 1 ? anims[0] : withSequence(...anims));
}

/** Inicia todas as trilhas de estado 100% na UI thread (Reanimated 4). */
export function startStateAnimations(
  state: MascotAnimationState,
  v: MascotAnimValues,
  speed: number
): void {
  const d = (ms: number) => Math.max(0, Math.round(ms / Math.max(0.25, speed)));

  if (state === 'blink' || state === 'interactive') {
    const blinkPeriod = getProtoDuration('blink', 'eye-l', 3600);
    startBlinkLoop(v, state === 'blink' ? blinkPeriod : 4200, d);
    return;
  }

  if (state === 'idle') {
    const half = Math.round(getProtoDuration('idle', 'whole', 3200) / 2);
    startTrack(v.wholeY, [[-9, d(half), sinEase], [0, d(half), sinEase]]);
    startTrack(v.hatX, [[1, d(half + 100), sinEase], [0, d(half - 100), sinEase]]);
    startTrack(v.hatY, [[-3.5, d(half + 100), sinEase], [0, d(half - 100), sinEase]]);
    startTrack(v.hatRotate, [[1.6, d(half + 100), sinEase], [0, d(half - 100), sinEase]]);
    startTrack(v.eyesY, [[-2, d(half), sinEase], [0, d(half), sinEase]]);
    startTrack(v.bowtieY, [[-1.5, d(half + 50), sinEase], [0, d(half - 50), sinEase]]);
    startTrack(v.bowtieScale, [[1.025, d(half + 50), sinEase], [1, d(half - 50), sinEase]]);
    startBlinkLoop(v, 4200, d);
    return;
  }

  if (state === 'gentleman') {
    const startDelay = d(540);
    const hold = d(600);
    const tail = d(500);
    startTrack(v.wholeY, [[4, d(540), stdEase, startDelay], [0, d(660), stdEase, hold], [0, tail]]);
    startTrack(v.wholeRotate, [[2.5, d(540), stdEase, startDelay], [0, d(660), stdEase, hold], [0, tail]]);
    startTrack(v.eyesX, [[3, d(540), stdEase, startDelay], [0, d(660), stdEase, hold], [0, tail]]);
    startTrack(v.eyesY, [[4, d(540), stdEase, startDelay], [0, d(660), stdEase, hold], [0, tail]]);
    startTrack(v.hatX, [[16, d(600), tipEase, startDelay], [0, d(660), stdEase, hold], [0, tail]]);
    startTrack(v.hatY, [[-25, d(600), tipEase, startDelay], [0, d(660), stdEase, hold], [0, tail]]);
    startTrack(v.hatRotate, [[21, d(600), tipEase, startDelay], [0, d(660), stdEase, hold], [0, tail]]);
    startTrack(v.eyeRightScaleY, [
      [0.08, d(240), stdEase, startDelay],
      [1, d(240), stdEase, d(900)],
      [1, d(920)],
    ]);
    startTrack(v.bowtieRotate, [
      [-7, d(240), stdEase, startDelay],
      [7, d(240)],
      [-4, d(240)],
      [0, d(240)],
      [0, d(1160)],
    ]);
    return;
  }

  if (state === 'happy') {
    startTrack(v.wholeY, [[-18, d(500), sinEase], [0, d(500), sinEase], [-18, d(500), sinEase], [0, d(500), sinEase]]);
    startTrack(v.wholeRotate, [[-1.5, d(500), sinEase], [0, d(500), sinEase], [1.5, d(500), sinEase], [0, d(500), sinEase]]);
    startTrack(v.hatX, [[-2, d(500), sinEase], [0, d(500), sinEase], [2, d(500), sinEase], [0, d(500), sinEase]]);
    startTrack(v.hatY, [[-9, d(500), sinEase], [0, d(500), sinEase], [-9, d(500), sinEase], [0, d(500), sinEase]]);
    startTrack(v.hatRotate, [[-4, d(500), sinEase], [0, d(500), sinEase], [5, d(500), sinEase], [0, d(500), sinEase]]);
    startTrack(v.bowtieRotate, [[180, d(800)], [360, d(700), stdEase, d(200)], [0, 0, stdEase, d(300)]]);
    startTrack(v.bowtieScale, [[1.08, d(500)], [1, d(500), stdEase, d(500)], [1, d(500)]]);
    startTrack(v.fxSparkleOpacity, [[1, d(450)], [0, d(450), stdEase, d(1100)]]);
    startTrack(v.fxSparkleY, [[-4, d(500)], [4, d(450), stdEase, d(1050)]]);
    startTrack(v.fxSparkleScale, [[1, d(500)], [0.85, d(500), stdEase, d(1000)]]);
    return;
  }

  if (state === 'thinking') {
    const startDelay = d(400);
    const hold = d(1500);
    startTrack(v.wholeY, [[-5, d(650), sinEase, startDelay], [0, d(850), sinEase, hold]]);
    startTrack(v.wholeRotate, [[-1.8, d(650), sinEase, startDelay], [0, d(850), sinEase, hold]]);
    startTrack(v.eyesX, [[11, d(650), stdEase, startDelay], [0, d(850), stdEase, hold]]);
    startTrack(v.eyesY, [[-12, d(650), stdEase, startDelay], [0, d(850), stdEase, hold]]);
    startTrack(v.bowtieX, [[4, d(650), stdEase, startDelay], [0, d(850), stdEase, hold]]);
    startTrack(v.bowtieY, [[-3, d(650), stdEase, startDelay], [0, d(850), stdEase, hold]]);
    startTrack(v.eyeLeftScaleY, [[0.72, d(650), stdEase, startDelay], [1, d(850), stdEase, hold]]);
    startTrack(v.hatRotate, [[-3.5, d(650), sinEase, startDelay], [0, d(850), sinEase, hold]]);
    startTrack(v.hatX, [[-2, d(650), sinEase, startDelay], [0, d(850), sinEase, hold]]);
    startTrack(v.hatY, [[-3, d(650), sinEase, startDelay], [0, d(850), sinEase, hold]]);

    const startDot = (op: SharedValue<number>, y: SharedValue<number>, delayMs: number) => {
      startTrack(op, [[1, d(650), sinEase, d(delayMs)], [0.25, d(650), sinEase]]);
      startTrack(y, [[-4, d(650), sinEase, d(delayMs)], [3, d(650), sinEase]]);
    };
    startDot(v.fxDot1Opacity, v.fxDot1Y, 0);
    startDot(v.fxDot2Opacity, v.fxDot2Y, 250);
    startDot(v.fxDot3Opacity, v.fxDot3Y, 500);
    return;
  }

  if (state === 'curious') {
    const startDelay = d(450);
    const hold = d(700);
    startTrack(v.wholeRotate, [[-2.2, d(500), stdEase, startDelay], [2.2, d(550), stdEase, hold], [0, d(500), stdEase, hold]]);
    startTrack(v.wholeX, [[-4, d(500), stdEase, startDelay], [4, d(550), stdEase, hold], [0, d(500), stdEase, hold]]);
    startTrack(v.eyesX, [[-18, d(500), stdEase, startDelay], [18, d(550), stdEase, hold], [0, d(500), stdEase, hold]]);
    startTrack(v.eyesY, [[-2, d(500), stdEase, startDelay], [-2, d(550), stdEase, hold], [0, d(500), stdEase, hold]]);
    startTrack(v.bowtieX, [[-7, d(500), stdEase, startDelay], [7, d(550), stdEase, hold], [0, d(500), stdEase, hold]]);
    startTrack(v.hatX, [[5, d(500), stdEase, startDelay], [-5, d(550), stdEase, hold], [0, d(500), stdEase, hold]]);
    startTrack(v.hatRotate, [[-2.5, d(500), stdEase, startDelay], [2.5, d(550), stdEase, hold], [0, d(500), stdEase, hold]]);
    startTrack(v.eyeLeftScaleY, [[1.06, d(500), stdEase, startDelay], [0.65, d(550), stdEase, hold], [1, d(500), stdEase, hold]]);
    startTrack(v.eyeRightScaleY, [[0.65, d(500), stdEase, startDelay], [1.06, d(550), stdEase, hold], [1, d(500), stdEase, hold]]);
    return;
  }

  if (state === 'surprised') {
    const pre = d(600);
    const hold = d(450);
    startTrack(v.wholeY, [[5, d(150), stdEase, d(450)], [-14, d(260)], [0, d(550), stdEase, hold]]);
    startTrack(v.hatX, [[6, d(260), stdEase, pre], [0, d(550), stdEase, hold]]);
    startTrack(v.hatY, [[-28, d(260), stdEase, pre], [0, d(550), stdEase, hold]]);
    startTrack(v.hatRotate, [[-8, d(260), stdEase, pre], [0, d(550), stdEase, hold]]);
    startTrack(v.eyeLeftScale, [[1.16, d(220), stdEase, pre], [1, d(500), stdEase, hold + d(40)]]);
    startTrack(v.eyeRightScale, [[1.16, d(220), stdEase, pre], [1, d(500), stdEase, hold + d(40)]]);
    startTrack(v.bowtieScale, [[1.18, d(220), stdEase, pre], [1, d(500), stdEase, hold + d(40)]]);
    startTrack(v.bowtieRotate, [[-6, d(140), stdEase, pre], [6, d(140)], [0, d(140)], [0, d(840)]]);
    startTrack(v.fxAlertOpacity, [[1, d(200), stdEase, pre], [0, d(350), stdEase, hold + d(60)]]);
    startTrack(v.fxAlertScale, [[1, d(200), stdEase, pre], [0.8, d(350), stdEase, hold + d(60)]]);
    return;
  }

  if (state === 'sleeping') {
    startTrack(v.wholeY, [[-4, d(2000), sinEase], [3, d(2000), sinEase]]);
    startTrack(v.hatX, [[-6, d(2000), sinEase], [-8, d(2000), sinEase]]);
    startTrack(v.hatY, [[2, d(2000), sinEase], [6, d(2000), sinEase]]);
    startTrack(v.hatRotate, [[-6.5, d(2000), sinEase], [-9, d(2000), sinEase]]);
    startTrack(v.eyesY, [[-2, d(2000), sinEase], [3, d(2000), sinEase]]);

    const startZ = (op: SharedValue<number>, x: SharedValue<number>, y: SharedValue<number>, delayMs: number) => {
      startTrack(op, [[1, d(800), stdEase, d(delayMs)], [0, d(1200)]]);
      startTrack(x, [[9, d(1000), stdEase, d(delayMs)], [18, d(1200)], [0, 0]]);
      startTrack(y, [[-12, d(1000), stdEase, d(delayMs)], [-28, d(1200)], [8, 0]]);
    };
    startZ(v.fxZ1Opacity, v.fxZ1X, v.fxZ1Y, 0);
    startZ(v.fxZ2Opacity, v.fxZ2X, v.fxZ2Y, 1000);
    startZ(v.fxZ3Opacity, v.fxZ3X, v.fxZ3Y, 2000);
    return;
  }

  if (state === 'dance') {
    const dur = d(450);
    startTrack(v.wholeX, [[0, dur, sinEase], [7, dur, sinEase], [0, dur, sinEase], [-7, dur, sinEase]]);
    startTrack(v.wholeY, [[-10, dur, sinEase], [0, dur, sinEase], [-10, dur, sinEase], [0, dur, sinEase]]);
    startTrack(v.wholeRotate, [[0, dur, sinEase], [2.5, dur, sinEase], [0, dur, sinEase], [-2.5, dur, sinEase]]);
    startTrack(v.eyesX, [[0, dur, sinEase], [6, dur, sinEase], [0, dur, sinEase], [-6, dur, sinEase]]);
    startTrack(v.eyesY, [[-3, dur, sinEase], [0, dur, sinEase], [-3, dur, sinEase], [0, dur, sinEase]]);
    startTrack(v.hatY, [[-6, dur, sinEase], [0, dur, sinEase], [-6, dur, sinEase], [0, dur, sinEase]]);
    startTrack(v.hatRotate, [[2, dur, sinEase], [3, dur, sinEase], [-2, dur, sinEase], [-3, dur, sinEase]]);
    startTrack(v.bowtieX, [[3, dur, sinEase], [-3, dur, sinEase]]);
    startTrack(v.bowtieRotate, [[6, dur, sinEase], [-6, dur, sinEase]]);
    startTrack(v.bowtieScale, [[1.04, dur, sinEase], [1, dur, sinEase]]);
    startBlinkLoop(v, 3600, d);
  }
}
