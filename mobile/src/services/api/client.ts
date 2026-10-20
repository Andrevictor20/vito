import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStorage } from '../secureStore';
import { isAbortLike } from '../../utils/requestTimeout';
import { ApiRequestOptions } from './types';
import { getMobileDeviceName } from '../../utils/platformInfo';

const TOKEN_KEY = '@vito_jwt_token';
const REFRESH_TOKEN_KEY = '@vito_refresh_token';
const SESSION_ID_KEY = '@vito_session_id';
const SERVER_URL_KEY = '@vito_server_url';
const SERVER_MANUAL_OVERRIDE_KEY = '@vito_server_manual_override_v2';

export const PI_SERVER_URL = process.env.EXPO_PUBLIC_LOCAL_SERVER_URL || '';
export const CLOUDFLARE_SERVER_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://vito.rasppi.cloud';
export const DEFAULT_SERVER_URL = CLOUDFLARE_SERVER_URL;

export const isCloudServer = (url: string): boolean => {
  return url === CLOUDFLARE_SERVER_URL || (!url.includes('192.168.') && !url.includes('localhost') && !url.includes('127.0.0.1'));
};

function decodeBase64(str: string): string {
  try {
    if (typeof atob === 'function') {
      return atob(str);
    }
  } catch {}
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  str = String(str).replace(/=+$/, '');
  for (let bc = 0, bs = 0, buffer, idx = 0; buffer = str.charAt(idx++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
    buffer = chars.indexOf(buffer);
  }
  return output;
}

export function isJwtExpiringSoon(token: string | null, marginSeconds = 120): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = decodeBase64(base64);
    const payload = JSON.parse(jsonStr);
    if (!payload.exp) return false;
    const nowSec = Math.floor(Date.now() / 1000);
    return payload.exp - nowSec <= marginSeconds;
  } catch {
    return false;
  }
}

// Valores de sessão corrompidos (ex.: a string "undefined" persistida por um payload inválido).
function isCorruptedSessionValue(value: string): boolean {
  return value === 'undefined' || value === 'null' || value.trim() === '';
}

// Access token do backend é um JWT (3 segmentos separados por ponto).
function isJwtLikeToken(token: string): boolean {
  if (isCorruptedSessionValue(token)) return false;
  return token.split('.').length === 3;
}

export class ApiClient {
  protected baseUrl: string = DEFAULT_SERVER_URL;
  protected token: string | null = null;
  protected refreshToken: string | null = null;
  protected sessionId: string | null = null;
  private refreshPromise: Promise<string | null> | null = null;

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
    this.refreshToken = await secureStorage.getItem(REFRESH_TOKEN_KEY);
    this.sessionId = await secureStorage.getItem(SESSION_ID_KEY);

    // Saneamento de sessão corrompida: payloads inválidos gravavam a string "undefined"
    // no storage, o que deixava o app travado em loading até o usuário limpar o cache.
    if (this.token && !isJwtLikeToken(this.token)) {
      console.warn('[api] Token de acesso corrompido, descartando.');
      this.token = null;
      await secureStorage.removeItem(TOKEN_KEY);
    }
    if (this.refreshToken && isCorruptedSessionValue(this.refreshToken)) {
      console.warn('[api] Refresh token corrompido, descartando.');
      this.refreshToken = null;
      await secureStorage.removeItem(REFRESH_TOKEN_KEY);
    }
    if (this.sessionId && isCorruptedSessionValue(this.sessionId)) {
      this.sessionId = null;
      await secureStorage.removeItem(SESSION_ID_KEY);
    }
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

  async setRefreshToken(refreshToken: string | null) {
    this.refreshToken = refreshToken;
    if (refreshToken) {
      await secureStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    } else {
      await secureStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  async setSessionId(sessionId: string | null) {
    this.sessionId = sessionId;
    if (sessionId) {
      await secureStorage.setItem(SESSION_ID_KEY, sessionId);
    } else {
      await secureStorage.removeItem(SESSION_ID_KEY);
    }
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  async setAuthTokens(token: string | null, refreshToken?: string | null, sessionId?: string | null) {
    await this.setToken(token);
    if (refreshToken !== undefined) {
      await this.setRefreshToken(refreshToken);
    }
    if (sessionId !== undefined) {
      await this.setSessionId(sessionId);
    }
  }

  private async performTokenRefresh(): Promise<string | null> {
    if (!this.refreshToken) {
      return null;
    }
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const res = await fetch(`${this.baseUrl}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            refresh_token: this.refreshToken,
            device_name: getMobileDeviceName(),
          }),
        });

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            await this.setAuthTokens(null, null, null);
          }
          return null;
        }

        const data = await res.json().catch(() => null);
        const newAccess = data?.access_token || data?.token;
        if (!newAccess) {
          return null;
        }

        await this.setAuthTokens(
          newAccess,
          data?.refresh_token ?? this.refreshToken,
          data?.session_id ?? this.sessionId
        );
        return newAccess;
      } catch {
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  isTokenExpiringSoon(marginSeconds = 120): boolean {
    return isJwtExpiringSoon(this.token, marginSeconds);
  }

  async ensureFreshToken(): Promise<string | null> {
    if (!this.refreshToken) {
      return this.token;
    }
    if (this.isTokenExpiringSoon()) {
      return this.performTokenRefresh();
    }
    return this.token;
  }

  async request<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
    const isAuthFlow =
      endpoint.includes('/auth/login') ||
      endpoint.includes('/auth/register') ||
      endpoint.includes('/auth/refresh');

    // Se o token de acesso não estiver carregado em memória, recupera do storage seguro antes da requisição
    if (!isAuthFlow && !this.token) {
      const storedToken = await secureStorage.getItem(TOKEN_KEY);
      if (storedToken) {
        this.token = storedToken;
      }
      if (!this.refreshToken) {
        const storedRefresh = await secureStorage.getItem(REFRESH_TOKEN_KEY);
        if (storedRefresh) {
          this.refreshToken = storedRefresh;
        }
      }
      if (!this.sessionId) {
        const storedSession = await secureStorage.getItem(SESSION_ID_KEY);
        if (storedSession) {
          this.sessionId = storedSession;
        }
      }
    }

    // Se o token estiver expirado ou prestes a expirar e houver refresh token, renova proativamente
    if (!isAuthFlow && this.refreshToken && this.isTokenExpiringSoon()) {
      await this.performTokenRefresh();
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    if (this.sessionId) {
      headers['X-Session-ID'] = this.sessionId;
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

      if (res.status === 401 && !options._isRetry && !isAuthFlow) {
        if (!this.refreshToken) {
          const storedRefresh = await secureStorage.getItem(REFRESH_TOKEN_KEY);
          if (storedRefresh) {
            this.refreshToken = storedRefresh;
          }
        }
        if (this.refreshToken) {
          const refreshedToken = await this.performTokenRefresh();
          if (refreshedToken) {
            return this.request<T>(endpoint, { ...options, _isRetry: true });
          }
        }
      }

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
