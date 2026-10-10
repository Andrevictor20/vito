import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStorage } from './secureStore';
import {
  User,
  AuthResponse,
  Event,
  Todo,
  AssistantChatResponse,
  ConflictInfo,
  Trigger,
  TriggerCategory,
  TriggerLog,
  TriggerTestResult,
  TriggerStatus,
  CreateTriggerInput,
} from '../types';

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

const TOKEN_KEY = '@vito_jwt_token';
const SERVER_URL_KEY = '@vito_server_url';
const SERVER_MANUAL_OVERRIDE_KEY = '@vito_server_manual_override_v2';
export const PI_SERVER_URL = process.env.EXPO_PUBLIC_LOCAL_SERVER_URL || '';
export const CLOUDFLARE_SERVER_URL = process.env.EXPO_PUBLIC_API_URL || '';
export const DEFAULT_SERVER_URL = CLOUDFLARE_SERVER_URL || PI_SERVER_URL || 'http://localhost:8080';

export const isCloudServer = (url: string): boolean => {
  return url === CLOUDFLARE_SERVER_URL || (!url.includes('192.168.') && !url.includes('localhost') && !url.includes('127.0.0.1'));
};

class ApiService {
  private baseUrl: string = DEFAULT_SERVER_URL;
  private token: string | null = null;

  async init() {
    const hasManualOverride = await AsyncStorage.getItem(SERVER_MANUAL_OVERRIDE_KEY);
    const savedUrl = await AsyncStorage.getItem(SERVER_URL_KEY);

    // Se o usuário alternou manualmente na UI desta versão, respeita a escolha
    if (hasManualOverride === 'true' && savedUrl) {
      this.baseUrl = savedUrl;
    } else {
      // Caso contrário, SEMPRE prioriza a Nuvem pública (Cloudflare) para garantir que funcione de qualquer lugar (4G, WiFi)
      this.baseUrl = CLOUDFLARE_SERVER_URL || DEFAULT_SERVER_URL;
      await AsyncStorage.setItem(SERVER_URL_KEY, this.baseUrl);
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

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
    const timeoutMs = (options as any)?.timeoutMs || defaultTimeout;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 404 && this.baseUrl !== 'http://localhost:8080' && endpoint.includes('/triggers/')) {
          try {
            const localRes = await fetch(`http://localhost:8080${endpoint}`, {
              ...options,
              headers,
              signal: controller.signal,
            });
            if (localRes.ok) {
              const localData = await localRes.json().catch(() => null);
              return localData as T;
            }
          } catch {
            // Mantém comportamento e mensagem original caso o backend local não esteja ativo
          }
        }
        const errorMsg = data?.error || `Erro HTTP ${res.status}`;
        throw new Error(errorMsg);
      }

