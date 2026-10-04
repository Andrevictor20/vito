import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStorage } from './secureStore';
import { User, AuthResponse, Event, Todo, AssistantChatResponse, ConflictInfo } from '../types';

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

  async createEvent(event: { title: string; description?: string; location?: string; start_at: string; end_at: string }) {
    return this.request<{ event: Event; conflict?: ConflictInfo }>('/api/v1/events', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  async deleteEvent(id: string) {
    return this.request<void>(`/api/v1/events/${id}`, { method: 'DELETE' });
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

  async createTodo(todo: { title: string; priority: string; due_date?: string }): Promise<Todo> {
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

  // Assistant Chat
  async assistantChat(prompt: string, timezone: string = 'America/Sao_Paulo'): Promise<AssistantChatResponse> {
    return this.request<AssistantChatResponse>('/api/v1/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({ prompt, timezone }),
    });
  }

  // Assistant Audio (Groq Whisper v3)
  async assistantAudio(audioUri: string, filename: string = 'audio.m4a'): Promise<AssistantChatResponse> {
    const formData = new FormData();
    formData.append('audio', {
      uri: audioUri,
      name: filename,
      type: 'audio/m4a',
    } as unknown as Blob);

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
  async assistantVision(imageUri: string, prompt?: string, filename: string = 'image.jpg'): Promise<AssistantChatResponse> {
    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      name: filename,
      type: 'image/jpeg',
    } as unknown as Blob);

    if (prompt) {
      formData.append('prompt', prompt);
    }
    formData.append('timezone', 'America/Sao_Paulo');

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

  async testPushNotification(priority: 'default' | 'wakeup' | 'silent' = 'default', title?: string, body?: string): Promise<{ status: string; dispatched: number }> {
    return this.request<{ status: string; dispatched: number }>('/api/v1/notifications/test', {
      method: 'POST',
      body: JSON.stringify({ priority, title, body }),
    });
  }
}

export const api = new ApiService();

