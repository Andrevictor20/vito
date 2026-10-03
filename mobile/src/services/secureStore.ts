import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Utilitário de Armazenamento Seguro com Proteção de Hardware (Zero-Trust).
 * - Android: AES-256 no Android Keystore
 * - iOS: Apple Keychain com kSecAttrAccessibleAfterFirstUnlock
 * - Web: Fallback gracioso para ambiente web
 */

const isWeb = Platform.OS === 'web';
const webStorage = new Map<string, string>();

export const secureStorage = {
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (isWeb) {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.setItem(key, value);
        } else {
          webStorage.set(key, value);
        }
        return;
      }
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      });
    } catch (err) {
      console.warn(`[secureStorage] Erro ao salvar chave segura '${key}':`, err);
    }
  },

  async getItem(key: string): Promise<string | null> {
    try {
      if (isWeb) {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          return window.sessionStorage.getItem(key);
        }
        return webStorage.get(key) || null;
      }
      return await SecureStore.getItemAsync(key, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      });
    } catch (err) {
      console.warn(`[secureStorage] Erro ao recuperar chave segura '${key}':`, err);
      return null;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (isWeb) {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.removeItem(key);
        } else {
          webStorage.delete(key);
        }
        return;
      }
      await SecureStore.deleteItemAsync(key, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      });
    } catch (err) {
      console.warn(`[secureStorage] Erro ao remover chave segura '${key}':`, err);
    }
  },
};
