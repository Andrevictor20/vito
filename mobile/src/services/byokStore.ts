import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { ByokStep, isByokStep } from '../utils/byokFlow';
import { clearPluggyWebViewData } from '../utils/pluggyBrowserReset';
import { canValidate } from '../utils/pluggyKeys';
import { api } from './api';

/**
 * Persistência e backup cifrado no cliente do BYOK Pluggy (Plano 26, Q-1).
 * - Client ID/Secret e chave AES-256-GCM: SOMENTE em expo-secure-store (Keystore/Keychain).
 * - O backend do Vito recebe apenas blob opaco cifrado e nonce (`PUT /api/v1/finance/byok-backup`),
 *   nunca enxergando `clientSecret` em texto claro.
 * - Etapa e flags não sensíveis: AsyncStorage.
 */
const K_ID = 'vito_pluggy_client_id';
const K_SECRET = 'vito_pluggy_client_secret';
const K_USER = 'vito_pluggy_client_user_id';
const K_BACKUP_KEY = 'vito_byok_backup_key';
const K_STEP = 'vito_byok_step';
const K_TUTORIAL = 'vito_byok_tutorial_seen';
const K_CLEAN_RESET_0129 = 'vito_byok_clean_reset_0_1_29';
const BACKUP_KEY_VERSION = 1;
const SECURE_STORE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export interface PluggyKeys {
  clientId: string;
  clientSecret: string;
}

function encodeUtf8(value: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value);
  const encoded = unescape(encodeURIComponent(value));
  const bytes = new Uint8Array(encoded.length);
  for (let i = 0; i < encoded.length; i += 1) bytes[i] = encoded.charCodeAt(i);
  return bytes;
}

function decodeUtf8(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(bytes);
  let raw = '';
  for (let i = 0; i < bytes.length; i += 1) raw += String.fromCharCode(bytes[i]);
  return decodeURIComponent(escape(raw));
}

async function getOrCreateBackupKey(): Promise<Crypto.AESEncryptionKey> {
  const savedB64 = await SecureStore.getItemAsync(K_BACKUP_KEY).catch(() => null);
  if (savedB64) {
    try {
      return await Crypto.AESEncryptionKey.import(savedB64, 'base64');
    } catch {
      // Gera nova chave se a armazenada estiver corrompida.
    }
  }
  const key = await Crypto.AESEncryptionKey.generate(Crypto.AESKeySize.AES256);
  const exported = await key.encoded('base64');
  await SecureStore.setItemAsync(K_BACKUP_KEY, exported, SECURE_STORE_OPTS);
  return key;
}

function backupAadBytes(keyVersion: number): Uint8Array {
  return encodeUtf8(`vito:byok-backup:v${keyVersion}`);
}

async function syncEncryptedBackup(keys: PluggyKeys): Promise<void> {
  try {
    const key = await getOrCreateBackupKey();
    const plaintext = encodeUtf8(JSON.stringify({ clientId: keys.clientId, clientSecret: keys.clientSecret }));
    const sealed = await Crypto.aesEncryptAsync(plaintext, key, {
      nonce: { length: 12 },
      tagLength: 16,
      additionalData: backupAadBytes(BACKUP_KEY_VERSION),
    });
    const [nonce, ciphertext] = await Promise.all([
      sealed.iv('base64'),
      sealed.ciphertext({ includeTag: true, encoding: 'base64' }),
    ]);
    await api.finance.saveByokBackup({ ciphertext, nonce, key_version: BACKUP_KEY_VERSION });
  } catch {
    // Fallback silencioso: dispositivo offline ou endpoint B3 ainda indisponível.
  }
}

export async function getKeys(): Promise<PluggyKeys | null> {
  try {
    const [clientId, clientSecret] = await Promise.all([
      SecureStore.getItemAsync(K_ID),
      SecureStore.getItemAsync(K_SECRET),
    ]);
    return clientId && clientSecret ? { clientId, clientSecret } : null;
  } catch {
    return null;
  }
}

