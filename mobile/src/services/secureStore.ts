import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Utilitário de Armazenamento Seguro Resiliente (Dual-Storage).
 * - Primário: AsyncStorage para garantir persistência imutável entre reinicializações de app
 * - Hardware: Android Keystore / iOS Keychain (SecureStore) quando disponível
 * - Web: LocalStorage / SessionStorage com fallback em memória
 */

const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const webStorage = new Map<string, string>();

export const secureStorage = {
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (isWeb) {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
        } else {
          webStorage.set(key, value);
        }
        return;
      }

      const isSensitive = key.includes('token') || key.includes('secret') || key.includes('auth');

      // 1. Tenta persistência criptografada no SecureStore (Hardware Keystore / Keychain)
      const options = isIOS ? { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK } : undefined;
      let secureStoreSuccess = false;
      try {
        await SecureStore.setItemAsync(key, value, options);
        secureStoreSuccess = true;
      } catch (secErr) {
        console.warn(`[secureStorage] Falha ao persistir no SecureStore para '${key}':`, secErr);
        if (isSensitive) {
          // Hard-Fail de Segurança: em falha na Keystore/Keychain, PROIBIDO gravar segredos em texto claro no AsyncStorage
          throw new Error(`[secureStorage] Falha crítica de hardware/segurança: não foi possível gravar '${key}' com criptografia.`);
        }
      }

      // 2. Apenas utiliza AsyncStorage se NÃO for token sensível
      if (!isSensitive) {
        await AsyncStorage.setItem(key, value).catch(() => {});
      } else if (secureStoreSuccess) {
        // Se SecureStore foi bem sucedido, purga qualquer cópia residual prévia em texto claro no AsyncStorage
        await AsyncStorage.removeItem(key).catch(() => {});
      }
    } catch (err) {
      console.warn(`[secureStorage] Erro ao salvar chave segura '${key}':`, err);
      throw err;
    }
  },

  async getItem(key: string): Promise<string | null> {
    try {
      if (isWeb) {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(key);
        }
        return webStorage.get(key) || null;
      }

      const isSensitive = key.includes('token') || key.includes('secret') || key.includes('auth');

      // 1. Tenta recuperar do SecureStore
      try {
        const options = isIOS ? { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK } : undefined;
        const secureVal = await SecureStore.getItemAsync(key, options);
        if (secureVal) {
          return secureVal;
        }
      } catch (secErr) {
        console.warn(`[secureStorage] SecureStore indisponível para '${key}':`, secErr);
        if (isSensitive) {
          // Hard-fail: não aceita fallback inseguro para tokens/segredos
          return null;
        }
      }

      // 2. Chaves sensíveis NUNCA são lidas do AsyncStorage
      if (isSensitive) {
        return null;
      }

      const asyncVal = await AsyncStorage.getItem(key);
      return asyncVal;
    } catch (err) {
      console.warn(`[secureStorage] Erro ao recuperar chave segura '${key}':`, err);
      return null;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (isWeb) {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        } else {
          webStorage.delete(key);
        }
        return;
      }

      await AsyncStorage.removeItem(key).catch(() => {});
      const options = isIOS ? { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK } : undefined;
      await SecureStore.deleteItemAsync(key, options).catch(() => {});
    } catch (err) {
      console.warn(`[secureStorage] Erro ao remover chave segura '${key}':`, err);
    }
  },
};