      return data as T;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        const seconds = Math.round(timeoutMs / 1000);
        throw new Error(`Tempo limite esgotado (${seconds}s) ao conectar no servidor (${this.baseUrl}).`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
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

  delete<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  // Auth
  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await this.setToken(res.token);
    return res;
  }

  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    await this.setToken(res.token);
    return res;
  }

  async getMe(): Promise<{ user: User }> {
    const data = await this.request<any>('/api/v1/auth/me');
    const user = data?.user || data;
    return { user };
  }

  // Calendar
  async getEvents(): Promise<Event[]> {
    const res = await this.request<Event[]>('/api/v1/events');
    return res || [];
  }

  async createEvent(event: { title: string; description?: string; location?: string; start_at: string; end_at: string; recurrence?: string }) {
    return this.request<{ event: Event; conflict?: ConflictInfo }>('/api/v1/events', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  async updateEvent(id: string, eventData: Partial<Event> & { update_series?: boolean }): Promise<{ event: Event; updated_count: number }> {
    return this.request<{ event: Event; updated_count: number }>(`/api/v1/events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(eventData),
    });
  }

  async deleteEvent(id: string, allSeries: boolean = false) {
    const query = allSeries ? '?all_series=true' : '';
    return this.request<void>(`/api/v1/events/${id}${query}`, { method: 'DELETE' });
  }

  async syncCalendar(provider: string = 'google'): Promise<{ status: string; provider: string }> {
    return this.post<{ status: string; provider: string }>(`/api/v1/integrations/calendars/${provider}/sync`, {});
  }

  // Todos
  async getTodos(status?: string): Promise<Todo[]> {
    const query = status ? `?status=${status}` : '';
    const res = await this.request<Todo[]>(`/api/v1/todos${query}`);
    return res || [];
  }

  async createTodo(todo: { title: string; priority?: string; due_date?: string; event_id?: string; event_title?: string }): Promise<Todo> {
    return this.request<Todo>('/api/v1/todos', {
      method: 'POST',
      body: JSON.stringify(todo),
    });
  }

  async completeTodo(id: string): Promise<{ status: string }> {
    return this.request<{ status: string }>(`/api/v1/todos/${id}/complete`, {
      method: 'PATCH',
    });
  }

  async deleteTodo(id: string): Promise<void> {
    return this.request<void>(`/api/v1/todos/${id}`, { method: 'DELETE' });
  }

  async addSubtask(todoId: string, title: string): Promise<import('../types').Subtask> {
    return this.request<import('../types').Subtask>(`/api/v1/todos/${todoId}/subtasks`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  }

  async toggleSubtask(todoId: string, subtaskId: string): Promise<import('../types').Subtask> {
    return this.request<import('../types').Subtask>(`/api/v1/todos/${todoId}/subtasks/${subtaskId}/toggle`, {
      method: 'PATCH',
    });
  }

  async deleteSubtask(todoId: string, subtaskId: string): Promise<void> {
    return this.request<void>(`/api/v1/todos/${todoId}/subtasks/${subtaskId}`, {
      method: 'DELETE',
    });
  }

  private getUserTimezone(): string {
    try {
      const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const offsetMinutes = new Date().getTimezoneOffset();
      // No motor Hermes no Android, resolved frequentemente retorna 'UTC' ou 'Etc/UTC'
      // mesmo quando o dispositivo está no Brasil (offset 180 = UTC-3).
      if (!resolved || resolved === 'UTC' || resolved === 'Etc/UTC') {
        if (offsetMinutes === 180) return 'America/Sao_Paulo';
        if (offsetMinutes === 240) return 'America/Manaus';
        if (offsetMinutes === 120) return 'America/Noronha';
        if (offsetMinutes === 300) return 'America/Rio_Branco';
        return 'America/Sao_Paulo';
      }
      return resolved;
    } catch {
      return 'America/Sao_Paulo';
    }
  }

  private getCurrentLocalTimeISO(): string {
    const now = new Date();
    const tzo = -now.getTimezoneOffset();
    const dif = tzo >= 0 ? '+' : '-';
    const pad = (num: number) => (num < 10 ? '0' : '') + num;
    return (
      now.getFullYear() +
      '-' +
      pad(now.getMonth() + 1) +
      '-' +
      pad(now.getDate()) +
      'T' +
      pad(now.getHours()) +
      ':' +
      pad(now.getMinutes()) +
      ':' +
      pad(now.getSeconds()) +
      dif +
      pad(Math.floor(Math.abs(tzo) / 60)) +
      ':' +
      pad(Math.abs(tzo) % 60)
    );
  }

  // Assistant Chat
  async assistantChat(prompt: string, timezone?: string): Promise<AssistantChatResponse> {
    const tz = timezone || this.getUserTimezone();
    const currentLocalTime = this.getCurrentLocalTimeISO();
    return this.request<AssistantChatResponse>('/api/v1/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({ prompt, timezone: tz, current_local_time: currentLocalTime }),
    });
  }

  // Assistant Audio (Groq Whisper v3 + Gemini Fallback)
  async assistantAudio(audioUri: string, filename: string = 'audio.m4a', timezone?: string): Promise<AssistantChatResponse> {
    const tz = timezone || this.getUserTimezone();
    const currentLocalTime = this.getCurrentLocalTimeISO();

    // 1. Prioriza envio resiliente em JSON com Base64 (imune a quebras de FormData no Android/Hermes)
    try {
      const b64 = await fileUriToBase64(audioUri);
      if (b64 && b64.length > 0) {
        return await this.request<AssistantChatResponse>('/api/v1/assistant/audio', {
          method: 'POST',
          body: JSON.stringify({
            audio_b64: b64,
            audio_mime: 'audio/m4a',
            filename,
            timezone: tz,
            current_local_time: currentLocalTime,
          }),
        });
      }
    } catch (b64Err) {
      console.warn('[assistantAudio] Falha ao converter áudio para base64, tentando multipart:', b64Err);
    }

    // 2. Fallback Multipart Normalizado
    const cleanUri =
      Platform.OS === 'android' && !audioUri.startsWith('file://') && !audioUri.startsWith('content://')
        ? `file://${audioUri}`
        : audioUri;

    const formData = new FormData();
    formData.append('audio', {
      uri: cleanUri,
      name: filename,
      type: 'audio/m4a',
    } as unknown as Blob);
    formData.append('timezone', tz);
    formData.append('current_local_time', currentLocalTime);

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/assistant/audio`, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro HTTP ${res.status}`);
      }

      return res.json();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Tempo limite esgotado (60s) ao processar áudio no servidor (${this.baseUrl}).`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Assistant Vision (Gemini 2.5 Flash Multimodal)
  async assistantVision(
    imageUri: string,
    prompt?: string,
    filename: string = 'image.jpg',
    timezone?: string,
    base64Override?: string
  ): Promise<AssistantChatResponse> {
    const tz = timezone || this.getUserTimezone();
    const currentLocalTime = this.getCurrentLocalTimeISO();
    const mimeType = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';

    // 1. Prioriza envio resiliente em JSON com Base64 (elimina falhas nativas de stream de arquivos)
    try {
      const b64 = base64Override || (await fileUriToBase64(imageUri));
      if (b64 && b64.length > 0) {
        return await this.request<AssistantChatResponse>('/api/v1/assistant/vision', {
          method: 'POST',
          body: JSON.stringify({
            image_b64: b64,
            image_mime: mimeType,
            prompt,
            timezone: tz,
            current_local_time: currentLocalTime,
          }),
        });
      }
    } catch (b64Err) {
      console.warn('[assistantVision] Falha ao converter imagem para base64, tentando multipart:', b64Err);
    }

    // 2. Fallback Multipart Normalizado
    const cleanUri =
      Platform.OS === 'android' && !imageUri.startsWith('file://') && !imageUri.startsWith('content://')
        ? `file://${imageUri}`
        : imageUri;

    const formData = new FormData();
    formData.append('image', {
      uri: cleanUri,
      name: filename,
      type: mimeType,
    } as unknown as Blob);

    if (prompt) {
      formData.append('prompt', prompt);
    }
    formData.append('timezone', tz);
    formData.append('current_local_time', currentLocalTime);

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/assistant/vision`, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro HTTP ${res.status}`);
      }

      return res.json();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Tempo limite esgotado (60s) ao processar imagem no servidor (${this.baseUrl}).`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Notificações Push
  async registerPushToken(token: string, platform: string = 'expo'): Promise<{ status: string; token: string }> {
    return this.request<{ status: string; token: string }>('/api/v1/notifications/device-token', {
      method: 'POST',
      body: JSON.stringify({ token, platform }),
    });
  }

  async testPushNotification(priority: 'default' | 'silent' = 'default', title?: string, body?: string): Promise<{ status: string; dispatched: number }> {
    return this.request<{ status: string; dispatched: number }>('/api/v1/notifications/test', {
      method: 'POST',
      body: JSON.stringify({ priority, title, body }),
    });
  }

  // Disparadores / Triggers
  async getTriggers(category?: TriggerCategory, status?: TriggerStatus): Promise<Trigger[]> {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (status) params.append('status', status);
    const qs = params.toString();
    return this.request<Trigger[]>(`/api/v1/triggers${qs ? `?${qs}` : ''}`);
  }

  async getTrigger(id: string): Promise<Trigger> {
    return this.request<Trigger>(`/api/v1/triggers/${id}`);
  }

  async createTrigger(input: CreateTriggerInput): Promise<Trigger> {
    return this.request<Trigger>('/api/v1/triggers', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async toggleTrigger(id: string): Promise<Trigger> {
    return this.request<Trigger>(`/api/v1/triggers/${id}/toggle`, {
      method: 'PATCH',
    });
  }

  async updateTrigger(id: string, input: Partial<CreateTriggerInput> & { status?: TriggerStatus; scheduled_time?: string; days_of_week?: string }): Promise<Trigger> {
    return this.request<Trigger>(`/api/v1/triggers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  async testTrigger(id: string): Promise<TriggerTestResult> {
    return this.request<TriggerTestResult>(`/api/v1/triggers/${id}/test`, {
      method: 'POST',
    });
  }

  async runTrigger(id: string): Promise<TriggerLog> {
    return this.request<TriggerLog>(`/api/v1/triggers/${id}/run`, {
      method: 'POST',
    });
  }

  async deleteTrigger(id: string): Promise<void> {
    await this.request<void>(`/api/v1/triggers/${id}`, {
      method: 'DELETE',
    });
  }

  async parseTriggerPrompt(prompt: string): Promise<{
    category: TriggerCategory;
    suggested_title: string;
    query: string;
    condition_type: string;
  }> {
    return this.request('/api/v1/triggers/parse', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  }

  async getTriggerLogs(id: string): Promise<TriggerLog[]> {
    return this.request<TriggerLog[]>(`/api/v1/triggers/${id}/logs`);
  }
}

export const api = new ApiService();

