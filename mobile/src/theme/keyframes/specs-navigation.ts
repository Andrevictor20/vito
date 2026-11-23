/** Navegação, entrada de tela, splash e onboarding (stops copiados de Vito-telas-atualizadas.html). */

import type { KeyframeSpec } from './shared';
import { EASE, EASE_IN, EASE_OUT, EASE_IN_OUT, LINEAR, STD, Q, PUSH_LEAVE, BACK_11, BACK_12, BACK_13, BACK_125, BACK_156 } from './shared';

export const NAVIGATION_SPECS: readonly KeyframeSpec[] = [
  // ── Navegação e entrada de tela ────────────────────────────────────────────
  {
    name: 'scrIn',
    duration: 340,
    easing: STD,
    source: 'L1068',
    frames: [
      { at: 0, opacity: 0, translateY: 10 },
      { at: 1, opacity: 1, translateY: 0 },
    ],
  },
  {
    name: 'trTab',
    duration: 360,
    delay: 50,
    easing: Q,
    source: 'L1086',
    frames: [
      { at: 0, opacity: 0, translateY: 6 },
      { at: 1, opacity: 1, translateY: 0 },
    ],
  },
  {
    name: 'trPush',
    duration: 440,
    easing: Q,
    source: 'L1087',
    frames: [
      { at: 0, opacity: 0, translateX: 30 },
      { at: 1, opacity: 1, translateX: 0 },
    ],
  },
  {
    name: 'trPop',
    duration: 400,
    easing: Q,
    source: 'L1088',
    frames: [
      { at: 0, opacity: 0, translateX: -22 },
      { at: 1, opacity: 1, translateX: 0 },
    ],
  },
  {
    name: 'lvTab',
    duration: 170,
    easing: EASE_IN,
    source: 'L1097',
    frames: [
      { at: 0, opacity: 1 },
      { at: 1, opacity: 0 },
    ],
  },
  {
    name: 'lvPush',
    duration: 300,
    easing: PUSH_LEAVE,
    source: 'L1098',
    frames: [
      { at: 0, opacity: 1, translateX: 0 },
      { at: 1, opacity: 0, translateX: -24 },
    ],
  },
  {
    name: 'lvPop',
    duration: 300,
    easing: PUSH_LEAVE,
    source: 'L1099',
    frames: [
      { at: 0, opacity: 1, translateX: 0 },
      { at: 1, opacity: 0, translateX: 30 },
    ],
  },
  {
    name: 'rise',
    duration: 350,
    easing: EASE,
    source: 'L78',
    frames: [
      { at: 0, opacity: 0, translateY: 8 },
      { at: 1, opacity: 1, translateY: 0 },
    ],
  },
  {
    name: 'popIn',
    duration: 300,
    easing: Q,
    source: 'L1746',
    frames: [
      { at: 0, opacity: 0, scale: 0.6 },
      { at: 1, opacity: 1, scale: 1 },
    ],
  },
  {
    name: 'heroIn',
    duration: 620,
    easing: Q,
    source: 'L1735',
    frames: [
      { at: 0, opacity: 0, translateY: 10 },
      { at: 1, opacity: 1, translateY: 0 },
    ],
  },
  {
    name: 'convIn',
    duration: 300,
    easing: STD,
    source: 'L1740',
    frames: [
      { at: 0, opacity: 0 },
      { at: 1, opacity: 1 },
    ],
  },

  // ── Splash ─────────────────────────────────────────────────────────────────
  {
    name: 'splPop',
    duration: 700,
    easing: Q,
    source: 'L5224',
    frames: [
      { at: 0, opacity: 0, translateY: 16, scale: 0.7 },
      { at: 1, opacity: 1, translateY: 0, scale: 1 },
    ],
  },
  {
    name: 'splIn',
    duration: 800,
    easing: Q,
    source: 'L5313',
    frames: [
      { at: 0, opacity: 0, scale: 0.88 },
      { at: 1, opacity: 1, scale: 1 },
    ],
  },
  {
    name: 'splBar',
    duration: 900,
    easing: STD,
    iterations: 'infinite',
    source: 'L5314',
    frames: [
      { at: 0, translateXPercent: -100 },
      { at: 1, translateXPercent: 200 },
    ],
  },
  {
    name: 'splOut',
    duration: 550,
    easing: EASE_IN,
    source: 'L5315',
    frames: [
      { at: 0, opacity: 1, scale: 1 },
      { at: 1, opacity: 0, scale: 1.05 },
    ],
  },

  // ── Onboarding ─────────────────────────────────────────────────────────────
  {
    name: 'obUp',
    duration: 600,
    easing: Q,
    source: 'L5250',
    frames: [
      { at: 0, opacity: 0, translateY: 14 },
      { at: 1, opacity: 1, translateY: 0 },
    ],
  },
  {
    name: 'obIn',
    duration: 600,
    easing: Q,
    source: 'L5251',
    frames: [
      { at: 0, opacity: 0, translateX: 26, scale: 0.96 },
      { at: 1, opacity: 1, translateX: 0, scale: 1 },
    ],
  },
  {
    name: 'obFade',
    duration: 600,
    easing: EASE,
    source: 'L5252',
    frames: [
      { at: 0, opacity: 0 },
      { at: 1, opacity: 1 },
    ],
  },
  {
    name: 'obFloat',
    duration: 4000,
    easing: EASE_IN_OUT,
    iterations: 'infinite',
    source: 'L5253',
    frames: [
      { at: 0, translateY: 0 },
      { at: 0.5, translateY: -10 },
      { at: 1, translateY: 0 },
    ],
  },
  {
    name: 'obBar',
    duration: 700,
    easing: Q,
    source: 'L5279',
    frames: [
      { at: 0, scaleY: 0 },
      { at: 1, scaleY: 1 },
    ],
  },
  {
    name: 'obPulse',
    duration: 1800,
    easing: EASE_IN_OUT,
    iterations: 'infinite',
    source: 'L5288',
    frames: [
      { at: 0, scale: 1, opacity: 1 },
      { at: 0.5, scale: 1.4, opacity: 0.55 },
      { at: 1, scale: 1, opacity: 1 },
    ],
  },
];
