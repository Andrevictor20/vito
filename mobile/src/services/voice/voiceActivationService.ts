import { getPlatformOS } from '../../utils/platformInfo';

export interface VoiceActivationStatus {
  isDefaultAssistant: boolean;
}

function getVitoAssistantNativeModule(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const RN = require('react-native');
    return RN?.NativeModules?.VitoAssistantModule;
  } catch {
    return (global as any)?.NativeModules?.VitoAssistantModule;
  }
}

export const voiceActivationService = {
  isSupported(): boolean {
    const os = getPlatformOS();
    const mod = getVitoAssistantNativeModule();
    return os === 'android' && !!mod;
  },

  async isVitoDefaultAssistant(): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }
    const mod = getVitoAssistantNativeModule();
    try {
      return await mod.isVitoDefaultAssistant();
    } catch {
      return false;
    }
  },

  async requestDefaultAssistantRole(): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }
    const mod = getVitoAssistantNativeModule();
    try {
      return await mod.requestDefaultAssistantRole();
    } catch {
      return false;
    }
  },

  async openAssistantSettings(): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }
    const mod = getVitoAssistantNativeModule();
    try {
      return await mod.openAssistantSettings();
    } catch {
      return false;
    }
  },
};
