import { NativeModules, Platform } from 'react-native';

let LegacyFileSystemModule: any = null;
let ModernFileSystemModule: any = null;

try {
  LegacyFileSystemModule = require('expo-file-system/legacy');
} catch {
  LegacyFileSystemModule = null;
}

try {
  ModernFileSystemModule = require('expo-file-system');
} catch {
  ModernFileSystemModule = null;
}

export async function fileUriToBase64(uri: string): Promise<string> {
  if (!uri) return '';
  if (uri.startsWith('data:')) {
    return uri.split(',')[1] || '';
  }

  // Se já for uma string base64 pura sem scheme (ex: sem / e sem ://)
  if (!uri.includes('://') && !uri.startsWith('/') && uri.length > 100) {
    return uri;
  }

  const cleanUri =
    Platform.OS === 'android' && !uri.startsWith('file://') && !uri.startsWith('content://')
      ? `file://${uri}`
      : uri;

  // 0. Ponte nativa direta em Kotlin (VitoDuplexAudioModule.readAudioFileBase64) para arquivos locais no Android
  if (Platform.OS === 'android' && typeof NativeModules?.VitoDuplexAudioModule?.readAudioFileBase64 === 'function') {
    try {
      const nativeB64 = await NativeModules.VitoDuplexAudioModule.readAudioFileBase64(cleanUri);
      if (nativeB64 && typeof nativeB64 === 'string' && nativeB64.length > 0) {
        return nativeB64;
      }
    } catch {
      // Prossegue para expo-file-system/legacy
    }
  }

  // 1. Tenta expo-file-system/legacy (compatível com Expo SDK 54-57 sem erro de deprecação em runtime)
  const legacyRead =
    LegacyFileSystemModule?.readAsStringAsync ||
    LegacyFileSystemModule?.default?.readAsStringAsync;
  if (typeof legacyRead === 'function') {
    try {
      const encoding = LegacyFileSystemModule?.EncodingType?.Base64 || 'base64';
      const b64 = await legacyRead(cleanUri, { encoding });
      if (b64 && typeof b64 === 'string' && b64.length > 0) {
        return b64;
      }
    } catch (legacyErr) {
      console.warn('[fileUriToBase64] expo-file-system/legacy falhou:', legacyErr);
    }
  }

  // 2. Tenta a nova API File do Expo SDK 57 (new File(uri).base64())
  const ExpoFileClass = ModernFileSystemModule?.File || ModernFileSystemModule?.default?.File;
  if (typeof ExpoFileClass === 'function') {
    try {
      const fileObj = new ExpoFileClass(cleanUri);
      if (typeof fileObj.base64 === 'function') {
        const b64 = await fileObj.base64();
        if (b64 && typeof b64 === 'string' && b64.length > 0) {
          return b64;
        }
      }
    } catch (modernErr) {
      console.warn('[fileUriToBase64] Expo File.base64() falhou:', modernErr);
    }
  }

  // 3. Tenta XMLHttpRequest nativo do React Native
  try {
    const b64 = await new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result as string;
          resolve(res && res.includes(',') ? res.split(',')[1] : res || '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(xhr.response);
      };
      xhr.onerror = reject;
      xhr.responseType = 'blob';
      xhr.open('GET', cleanUri, true);
      xhr.send(null);
    });
    if (b64 && b64.length > 0) {
      return b64;
    }
  } catch (xhrErr) {
    console.warn('[fileUriToBase64] XMLHttpRequest falhou:', xhrErr);
  }

  // 4. Fallback defensivo com fetch
  try {
    const response = await fetch(cleanUri);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl && dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl || '';
        resolve(base64);
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(blob);
    });
  } catch (fetchErr) {
    console.warn('[fileUriToBase64] fetch falhou:', fetchErr);
    throw fetchErr;
  }
}
