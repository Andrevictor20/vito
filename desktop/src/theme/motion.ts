/**
 * Motion Tokens Canônicos do Vito Desktop
 * Curvas de animação cúbica e timings de transição para Modais, Drawers, Cards e Toggles
 */

export const motionCurves = {
  // Padrão de aceleração e desaceleração fluida
  standard: 'cubic-bezier(0.2, 0.0, 0, 1.0)',
  // Entrada suave (Modais, Drawers, Notificações)
  decelerate: 'cubic-bezier(0.05, 0.7, 0.1, 1.0)',
  // Saída rápida
  accelerate: 'cubic-bezier(0.3, 0.0, 0.8, 0.15)',
  // Curva de mola expressiva para switches, chips e botões
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  // Deslocamento lateral rápido para Drawers laterais (440px)
  drawerSlide: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const;

export const motionDurations = {
  fast: '100ms',
  normal: '150ms',
  medium: '200ms',
  slow: '250ms',
  deliberate: '350ms',
} as const;

export const motionTransitions = {
  // Transições para Drawers laterais
  drawerEnter: `200ms ${motionCurves.drawerSlide}`,
  drawerExit: `150ms ${motionCurves.accelerate}`,

  // Modais de Diálogo / Command Palette
  modalEnter: `250ms ${motionCurves.decelerate}`,
  modalExit: `180ms ${motionCurves.accelerate}`,

  // Cards & List Items (Hover & Active)
  cardHover: `150ms ${motionCurves.standard}`,
  cardActive: `100ms ${motionCurves.standard}`,

  // Switches e Toggles (.sw)
  switchThumb: `150ms ${motionCurves.spring}`,

  // Fade genérico
  fadeIn: `200ms ease-out`,
  fadeOut: `150ms ease-in`,
} as const;
