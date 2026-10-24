import { ApiClient, getDesktopDeviceName } from './client';
import { User, AuthTokens, SessionDevice } from '../../types';

export class AuthApi {
  constructor(private client: ApiClient) {}

  async login(email: string, password: string, deviceName?: string): Promise<AuthTokens> {
    const res = await this.client.request<AuthTokens>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        device_name: deviceName || getDesktopDeviceName(),
      }),
    });
    this.client.setTokens(res.access_token, res.refresh_token, res.session_id);
    return res;
  }

  async register(name: string, email: string, password: string, deviceName?: string): Promise<AuthTokens> {
    const res = await this.client.request<AuthTokens>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        password,
        device_name: deviceName || getDesktopDeviceName(),
      }),
    });
    this.client.setTokens(res.access_token, res.refresh_token, res.session_id);
    return res;
  }

  async logout(): Promise<void> {
    try {
      await this.client.request('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // Ignora erro no backend e limpa tokens locais
    } finally {
      this.client.clearTokens();
    }
  }

  async getMe(): Promise<User> {
    const res = await this.client.request<any>('/api/v1/auth/me');
    return res.user || res;
  }

  async getSessions(): Promise<SessionDevice[]> {
    const res = await this.client.request<any>('/api/v1/auth/sessions');
    return Array.isArray(res) ? res : res.sessions || [];
  }

  async revokeSession(id: string): Promise<void> {
    await this.client.request(`/api/v1/auth/sessions/${id}`, { method: 'DELETE' });
  }

  async requestWhatsAppOTP(phone: string): Promise<{ success: boolean; message: string }> {
    return this.client.request('/api/v1/auth/whatsapp/request-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }

  async verifyWhatsAppOTP(phone: string, code: string, deviceName?: string): Promise<AuthTokens> {
    const res = await this.client.request<AuthTokens>('/api/v1/auth/whatsapp/verify-otp', {
      method: 'POST',
      body: JSON.stringify({
        phone,
        code,
        device_name: deviceName || getDesktopDeviceName(),
      }),
    });
    this.client.setTokens(res.access_token, res.refresh_token, res.session_id);
    return res;
  }

  async linkWhatsAppPhone(phone: string): Promise<{ data: { status: string; message: string } }> {
    return this.client.request('/api/v1/auth/whatsapp/link-phone', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }
}
