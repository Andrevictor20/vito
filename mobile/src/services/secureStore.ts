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

/**
 * Normaliza chaves para o expo-secure-store.
 * No Android, o Keystore/SharedPreferences aceita exclusivamente [a-zA-Z0-9._-].
 * Caracteres como '@' causam erro fatal de validação no runtime nativo.
 */
function sanitizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9._-]/g, '_');
}

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
      const secureKey = sanitizeKey(key);
      const options = isIOS ? { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK } : undefined;
      let secureStoreSuccess = false;

      // 1. Tenta persistência criptografada no SecureStore com chave sanitizada
      try {
        await SecureStore.setItemAsync(secureKey, value, options);
        secureStoreSuccess = true;
      } catch (secErr) {
        console.warn(`[secureStorage] SecureStore indisponível/falha ao persistir '${secureKey}':`, secErr);
      }

      // Persistência Dual-Storage imutável:
      // Mantém sempre uma cópia no AsyncStorage como salvaguarda contra suspensão/reset
      // de Keystore nativo pelo gerenciador de bateria do Android (Samsung/Xiaomi/Motorola).
      await AsyncStorage.setItem(key, value).catch(() => {});
      if (secureKey !== key) {
        await AsyncStorage.setItem(secureKey, value).catch(() => {});
      }
    } catch (err) {
      console.warn(`[secureStorage] Erro ao salvar chave segura '${key}':`, err);
      // Fallback final de emergência para nunca deixar o usuário deslogado ou bloqueado
      await AsyncStorage.setItem(key, value).catch(() => {});
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

      const secureKey = sanitizeKey(key);
      const options = isIOS ? { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK } : undefined;

      // 1. Tenta recuperar do SecureStore com chave normalizada
      try {
        const secureVal = await SecureStore.getItemAsync(secureKey, options);
        if (secureVal) {
          return secureVal;
        }
        // Se não encontrou e a chave original é diferente, tenta a chave original
        if (secureKey !== key) {
          const rawSecureVal = await SecureStore.getItemAsync(key, options).catch(() => null);
          if (rawSecureVal) {
            return rawSecureVal;
          }
        }
      } catch (secErr) {
        console.warn(`[secureStorage] SecureStore leitura falhou para '${secureKey}':`, secErr);
      }

      // 2. Migração Transparente e Fallback: tenta recuperar do AsyncStorage
      const asyncVal = await AsyncStorage.getItem(key);
      if (asyncVal) {
        // Migra silenciosamente para o SecureStore
        SecureStore.setItemAsync(secureKey, asyncVal, options).then(() => {
          AsyncStorage.removeItem(key).catch(() => {});
        }).catch(() => {});
        return asyncVal;
      }

      // Tenta também com chave sanitizada no AsyncStorage se aplicável
      if (secureKey !== key) {
        const asyncSanitizedVal = await AsyncStorage.getItem(secureKey);
        if (asyncSanitizedVal) {
          return asyncSanitizedVal;
        }
      }

      return null;
    } catch (err) {
      console.warn(`[secureStorage] Erro ao recuperar chave segura '${key}':`, err);
      return AsyncStorage.getItem(key).catch(() => null);
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

      const secureKey = sanitizeKey(key);
      const options = isIOS ? { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK } : undefined;

      await AsyncStorage.removeItem(key).catch(() => {});
      if (secureKey !== key) {
        await AsyncStorage.removeItem(secureKey).catch(() => {});
      }
      await SecureStore.deleteItemAsync(secureKey, options).catch(() => {});
      if (secureKey !== key) {
        await SecureStore.deleteItemAsync(key, options).catch(() => {});
      }
    } catch (err) {
      console.warn(`[secureStorage] Erro ao remover chave segura '${key}':`, err);
    }
  },
};

