import { ApiClient } from './client';
import {
  MorningBriefingSettings,
  AISettings,
  AutonomyMode,
} from '../../types';

export class NotificationsApi {
  constructor(private client: ApiClient) {}

  async registerPushToken(token: string, platform: string = 'expo'): Promise<{ status: string; token: string }> {
    return this.client.request<{ status: string; token: string }>('/api/v1/notifications/device-token', {
      method: 'POST',
      body: JSON.stringify({ token, platform }),
    });
  }

  async revokePushToken(token: string): Promise<{ status: string; token: string }> {
    return this.client.request<{ status: string; token: string }>('/api/v1/notifications/device-token', {
      method: 'DELETE',
      body: JSON.stringify({ token }),
    });
  }

  async getNotificationStatus(): Promise<{ registered: boolean; device_count: number }> {
    return this.client.request<{ registered: boolean; device_count: number }>('/api/v1/notifications/status', {
      method: 'GET',
    });
  }

  async testPushNotification(
    priority: 'default' | 'silent' = 'default',
    title?: string,
    body?: string
  ): Promise<{ status: string; dispatched: number }> {
    return this.client.request<{ status: string; dispatched: number }>('/api/v1/notifications/test', {
      method: 'POST',
      body: JSON.stringify({ priority, title, body }),
    });
  }

  async getBriefingSettings(): Promise<MorningBriefingSettings> {
    return this.client.request<MorningBriefingSettings>('/api/v1/users/briefing', {
      method: 'GET',
    });
  }

  async updateBriefingSettings(data: Partial<MorningBriefingSettings>): Promise<MorningBriefingSettings> {
    return this.client.request<MorningBriefingSettings>('/api/v1/users/briefing', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getAISettings(): Promise<AISettings> {
    return this.client.request<AISettings>('/api/v1/users/ai-settings', {
      method: 'GET',
    });
  }

  async updateAISettings(data: {
    autonomy_mode?: AutonomyMode;
    auto_focus_blocks?: boolean;
    persona_style?: string;
    preferred_voice?: string;
  }): Promise<AISettings> {
    return this.client.request<AISettings>('/api/v1/users/ai-settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
}
