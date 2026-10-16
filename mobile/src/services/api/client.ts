import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStorage } from '../secureStore';
import { isAbortLike } from '../../utils/requestTimeout';
import { ApiRequestOptions } from './types';

const TOKEN_KEY = '@vito_jwt_token';
const SERVER_URL_KEY = '@vito_server_url';
const SERVER_MANUAL_OVERRIDE_KEY = '@vito_server_manual_override_v2';

export const PI_SERVER_URL = process.env.EXPO_PUBLIC_LOCAL_SERVER_URL || '';
export const CLOUDFLARE_SERVER_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://vito.rasppi.cloud';
export const DEFAULT_SERVER_URL = CLOUDFLARE_SERVER_URL;

export const isCloudServer = (url: string): boolean => {
  return url === CLOUDFLARE_SERVER_URL || (!url.includes('192.168.') && !url.includes('localhost') && !url.includes('127.0.0.1'));
};

export class ApiClient {
  protected baseUrl: string = DEFAULT_SERVER_URL;
  protected token: string | null = null;

  async init() {
    const hasManualOverride = await AsyncStorage.getItem(SERVER_MANUAL_OVERRIDE_KEY);
    const savedUrl = await AsyncStorage.getItem(SERVER_URL_KEY);

    const savedIsCloud = !!savedUrl && savedUrl.startsWith('https://');
    if (hasManualOverride === 'true' && savedIsCloud) {
      this.baseUrl = savedUrl as string;
    } else {
      this.baseUrl = CLOUDFLARE_SERVER_URL;
      await AsyncStorage.setItem(SERVER_URL_KEY, this.baseUrl);
      await AsyncStorage.removeItem(SERVER_MANUAL_OVERRIDE_KEY);
    }
    this.token = await secureStorage.getItem(TOKEN_KEY);
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async setBaseUrl(url: string) {
    this.baseUrl = url;
    await AsyncStorage.setItem(SERVER_URL_KEY, url);
    await AsyncStorage.setItem(SERVER_MANUAL_OVERRIDE_KEY, 'true');
  }

  shortServerHost(): string {
    return this.baseUrl
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');
  }

  async setToken(token: string | null) {
    this.token = token;
    if (token) {
      await secureStorage.setItem(TOKEN_KEY, token);
    } else {
      await secureStorage.removeItem(TOKEN_KEY);
    }
  }

  getToken(): string | null {
    return this.token;
  }

  async request<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const isAiEndpoint = endpoint.includes('/assistant/');
    const isIntegrationEndpoint = endpoint.includes('/integrations/');
    const defaultTimeout = isAiEndpoint || isIntegrationEndpoint ? 60000 : 15000;
    const timeoutMs = options.timeoutMs || defaultTimeout;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let externalAbortHandler: (() => void) | null = null;
    if (options.signal) {
      if (options.signal.aborted) {
        controller.abort();
      } else {
        externalAbortHandler = () => controller.abort();
        options.signal.addEventListener('abort', externalAbortHandler, { once: true });
      }
    }

    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const errorMsg = data?.error || `Erro HTTP ${res.status}`;
        const httpErr = new Error(errorMsg) as Error & { status?: number };
        httpErr.status = res.status;
        throw httpErr;
      }

      return data as T;
    } catch (err: any) {
      if (options.signal?.aborted) {
        const userErr = new Error('USER_CANCELLED');
        userErr.name = 'AbortError';
        throw userErr;
      }
      if (isAbortLike(err)) {
        const seconds = Math.round(timeoutMs / 1000);
        throw new Error(`Tempo limite esgotado (${seconds}s) ao conectar no servidor (${this.baseUrl}).`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
      if (externalAbortHandler && options.signal) {
        options.signal.removeEventListener('abort', externalAbortHandler);
      }
    }
  }

  get<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, body?: any, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(endpoint: string, body?: any, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(endpoint: string, body?: any, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}
