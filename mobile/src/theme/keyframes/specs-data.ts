/** Listas, chips, checkmarks e gráficos (stops copiados de Vito-telas-atualizadas.html). */

import type { KeyframeSpec } from './shared';
import { EASE, EASE_IN, EASE_OUT, EASE_IN_OUT, LINEAR, STD, Q, PUSH_LEAVE, BACK_11, BACK_12, BACK_13, BACK_125, BACK_156 } from './shared';

export const DATA_SPECS: readonly KeyframeSpec[] = [
  // ── Listas, chips e gráficos ───────────────────────────────────────────────
  {
    name: 'dayPop',
    duration: 450,
    easing: Q,
    source: 'L5302',
    frames: [
      { at: 0, scale: 0.7 },
      { at: 0.6, scale: 1.12 },
      { at: 1, scale: 1 },
    ],
  },
  {
    name: 'chipPop',
    duration: 340,
    easing: Q,
    source: 'L5304',
    frames: [
      { at: 0, scale: 0.92 },
      { at: 0.6, scale: 1.04 },
      { at: 1, scale: 1 },
    ],
  },
  {
    name: 'chkPop',
    duration: 400,
    easing: Q,
    source: 'L5180',
    frames: [
      { at: 0, scale: 1 },
      { at: 0.4, scale: 1.25 },
      { at: 1, scale: 1 },
    ],
  },
  {
    name: 'finBarRise',
    duration: 560,
    easing: Q,
    source: 'L1219',
    frames: [
      { at: 0, scaleY: 0, opacity: 0.35 },
      { at: 1, scaleY: 1, opacity: 1 },
    ],
  },
  {
    name: 'finSegGrow',
    duration: 580,
    easing: Q,
    source: 'L1226',
    frames: [
      { at: 0, scaleX: 0 },
      { at: 1, scaleX: 1 },
    ],
  },
  {
    name: 'finFadeUp',
    duration: 450,
    easing: EASE_OUT,
    source: 'L1221',
    frames: [
      { at: 0, opacity: 0, translateY: 4 },
      { at: 1, opacity: 1, translateY: 0 },
    ],
  },
  {
    name: 'finDotPop',
    duration: 360,
    easing: BACK_156,
    source: 'L1224',
    frames: [
      { at: 0, scale: 0, opacity: 0 },
      { at: 1, scale: 1, opacity: 1 },
    ],
  },
  {
    name: 'finLineDraw',
    duration: 780,
    delay: 60,
    easing: Q,
    source: 'L1222',
    frames: [
      { at: 0, strokeDashoffset: 600 },
      { at: 1, strokeDashoffset: 0 },
    ],
  },
  {
    name: 'rsUp',
    duration: 550,
    easing: Q,
    source: 'L4965',
    frames: [
      { at: 0, opacity: 0, translateY: 16 },
      { at: 1, opacity: 1, translateY: 0 },
    ],
  },
  {
    name: 'rsX',
    duration: 900,
    easing: Q,
    source: 'L4974',
    frames: [
      { at: 0, scaleX: 0 },
      { at: 1, scaleX: 1 },
    ],
  },
  {
    name: 'rsGrow',
    duration: 900,
    easing: Q,
    source: 'L4978',
    frames: [
      { at: 0, scaleY: 0 },
      { at: 1, scaleY: 1 },
    ],
  },
  {
    name: 'rsFade',
    duration: 500,
    easing: EASE,
    source: 'L4979',
    frames: [
      { at: 0, opacity: 0 },
      { at: 1, opacity: 1 },
    ],
  },
  {
    name: 'rsPop',
    duration: 500,
    easing: Q,
    source: 'L4984',
    frames: [
      { at: 0, scale: 0 },
      { at: 1, scale: 1 },
    ],
  },
  {
    name: 'rsRg',
    duration: 1300,
    delay: 100,
    easing: Q,
    source: 'L4972',
    frames: [
      { at: 0, strokeDashoffset: 100 },
      { at: 1, strokeDashoffset: 0 },
    ],
  },
];
