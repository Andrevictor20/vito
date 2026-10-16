import { ApiClient } from './client';
import { User, AuthResponse } from '../../types';

export class AuthApi {
  constructor(private client: ApiClient) {}

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await this.client.request<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await this.client.setToken(res.token);
    return res;
  }

  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    const res = await this.client.request<AuthResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    await this.client.setToken(res.token);
    return res;
  }

  async getMe(): Promise<{ user: User }> {
    const data = await this.client.request<any>('/api/v1/auth/me');
    const user = data?.user || data;
    return { user };
  }
}
