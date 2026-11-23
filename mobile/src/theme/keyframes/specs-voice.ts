/** Voz, cards, overlays, logomarca e utilitários (stops copiados de Vito-telas-atualizadas.html). */

import type { KeyframeSpec } from './shared';
import { EASE, EASE_IN, EASE_OUT, EASE_IN_OUT, LINEAR, STD, Q, PUSH_LEAVE, BACK_11, BACK_12, BACK_13, BACK_125, BACK_156 } from './shared';

export const VOICE_SPECS: readonly KeyframeSpec[] = [
  // ── Voz, cards e overlays ──────────────────────────────────────────────────
  {
    name: 'vfade',
    duration: 300,
    easing: EASE,
    source: 'L577',
    frames: [
      { at: 0, opacity: 0, translateY: 14 },
      { at: 1, opacity: 1, translateY: 0 },
    ],
  },
  {
    name: 'vcard',
    duration: 500,
    easing: BACK_11,
    source: 'L643',
    frames: [
      { at: 0, opacity: 0, translateY: 24, scale: 0.96 },
      { at: 1, opacity: 1, translateY: 0, scale: 1 },
    ],
  },
  {
    name: 'vcap',
    duration: 350,
    easing: EASE,
    source: 'L607',
    frames: [
      { at: 0, opacity: 0, translateY: 8 },
      { at: 1, opacity: 1, translateY: 0 },
    ],
  },
  {
    name: 'orbin',
    duration: 700,
    easing: BACK_125,
    source: 'L629',
    frames: [
      { at: 0, scale: 0.3, opacity: 0 },
      { at: 1, scale: 1, opacity: 1 },
    ],
  },
  {
    name: 'vbob',
    duration: 1100,
    easing: EASE_IN_OUT,
    iterations: 'infinite',
    source: 'L595',
    frames: [
      { at: 0, scale: 1 },
      { at: 0.5, scale: 1.04 },
      { at: 1, scale: 1 },
    ],
  },
  {
    name: 'vring',
    duration: 2400,
    easing: EASE_OUT,
    iterations: 'infinite',
    source: 'L590',
    frames: [
      { at: 0, scale: 0.9, opacity: 0.55 },
      { at: 1, scale: 1.7, opacity: 0 },
    ],
  },
  {
    name: 'vpulse',
    duration: 1400,
    easing: EASE_IN_OUT,
    iterations: 'infinite',
    source: 'L574',
    frames: [
      { at: 0, opacity: 1 },
      { at: 0.5, opacity: 0.35 },
      { at: 1, opacity: 1 },
    ],
  },
  {
    name: 'vspin',
    duration: 9000,
    easing: LINEAR,
    iterations: 'infinite',
    source: 'L584',
    frames: [
      { at: 0, rotate: 0 },
      { at: 1, rotate: 360 },
    ],
  },
  {
    name: 'vspinf',
    duration: 1000,
    easing: LINEAR,
    iterations: 'infinite',
    source: 'L598',
    frames: [
      { at: 0, scaleX: 1 },
      { at: 0.25, scaleX: 0 },
      { at: 0.5, scaleX: -1 },
      { at: 0.75, scaleX: 0 },
      { at: 1, scaleX: 1 },
    ],
  },
  {
    name: 'bspin',
    duration: 800,
    easing: LINEAR,
    iterations: 'infinite',
    source: 'L674',
    frames: [
      { at: 0, rotate: 0 },
      { at: 1, rotate: 360 },
    ],
  },
  {
    name: 'fabin',
    duration: 500,
    easing: BACK_13,
    source: 'L646',
    frames: [
      { at: 0, scale: 0.3, opacity: 0 },
      { at: 1, scale: 1, opacity: 1 },
    ],
  },
  {
    name: 'pillin',
    duration: 400,
    easing: BACK_12,
    source: 'L648',
    frames: [
      { at: 0, translateXPercent: -50, translateY: -30, opacity: 0 },
      { at: 1, translateXPercent: -50, translateY: 0, opacity: 1 },
    ],
  },
  {
    name: 'eqt',
    duration: 1200,
    easing: EASE_IN_OUT,
    iterations: 'infinite',
    source: 'L639',
    frames: [
      { at: 0, scaleY: 0.2 },
      { at: 0.4, scaleY: 0.55 },
      { at: 0.7, scaleY: 0.3 },
      { at: 1, scaleY: 0.2 },
    ],
  },

  // ── Logomarca (olhar, piscar, laço) ────────────────────────────────────────
  {
    name: 'look',
    duration: 7000,
    easing: EASE_IN_OUT,
    iterations: 'infinite',
    source: 'L299',
    frames: [
      { at: 0, translateX: 0 },
      { at: 0.14, translateX: 0 },
      { at: 0.22, translateX: -20 },
      { at: 0.4, translateX: -20 },
      { at: 0.5, translateX: 0 },
      { at: 0.56, translateX: 0 },
      { at: 0.64, translateX: 20 },
      { at: 0.82, translateX: 20 },
      { at: 0.92, translateX: 0 },
      { at: 1, translateX: 0 },
    ],
  },
  {
    name: 'blink',
    duration: 4600,
    easing: LINEAR,
    iterations: 'infinite',
    source: 'L301',
    frames: [
      { at: 0, scaleY: 1 },
      { at: 0.38, scaleY: 1 },
      { at: 0.41, scaleY: 0.08 },
      { at: 0.44, scaleY: 1 },
      { at: 0.84, scaleY: 1 },
      { at: 0.86, scaleY: 0.08 },
      { at: 0.88, scaleY: 1 },
      { at: 0.9, scaleY: 0.08 },
      { at: 0.92, scaleY: 1 },
      { at: 1, scaleY: 1 },
    ],
  },
  {
    name: 'spin',
    duration: 5500,
    easing: LINEAR,
    iterations: 'infinite',
    source: 'L302',
    frames: [
      { at: 0, scaleX: 1 },
      { at: 0.58, scaleX: 1 },
      { at: 0.62, scaleX: 0.7 },
      { at: 0.66, scaleX: 0 },
      { at: 0.7, scaleX: -0.7 },
      { at: 0.74, scaleX: -1 },
      { at: 0.78, scaleX: -0.7 },
      { at: 0.82, scaleX: 0 },
      { at: 0.86, scaleX: 0.7 },
      { at: 0.9, scaleX: 1 },
      { at: 1, scaleX: 1 },
    ],
  },

  // ── Utilitários ────────────────────────────────────────────────────────────
  {
    name: 'dot',
    duration: 1000,
    easing: EASE_IN_OUT,
    iterations: 'infinite',
    source: 'L1390',
    frames: [
      { at: 0, opacity: 0.3, translateY: 0 },
      { at: 0.3, opacity: 1, translateY: -3 },
      { at: 0.6, opacity: 0.3, translateY: 0 },
      { at: 1, opacity: 0.3, translateY: 0 },
    ],
  },
  {
    name: 'cur',
    duration: 800,
    easing: LINEAR,
    iterations: 'infinite',
    source: 'L1383',
    frames: [
      { at: 0, opacity: 1 },
      { at: 0.5, opacity: 0 },
      { at: 1, opacity: 1 },
    ],
  },
  {
    name: 'rdf',
    duration: 3200,
    easing: EASE_IN_OUT,
    iterations: 'infinite',
    source: 'L781',
    frames: [
      { at: 0, translateY: 0 },
      { at: 0.5, translateY: -4 },
      { at: 1, translateY: 0 },
    ],
  },
];
