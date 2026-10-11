import { Platform } from 'react-native';

let Haptics: any = null;
try {
  Haptics = require('expo-haptics');
} catch {}

/**
 * motion.ts — Sistema de Física de Molas & Hápticos Calibrados
 * Proporciona resposta tátil imediata e transições visuais fluidas sem atrito.
 */

export const springs = {
  // Pílula flutuante e docas de navegação (resposta rápida e firme)
  dockPill: {
    damping: 18,
    stiffness: 220,
    mass: 0.8,
  },
  // Toque em cards e botões interativos (curta, satisfatória)
  cardPress: {
    damping: 15,
    stiffness: 300,
    mass: 0.6,
  },
  // Bottom sheets e gavetas expansíveis
  sheet: {
    damping: 24,
    stiffness: 260,
    mass: 1.0,
  },
  // Micro-interações sutis (switches, toggles)
  subtle: {
    damping: 20,
    stiffness: 180,
    mass: 1.0,
  },
};

export const hapticFeedback = {
  light: async () => {
    if (Platform.OS === 'web' || !Haptics) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  },
  medium: async () => {
    if (Platform.OS === 'web' || !Haptics) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
  },
  selection: async () => {
    if (Platform.OS === 'web' || !Haptics) return;
    try {
      await Haptics.selectionAsync();
    } catch {}
  },
  success: async () => {
    if (Platform.OS === 'web' || !Haptics) return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  },
};
