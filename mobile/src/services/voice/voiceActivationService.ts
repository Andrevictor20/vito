import { getPlatformOS } from '../../utils/platformInfo';

export type ActivationMode = 'COEXIST_WAKE_WORD' | 'REPLACE_DEFAULT_ASSISTANT' | 'DISABLED';

export interface VoiceActivationStatus {
  isDefaultAssistant: boolean;
  activeMode: ActivationMode;
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

  async setMode(mode: ActivationMode): Promise<string> {
    if (!this.isSupported()) {
      return 'UNSUPPORTED_PLATFORM';
    }
    const mod = getVitoAssistantNativeModule();
    try {
      return await mod.setActivationMode(mode);
    } catch (e: any) {
      throw new Error(e?.message || 'Erro ao alterar modo de ativação por voz');
    }
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
};
