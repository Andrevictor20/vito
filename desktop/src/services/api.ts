import { User, AuthTokens, CalendarEvent, Todo, Trigger, TriggerLog, BookingType, Meeting, WhatsAppStatus, GmailStatus, SessionDevice } from '../types';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '';

class ApiService {
  private accessToken: string | null = null;
  private isRefreshing = false;
  private refreshSubscribers: Array<(token: string) => void> = [];

  constructor() {
    this.accessToken = localStorage.getItem('vito_access_token') || sessionStorage.getItem('vito_access_token');
  }

  public setTokens(accessToken: string, refreshToken?: string) {
    this.accessToken = accessToken;
    localStorage.setItem('vito_access_token', accessToken);
    sessionStorage.setItem('vito_access_token', accessToken);
    if (refreshToken) {
      localStorage.setItem('vito_refresh_token', refreshToken);
    }
  }

  public clearTokens() {
    this.accessToken = null;
    localStorage.removeItem('vito_access_token');
    sessionStorage.removeItem('vito_access_token');
    localStorage.removeItem('vito_refresh_token');
  }

  public getRefreshToken(): string | null {
    return localStorage.getItem('vito_refresh_token');
  }

  public isAuthenticated(): boolean {
    return !!this.accessToken || !!this.getRefreshToken();
  }

  private onRefreshed(token: string) {
    this.refreshSubscribers.forEach((cb) => cb(token));
    this.refreshSubscribers = [];
  }

  private subscribeTokenRefresh(cb: (token: string) => void) {
    this.refreshSubscribers.push(cb);
  }

