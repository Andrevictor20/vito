// audioRecorder.ts — Gravação de áudio resiliente para Expo Go + builds nativas
let AudioModule: any = null;

try {
  AudioModule = require('expo-audio');
} catch (e) {
  console.warn('⚠️ [Audio] expo-audio não disponível neste runtime:', e);
}

export interface AudioRecordingResult {
  uri: string;
  durationMs: number;
}

export class SafeAudioRecorder {
  private static recorderInstance: any = null;

  static isAudioSupported(): boolean {
    return AudioModule !== null;
  }

  static async requestPermissions(): Promise<boolean> {
    if (!AudioModule) return false;
    try {
      const fn =
        AudioModule.requestRecordingPermissionsAsync ||
        AudioModule.Audio?.requestPermissionsAsync;
      if (fn) {
        const res = await fn();
        return res.granted ?? res.status === 'granted';
      }
      return true;
    } catch {
      return false;
    }
  }

  static async startRecording(): Promise<boolean> {
    if (!AudioModule) return false;
    try {
      // Ativa modo de áudio para gravação
      if (AudioModule.setAudioModeAsync) {
        await AudioModule.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
      }

      // Cria e inicia o Recording com qualidade M4A (compatível com backend)
      const Recording =
        AudioModule.Recording ||
        AudioModule.Audio?.Recording;

      if (!Recording) return false;

      const preset =
        AudioModule.RecordingOptionsPresets?.HIGH_QUALITY ||
        AudioModule.Audio?.RecordingOptionsPresets?.HIGH_QUALITY ||
        {
          android: {
            extension: '.m4a',
            outputFormat: 2, // MPEG_4
            audioEncoder: 3, // AAC
            sampleRate: 44100,
            numberOfChannels: 2,
            bitRate: 128000,
          },
          ios: {
            extension: '.m4a',
            audioQuality: 127, // MAX
            sampleRate: 44100,
            numberOfChannels: 2,
            bitRate: 128000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
          web: {},
        };

      const { recording } = await Recording.createAsync(preset);
      this.recorderInstance = recording;
      return true;
    } catch (e) {
      console.warn('⚠️ [Audio] Falha ao iniciar gravação:', e);
      return false;
    }
  }

  static async stopRecording(): Promise<AudioRecordingResult | null> {
    if (!this.recorderInstance) return null;
    try {
      await this.recorderInstance.stopAndUnloadAsync();
      const status = await this.recorderInstance.getStatusAsync?.();
      const uri = this.recorderInstance.getURI?.() ?? this.recorderInstance._uri;
      this.recorderInstance = null;

      if (!uri) return null;
      return { uri, durationMs: status?.durationMillis ?? 0 };
    } catch (e) {
      console.warn('⚠️ [Audio] Falha ao parar gravação:', e);
      this.recorderInstance = null;
      return null;
    }
  }
}