/** Tenta restaurar e decifrar localmente o backup caso o SecureStore ainda não tenha chaves. */
export async function restoreBackupKeys(): Promise<PluggyKeys | null> {
  try {
    const savedB64 = await SecureStore.getItemAsync(K_BACKUP_KEY).catch(() => null);
    if (!savedB64) return null;
    const backup = await api.finance.getByokBackup();
    if (!backup?.ciphertext || !backup?.nonce) return null;

    const key = await Crypto.AESEncryptionKey.import(savedB64, 'base64');
    const sealed = Crypto.AESSealedData.fromParts(backup.nonce, backup.ciphertext, 16);
    const bytes = await Crypto.aesDecryptAsync(sealed, key, {
      output: 'bytes',
      additionalData: backupAadBytes(backup.key_version || BACKUP_KEY_VERSION),
    });
    const parsed = JSON.parse(decodeUtf8(bytes)) as Partial<PluggyKeys>;
    if (!parsed?.clientId || !parsed?.clientSecret || !canValidate(parsed.clientId, parsed.clientSecret)) {
      return null;
    }
    const keys: PluggyKeys = { clientId: parsed.clientId, clientSecret: parsed.clientSecret };
    await SecureStore.setItemAsync(K_ID, keys.clientId, SECURE_STORE_OPTS);
    await SecureStore.setItemAsync(K_SECRET, keys.clientSecret, SECURE_STORE_OPTS);
    return keys;
  } catch {
    return null;
  }
}

export async function saveKeys(keys: PluggyKeys): Promise<void> {
  await SecureStore.setItemAsync(K_ID, keys.clientId, SECURE_STORE_OPTS);
  await SecureStore.setItemAsync(K_SECRET, keys.clientSecret, SECURE_STORE_OPTS);
  await syncEncryptedBackup(keys);
}

/** "Trocar chaves": apaga chaves, etapa local, backup cifrado remoto e cookies do WebView. */
export async function clearKeys(): Promise<void> {
  await SecureStore.deleteItemAsync(K_ID).catch(() => {});
  await SecureStore.deleteItemAsync(K_SECRET).catch(() => {});
  await AsyncStorage.removeItem(K_STEP).catch(() => {});
  await api.finance.deleteByokBackup().catch(() => {});
  await clearPluggyWebViewData().catch(() => {});
}

/** Zera integralmente chaves, identificadores BYOK, tutorial, backup remoto e dados de navegação. */
export async function resetAllFromScratch(): Promise<void> {
  await Promise.allSettled([
    SecureStore.deleteItemAsync(K_ID),
    SecureStore.deleteItemAsync(K_SECRET),
    SecureStore.deleteItemAsync(K_USER),
    SecureStore.deleteItemAsync(K_BACKUP_KEY),
    AsyncStorage.removeItem(K_STEP),
    AsyncStorage.removeItem(K_TUTORIAL),
    api.finance.deleteByokBackup(),
    clearPluggyWebViewData(),
  ]);
}

/** Garante reinício limpo único após atualização do 0.1.28 (que bloqueava na Etapa 2). */
export async function ensureCleanStartReset0129(): Promise<void> {
  const alreadyReset = await AsyncStorage.getItem(K_CLEAN_RESET_0129).catch(() => null);
  if (alreadyReset === '1') return;
  await resetAllFromScratch();
  await AsyncStorage.setItem(K_CLEAN_RESET_0129, '1').catch(() => {});
}

export async function getStep(): Promise<ByokStep | null> {
  const v = await AsyncStorage.getItem(K_STEP).catch(() => null);
  return isByokStep(v) ? v : null;
}

export async function setStep(step: ByokStep): Promise<void> {
  await AsyncStorage.setItem(K_STEP, step).catch(() => {});
}

export async function isTutorialSeen(): Promise<boolean> {
  return (await AsyncStorage.getItem(K_TUTORIAL).catch(() => null)) === '1';
}

export async function markTutorialSeen(): Promise<void> {
  await AsyncStorage.setItem(K_TUTORIAL, '1').catch(() => {});
}

/** clientUserId estável por instalação, exigido pelo connect_token da Pluggy. */
export async function getClientUserId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(K_USER).catch(() => null);
  if (existing) return existing;
  const fresh = Crypto.randomUUID();
  await SecureStore.setItemAsync(K_USER, fresh, SECURE_STORE_OPTS);
  return fresh;
}
