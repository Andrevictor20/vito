// audioRecorder.ts — Gravação de áudio resiliente para Expo Go + builds nativas com expo-audio
let ExpoAudio: any = null;

try {
  ExpoAudio = require('expo-audio');
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
    return ExpoAudio !== null && (!!ExpoAudio.AudioRecorder || !!ExpoAudio.AudioModule?.AudioRecorder);
  }

  static async requestPermissions(): Promise<boolean> {
    if (!ExpoAudio) return false;
    try {
      const fn =
        ExpoAudio.requestRecordingPermissionsAsync ||
        ExpoAudio.AudioModule?.requestRecordingPermissionsAsync;
      if (fn) {
        const res = await fn();
        return res.granted ?? res.status === 'granted';
      }
      return false;
    } catch {
      return false;
    }
  }

  static async startRecording(): Promise<boolean> {
    if (!ExpoAudio) return false;
    try {
      const granted = await this.requestPermissions();
      if (!granted) {
        console.warn('⚠️ [Audio] Permissão para gravar áudio não concedida.');
        return false;
      }

      // Ativa modo de áudio para gravação
      if (ExpoAudio.setAudioModeAsync) {
        await ExpoAudio.setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
      }

      const AudioRecorderClass = ExpoAudio.AudioRecorder || ExpoAudio.AudioModule?.AudioRecorder;
      if (!AudioRecorderClass) {
        console.warn('⚠️ [Audio] AudioRecorder não encontrado em expo-audio.');
        return false;
      }

      const preset = ExpoAudio.RecordingPresets?.HIGH_QUALITY || {
        extension: '.m4a',
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: 128000,
      };

      const recorder = new AudioRecorderClass(preset);
      if (typeof recorder.prepareToRecordAsync === 'function') {
        await recorder.prepareToRecordAsync();
      }
      recorder.record();
      this.recorderInstance = recorder;
      return true;
    } catch (e) {
      console.warn('⚠️ [Audio] Falha ao iniciar gravação:', e);
      return false;
    }
  }

  static async stopRecording(): Promise<AudioRecordingResult | null> {
    if (!this.recorderInstance) return null;
    try {
      const recorder = this.recorderInstance;
      await recorder.stop();
      const uri = recorder.uri;
      const durationMs = (recorder.currentTime || 0) * 1000;
      this.recorderInstance = null;

      if (!uri) {
        console.warn('⚠️ [Audio] Gravação finalizada sem URI');
        return null;
      }
      return { uri, durationMs };
    } catch (e) {
      console.warn('⚠️ [Audio] Falha ao parar gravação:', e);
      this.recorderInstance = null;
      return null;
    }
  }
}