  private async refreshAccessToken(): Promise<string> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('Sem refresh token disponível');
    }

    const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      this.clearTokens();
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    const data = await res.json();
    this.setTokens(data.access_token, data.refresh_token);
    return data.access_token;
  }

  public async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    const headers = new Headers(options.headers || {});

    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    if (this.accessToken) {
      headers.set('Authorization', `Bearer ${this.accessToken}`);
    }

    let response = await fetch(url, { ...options, headers });

    // Interceptor 401 com renovação Dual Token
    if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
      if (!this.isRefreshing) {
        this.isRefreshing = true;
        try {
          const newToken = await this.refreshAccessToken();
          this.isRefreshing = false;
          this.onRefreshed(newToken);
        } catch (err) {
          this.isRefreshing = false;
          throw err;
        }
      }

      // Aguarda o término do refresh para retentar a requisição original
      const retryToken = await new Promise<string>((resolve) => {
        this.subscribeTokenRefresh((token) => resolve(token));
      });

      headers.set('Authorization', `Bearer ${retryToken}`);
      response = await fetch(url, { ...options, headers });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.error || errorData.message || `Erro HTTP ${response.status}`;
      throw new Error(message);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  // --- Auth Endpoints ---
  async login(email: string, password: string): Promise<AuthTokens> {
    const data = await this.request<AuthTokens>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setTokens(data.access_token, data.refresh_token);
    return data;
  }

  async register(name: string, email: string, password: string): Promise<AuthTokens> {
    const data = await this.request<AuthTokens>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    this.setTokens(data.access_token, data.refresh_token);
    return data;
  }

  async logout(): Promise<void> {
    try {
      const refreshToken = this.getRefreshToken();
      await this.request('/api/v1/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } finally {
      this.clearTokens();
    }
  }

  async getMe(): Promise<User> {
    const res = await this.request<any>('/api/v1/auth/me');
    return res.user || res;
  }

  async requestWhatsAppOTP(phone: string): Promise<{ success: boolean; message: string }> {
    return this.request('/api/v1/auth/whatsapp/request-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }

  async verifyWhatsAppOTP(phone: string, code: string): Promise<AuthTokens> {
    const data = await this.request<AuthTokens>('/api/v1/auth/whatsapp/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    });
    this.setTokens(data.access_token, data.refresh_token);
    return data;
  }

  // --- Calendar Endpoints ---
  async getEvents(): Promise<CalendarEvent[]> {
    const res = await this.request<any>('/api/v1/events');
    return Array.isArray(res) ? res : res.events || [];
  }

  async createEvent(event: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const res = await this.request<any>('/api/v1/events', {
      method: 'POST',
      body: JSON.stringify(event),
    });
    return res.event || res;
  }

  async deleteEvent(id: string): Promise<void> {
    return this.request(`/api/v1/events/${id}`, { method: 'DELETE' });
  }

  async syncCalendar(provider: string = 'google'): Promise<{ status: string; provider: string }> {
    return this.request(`/api/v1/integrations/calendars/${provider}/sync`, { method: 'POST' });
  }

  // --- Todos Endpoints ---
  async getTodos(): Promise<Todo[]> {
    const res = await this.request<any>('/api/v1/todos');
    return Array.isArray(res) ? res : res.todos || [];
  }

  async createTodo(todo: Partial<Todo>): Promise<Todo> {
    return this.request('/api/v1/todos', {
      method: 'POST',
      body: JSON.stringify(todo),
    });
  }

  async updateTodo(id: string, updates: Partial<Todo>): Promise<Todo> {
    return this.request(`/api/v1/todos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteTodo(id: string): Promise<void> {
    return this.request(`/api/v1/todos/${id}`, { method: 'DELETE' });
  }

  // --- Assistant Chat & History Endpoints ---
  async askAssistant(prompt: string, context?: any): Promise<{ reply: string; actions?: any[]; event?: CalendarEvent; todo?: Todo }> {
    const res = await this.request<any>('/api/v1/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        text: prompt,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
        ...context,
      }),
    });
    return {
      reply: res.reply || res.message || res.text || '',
      actions: res.actions,
      event: res.event,
      todo: res.todo,
    };
  }

  async getChatSessions(): Promise<any[]> {
    const res = await this.request<any>('/api/v1/chat/sessions');
    return Array.isArray(res) ? res : [];
  }

  async getChatSessionWithMessages(id: string): Promise<{ session: any; messages: any[] } | null> {
    try {
      return await this.request<{ session: any; messages: any[] }>(`/api/v1/chat/sessions/${id}`);
    } catch {
      return null;
    }
  }

  async deleteChatSession(id: string): Promise<void> {
    return this.request(`/api/v1/chat/sessions/${id}`, { method: 'DELETE' });
  }

  async syncChatSession(session: any, messages: any[]): Promise<any> {
    try {
      return await this.request('/api/v1/chat/sync', {
        method: 'POST',
        body: JSON.stringify({ session, messages }),
      });
    } catch {
      return null;
    }
  }

  // --- Triggers / Vigílias ---
  async getTriggers(): Promise<Trigger[]> {
    const res = await this.request<any>('/api/v1/triggers');
    return Array.isArray(res) ? res : res.triggers || [];
  }

  async getTrigger(id: string): Promise<Trigger> {
    return this.request<Trigger>(`/api/v1/triggers/${id}`);
  }

  async createTrigger(input: Partial<Trigger> & { title: string; query: string }): Promise<Trigger> {
    return this.request('/api/v1/triggers', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async updateTrigger(id: string, updates: Partial<Trigger>): Promise<Trigger> {
    return this.request(`/api/v1/triggers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteTrigger(id: string): Promise<void> {
    return this.request(`/api/v1/triggers/${id}`, { method: 'DELETE' });
  }

  async getTriggerLogs(id: string): Promise<TriggerLog[]> {
    const res = await this.request<any>(`/api/v1/triggers/${id}/logs`);
    return Array.isArray(res) ? res : res.logs || [];
  }

  async deleteTriggerLog(triggerId: string, logId: string): Promise<void> {
    return this.request(`/api/v1/triggers/${triggerId}/logs/${logId}`, { method: 'DELETE' });
  }

  async clearTriggerLogs(triggerId: string): Promise<void> {
    return this.request(`/api/v1/triggers/${triggerId}/logs`, { method: 'DELETE' });
  }

  async testTrigger(id: string): Promise<any> {
    return this.request(`/api/v1/triggers/${id}/test`, { method: 'POST' });
  }

  async runTrigger(id: string): Promise<TriggerLog> {
    return this.request(`/api/v1/triggers/${id}/run`, { method: 'POST' });
  }

  async toggleTrigger(id: string, active: boolean): Promise<any> {
    return this.request(`/api/v1/triggers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: active ? 'active' : 'paused' }),
    });
  }

  async getTriggerTemplates(): Promise<any[]> {
    const res = await this.request<any>('/api/v1/triggers/templates');
    return Array.isArray(res) ? res : res.templates || [];
  }

  async activateTriggerTemplate(templateId: string): Promise<Trigger> {
    return this.request(`/api/v1/triggers/templates/${templateId}/activate`, {
      method: 'POST',
    });
  }

  // --- Booking & Meetings ---
  async getBookings(): Promise<BookingType[]> {
    const res = await this.request<any>('/api/v1/booking/types');
    return Array.isArray(res) ? res : res.types || res.booking_types || [];
  }

  async getMeetings(): Promise<Meeting[]> {
    const res = await this.request<any>('/api/v1/meetings');
    return Array.isArray(res) ? res : res.meetings || [];
  }

  // --- Integrations ---
  async getWhatsAppStatus(): Promise<WhatsAppStatus> {
    return this.request('/api/v1/integrations/whatsapp/status');
  }

  async getGmailStatus(): Promise<GmailStatus> {
    return this.request('/api/v1/integrations/gmail/status');
  }

  async getSessions(): Promise<SessionDevice[]> {
    const res = await this.request<any>('/api/v1/auth/sessions');
    return Array.isArray(res) ? res : res.sessions || [];
  }

  async revokeSession(id: string): Promise<void> {
    return this.request(`/api/v1/auth/sessions/${id}`, { method: 'DELETE' });
  }
}

export const api = new ApiService();
