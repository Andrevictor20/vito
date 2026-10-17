import { ApiClient } from './client';
import { User, AuthResponse, UserSession } from '../../types';

export class AuthApi {
  constructor(private client: ApiClient) {}

  async login(email: string, password: string, deviceName?: string): Promise<AuthResponse> {
    const res = await this.client.request<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, device_name: deviceName }),
    });
    if (typeof (this.client as any).setAuthTokens === 'function') {
      await (this.client as any).setAuthTokens(res.access_token || res.token, res.refresh_token, res.session_id);
    } else {
      await this.client.setToken(res.access_token || res.token);
    }
    return res;
  }

  async register(name: string, email: string, password: string, deviceName?: string): Promise<AuthResponse> {
    const res = await this.client.request<AuthResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, device_name: deviceName }),
    });
    if (typeof (this.client as any).setAuthTokens === 'function') {
      await (this.client as any).setAuthTokens(res.access_token || res.token, res.refresh_token, res.session_id);
    } else {
      await this.client.setToken(res.access_token || res.token);
    }
    return res;
  }

  async getMe(): Promise<{ user: User }> {
    const data = await this.client.request<any>('/api/v1/auth/me');
    const user = data?.user || data;
    return { user };
  }

  async getSessions(): Promise<{ sessions: UserSession[]; current_session_id: string }> {
    const data = await this.client.request<any>('/api/v1/auth/sessions', { method: 'GET' });
    return {
      sessions: Array.isArray(data?.sessions) ? data.sessions : [],
      current_session_id: data?.current_session_id || this.client.getSessionId?.() || '',
    };
  }

  async revokeSession(sessionId: string): Promise<{ status: string }> {
    return this.client.request<{ status: string }>(`/api/v1/auth/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
  }

  async revokeOtherSessions(): Promise<{ status: string }> {
    return this.client.request<{ status: string }>('/api/v1/auth/sessions/others', {
      method: 'DELETE',
    });
  }

  async logoutSession(): Promise<{ status: string }> {
    const refreshToken = this.client.getRefreshToken?.() || undefined;
    return this.client.request<{ status: string }>('/api/v1/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  }
}
