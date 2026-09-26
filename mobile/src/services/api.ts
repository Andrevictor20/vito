import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthResponse, Event, Todo, AssistantChatResponse } from '../types';

const TOKEN_KEY = '@kito_jwt_token';
const SERVER_URL_KEY = '@kito_server_url';
export const DEFAULT_SERVER_URL = 'http://localhost:8080';
export const CLOUDFLARE_SERVER_URL = 'https://kito.rasppi.cloud';

class ApiService {
  private baseUrl: string = DEFAULT_SERVER_URL;
  private token: string | null = null;

  async init() {
    const savedUrl = await AsyncStorage.getItem(SERVER_URL_KEY);
    if (savedUrl) this.baseUrl = savedUrl;
    this.token = await AsyncStorage.getItem(TOKEN_KEY);
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async setBaseUrl(url: string) {
    this.baseUrl = url;
    await AsyncStorage.setItem(SERVER_URL_KEY, url);
  }

  async setToken(token: string | null) {
    this.token = token;
    if (token) {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } else {
      await AsyncStorage.removeItem(TOKEN_KEY);
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

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg = data?.error || `Erro HTTP ${res.status}`;
      throw new Error(errorMsg);
    }

    return data as T;
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

  async getMe() {
    return this.request<{ user: { id: string; name: string; email: string } }>('/api/v1/auth/me');
  }

  // Calendar
  async getEvents(): Promise<Event[]> {
    const res = await this.request<Event[]>('/api/v1/events');
    return res || [];
  }

  async createEvent(event: { title: string; description?: string; location?: string; start_at: string; end_at: string }) {
    return this.request<{ event: Event; conflict?: any }>('/api/v1/events', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  async deleteEvent(id: string) {
    return this.request<void>(`/api/v1/events/${id}`, { method: 'DELETE' });
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
}

export const api = new ApiService();
