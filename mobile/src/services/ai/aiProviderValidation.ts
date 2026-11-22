import type { AIProviderKey } from '../../types/aiProviders';
import { AI_PROVIDER_CATALOG } from './aiProviderCatalog';

export interface ProviderCredentialValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Valida localmente URL (para endpoint custom) e prefixo da chave de API
 * antes de enviar ao servidor (Plano 03 §2 / AI-01).
 */
export function validateProviderCredentials(
  providerKey: AIProviderKey,
  apiKey: string,
  baseUrl?: string
): ProviderCredentialValidationResult {
  const entry = AI_PROVIDER_CATALOG[providerKey];
  const trimmedKey = (apiKey || '').trim();
  const trimmedUrl = (baseUrl || '').trim();

  if (entry.requiresUrl) {
    if (!trimmedKey || !trimmedUrl) {
      return { valid: false, error: 'Preencha o endereço e a chave.' };
    }
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      return { valid: false, error: 'O endereço precisa começar com http:// ou https://.' };
    }
    return { valid: true };
  }

  if (!trimmedKey) {
    return { valid: false, error: 'Preencha a chave.' };
  }

  if (providerKey === 'openai' && /^sk-(ant|or)-/.test(trimmedKey)) {
    return { valid: false, error: 'Esta chave parece ser de outro provedor.' };
  }

  if (entry.keyPrefix && !trimmedKey.startsWith(entry.keyPrefix)) {
    return {
      valid: false,
      error: `Esta chave não parece ser do ${entry.name}. Ela deve começar com ${entry.keyPrefix}.`,
    };
  }

  return { valid: true };
}
