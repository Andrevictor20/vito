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

      // 1. Sempre persiste no AsyncStorage primeiro (resiliente contra reboots e limpezas do Keystore)
      await AsyncStorage.setItem(key, value).catch(() => {});

      // 2. Tenta persistência criptografada no SecureStore
      const options = isIOS ? { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK } : undefined;
      await SecureStore.setItemAsync(key, value, options);
    } catch (err) {
      console.warn(`[secureStorage] Erro ao salvar chave segura '${key}':`, err);
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

      // 1. Tenta recuperar do SecureStore
      try {
        const options = isIOS ? { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK } : undefined;
        const secureVal = await SecureStore.getItemAsync(key, options);
        if (secureVal) {
          return secureVal;
        }
      } catch (secErr) {
        console.warn(`[secureStorage] SecureStore indisponível para '${key}', buscando fallback:`, secErr);
      }

      // 2. Fallback resiliente no AsyncStorage
      const asyncVal = await AsyncStorage.getItem(key);
      if (asyncVal) {
        // Auto-cura: restaura no SecureStore silenciosamente
        const options = isIOS ? { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK } : undefined;
        SecureStore.setItemAsync(key, asyncVal, options).catch(() => {});
        return asyncVal;
      }

      return null;
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

