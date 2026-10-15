import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStorage } from './secureStore';
import { isAbortLike, AI_ENDPOINT_TIMEOUT_MS } from '../utils/requestTimeout';
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
  MorningBriefingSettings,
  AutonomyMode,
  AISettings,
  PendingItem,
  PendingStatus,
  CreatePendingInput,
  UpdatePendingInput,
  BookingType,
  BookingAppointment,
  CreateBookingTypeInput,
  DeleteBookingImpact,
  ChatMessage,
  ConversationSession,
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
// Servidor único: sempre a nuvem. O fallback hardcoded protege builds geradas
// sem .env (EAS cloud), que antes caíam em http://localhost:8180 e quebravam
// o app no Android (CLEARTEXT + host errado).
export const PI_SERVER_URL = process.env.EXPO_PUBLIC_LOCAL_SERVER_URL || '';
export const CLOUDFLARE_SERVER_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://vito.rasppi.cloud';
export const DEFAULT_SERVER_URL = CLOUDFLARE_SERVER_URL;

export const isCloudServer = (url: string): boolean => {
  return url === CLOUDFLARE_SERVER_URL || (!url.includes('192.168.') && !url.includes('localhost') && !url.includes('127.0.0.1'));
};

export interface ApiRequestOptions extends RequestInit {
  /** Timeout por chamada (ms); padrão 15s (60s em IA/integrações). */
  timeoutMs?: number;
}

export interface ChatHistoryItem {
  sender: 'user' | 'vito';
  text: string;
}

