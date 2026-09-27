// audioRecorder.ts - Gerenciador resiliente de gravação de áudio para Expo Go
let AudioModule: any = null;

try {
  AudioModule = require('expo-audio');
} catch (e) {
  console.warn('⚠️ Módulo de áudio nativo não disponível neste runtime Expo:', e);
}

export interface AudioRecordingResult {
  uri: string;
}

export class SafeAudioRecorder {
  private static isAvailable(): boolean {
    return AudioModule !== null;
  }

  static async requestPermissions(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      if (AudioModule.requestRecordingPermissionsAsync) {
        const res = await AudioModule.requestRecordingPermissionsAsync();
        return res.granted;
      }
      return true;
    } catch {
      return false;
    }
  }

  static isAudioSupported(): boolean {
    return this.isAvailable();
  }
}
