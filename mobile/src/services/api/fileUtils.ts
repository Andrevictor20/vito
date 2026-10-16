import { Platform } from 'react-native';

let FileSystemModule: any = null;
try {
  FileSystemModule = require('expo-file-system');
} catch (e) {
  FileSystemModule = null;
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

  // 1. Tenta expo-file-system (mecanismo primário e mais estável do Expo para leitura binária local)
  const fsRead = FileSystemModule?.readAsStringAsync || FileSystemModule?.FileSystem?.readAsStringAsync;
  if (typeof fsRead === 'function') {
    try {
      const encoding = FileSystemModule?.EncodingType?.Base64 || 'base64';
      const b64 = await fsRead(cleanUri, { encoding });
      if (b64 && typeof b64 === 'string' && b64.length > 0) {
        return b64;
      }
    } catch (fsErr) {
      console.warn('[fileUriToBase64] expo-file-system falhou:', fsErr);
    }
  }

  // 2. Tenta XMLHttpRequest nativo do React Native (lê local files como blob)
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

  // 3. Fallback defensivo com fetch
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