export interface AssistantChatOptions {
  timezone?: string;
  history?: ChatHistoryItem[];
  signal?: AbortSignal;
}

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
      // Sempre a nuvem: mesmo backend no celular e no computador.
      this.baseUrl = CLOUDFLARE_SERVER_URL;
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

  private async request<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
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

  async createTodo(todo: { title: string; priority?: string; category?: string; due_date?: string; remind_at?: string; remind_repeat?: string; remind_advance_minutes?: number; event_id?: string; event_title?: string }): Promise<Todo> {
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

  async reopenTodo(id: string): Promise<{ status: string }> {
    return this.request<{ status: string }>(`/api/v1/todos/${id}/reopen`, {
      method: 'PATCH',
    });
  }

  async deleteTodo(id: string): Promise<void> {
    return this.request<void>(`/api/v1/todos/${id}`, { method: 'DELETE' });
  }

  async updateTodo(id: string, data: { title?: string; priority?: string; category?: string; due_date?: string; remind_at?: string; remind_repeat?: string; remind_advance_minutes?: number }): Promise<Todo> {
    return this.request<Todo>(`/api/v1/todos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
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
  async assistantChat(
    prompt: string,
    options?: string | AssistantChatOptions
  ): Promise<AssistantChatResponse> {
    const opts: AssistantChatOptions =
      typeof options === 'string' ? { timezone: options } : options || {};
    const tz = opts.timezone || this.getUserTimezone();
    const currentLocalTime = this.getCurrentLocalTimeISO();
    return this.request<AssistantChatResponse>('/api/v1/assistant/chat', {
      method: 'POST',
      signal: opts.signal,
      body: JSON.stringify({
        prompt,
        timezone: tz,
        current_local_time: currentLocalTime,
        history: opts.history,
      }),
    });
  }

  // Assistant Audio (Groq Whisper v3 + Gemini Fallback)
  async assistantAudio(
    audioUri: string,
    filename: string = 'audio.m4a',
    options?: string | AssistantChatOptions
  ): Promise<AssistantChatResponse> {
    const opts: AssistantChatOptions =
      typeof options === 'string' ? { timezone: options } : options || {};
    const tz = opts.timezone || this.getUserTimezone();
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
            history: opts.history,
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

  async revokePushToken(token: string): Promise<{ status: string; token: string }> {
    return this.request<{ status: string; token: string }>('/api/v1/notifications/device-token', {
      method: 'DELETE',
      body: JSON.stringify({ token }),
    });
  }


  async testPushNotification(priority: 'default' | 'silent' = 'default', title?: string, body?: string): Promise<{ status: string; dispatched: number }> {
    return this.request<{ status: string; dispatched: number }>('/api/v1/notifications/test', {
      method: 'POST',
      body: JSON.stringify({ priority, title, body }),
    });
  }

  // Briefing Matinal Proativo
  async getBriefingSettings(): Promise<MorningBriefingSettings> {
    return this.request<MorningBriefingSettings>('/api/v1/users/briefing', {
      method: 'GET',
    });
  }

  async updateBriefingSettings(data: Partial<MorningBriefingSettings>): Promise<MorningBriefingSettings> {
    return this.request<MorningBriefingSettings>('/api/v1/users/briefing', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Autonomia e Configurações de IA (Sprint 8)
  async getAISettings(): Promise<AISettings> {
    return this.request<AISettings>('/api/v1/users/ai-settings', {
      method: 'GET',
    });
  }

  async updateAISettings(data: {
    autonomy_mode?: AutonomyMode;
    auto_focus_blocks?: boolean;
  }): Promise<AISettings> {
    return this.request<AISettings>('/api/v1/users/ai-settings', {
      method: 'PUT',
      body: JSON.stringify(data),
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
      timeoutMs: AI_ENDPOINT_TIMEOUT_MS,
    });
  }

  async runTrigger(id: string): Promise<TriggerLog> {
    return this.request<TriggerLog>(`/api/v1/triggers/${id}/run`, {
      method: 'POST',
      timeoutMs: AI_ENDPOINT_TIMEOUT_MS,
    });
  }

  async deleteTrigger(id: string): Promise<void> {
    await this.request<void>(`/api/v1/triggers/${id}`, {
      method: 'DELETE',
    });
  }

  async deleteTriggerLog(triggerId: string, logId: string): Promise<void> {
    await this.request<void>(`/api/v1/triggers/${triggerId}/logs/${logId}`, {
      method: 'DELETE',
    });
  }

  async clearTriggerLogs(triggerId: string): Promise<void> {
    await this.request<void>(`/api/v1/triggers/${triggerId}/logs`, {
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

  // ==========================================
  // Pendências (Sprint 9)
  // ==========================================

  async getPendingItems(status?: PendingStatus, category?: string): Promise<PendingItem[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (category) params.append('category', category);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<PendingItem[]>(`/api/v1/pending${qs}`);
  }

  async createPendingItem(data: CreatePendingInput): Promise<PendingItem> {
    return this.request<PendingItem>('/api/v1/pending', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPendingItem(id: string): Promise<PendingItem> {
    return this.request<PendingItem>(`/api/v1/pending/${id}`);
  }

  async updatePendingItem(id: string, data: UpdatePendingInput): Promise<PendingItem> {
    return this.request<PendingItem>(`/api/v1/pending/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async schedulePendingItem(id: string, scheduledDate: string): Promise<PendingItem> {
    return this.request<PendingItem>(`/api/v1/pending/${id}/schedule`, {
      method: 'POST',
      body: JSON.stringify({ scheduled_date: scheduledDate }),
    });
  }

  async completePendingItem(id: string): Promise<PendingItem> {
    return this.request<PendingItem>(`/api/v1/pending/${id}/complete`, {
      method: 'POST',
    });
  }

  async deletePendingItem(id: string): Promise<void> {
    await this.request<void>(`/api/v1/pending/${id}`, {
      method: 'DELETE',
    });
  }

  // ==========================================
  // Vito Booking (Sprint 10)
  // ==========================================

  async getBookingTypes(): Promise<BookingType[]> {
    const res = await this.request<BookingType[]>('/api/v1/booking/types');
    return Array.isArray(res) ? res : [];
  }

  async createBookingType(data: CreateBookingTypeInput): Promise<BookingType> {
    return this.request<BookingType>('/api/v1/booking/types', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBookingType(id: string, data: Partial<BookingType>): Promise<BookingType> {
    return this.request<BookingType>(`/api/v1/booking/types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteBookingType(id: string): Promise<DeleteBookingImpact> {
    const res = await this.request<DeleteBookingImpact>(`/api/v1/booking/types/${id}`, {
      method: 'DELETE',
    });
    if (res && typeof res.deleted_appointments === 'number') return res;
    return { deleted_appointments: 0, deleted_events: 0 };
  }

  async getBookingAppointments(): Promise<BookingAppointment[]> {
    const res = await this.request<BookingAppointment[]>('/api/v1/booking/appointments');
    return Array.isArray(res) ? res : [];
  }

  async deleteBookingAppointment(id: string): Promise<void> {
    await this.request<void>(`/api/v1/booking/appointments/${id}`, {
      method: 'DELETE',
    });
  }

  // Chat Multi-Device Synchronization
  async getChatSessions(): Promise<ConversationSession[]> {
    const res = await this.request<any[]>('/api/v1/chat/sessions');
    return Array.isArray(res) ? res : [];
  }

  async getChatSessionWithMessages(id: string): Promise<{ session: ConversationSession; messages: ChatMessage[] } | null> {
    try {
      return await this.request<{ session: ConversationSession; messages: ChatMessage[] }>(`/api/v1/chat/sessions/${id}`);
    } catch {
      return null;
    }
  }

  async syncChatSession(session: ConversationSession, messages: ChatMessage[]): Promise<any> {
    try {
      return await this.request('/api/v1/chat/sync', {
        method: 'POST',
        body: JSON.stringify({
          session: {
            id: session.id,
            title: session.title,
            preview: session.preview,
            created_at: session.timestamp,
            updated_at: new Date().toISOString(),
          },
          messages: messages.map((m) => ({
            id: m.id,
            session_id: session.id,
            sender: m.sender,
            text: m.text,
            timestamp: m.timestamp,
            image_uri: m.imageUri,
            action_performed: m.action_performed,
          })),
        }),
      });
    } catch {
      return null;
    }
  }

  async deleteChatSession(id: string): Promise<void> {
    try {
      await this.request<void>(`/api/v1/chat/sessions/${id}`, {
        method: 'DELETE',
      });
    } catch {
      // Silencioso
    }
  }
}

export const api = new ApiService();

