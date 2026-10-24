import { ApiClient } from './client';
import {
  WhatsAppStatus,
  WhatsAppMatchedContact,
  GmailStatus,
  GmailDraftInput,
  GmailDraftResponse,
  GmailSendResponse,
  AISettings,
  MorningBriefingSettings,
} from '../../types';

export class IntegrationsApi {
  constructor(private client: ApiClient) {}

  // --- WhatsApp ---
  async getWhatsAppStatus(): Promise<WhatsAppStatus> {
    return this.client.request<WhatsAppStatus>('/api/v1/integrations/whatsapp/status');
  }

  async requestWhatsAppPairingCode(phone: string): Promise<{ pairing_code: string; status: string }> {
    return this.client.request('/api/v1/integrations/whatsapp/pairing-code', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }

  async disconnectWhatsApp(): Promise<{ message: string; status: string }> {
    return this.client.request('/api/v1/integrations/whatsapp/disconnect', {
      method: 'DELETE',
    });
  }

  async getWhatsAppContacts(): Promise<{ contacts: WhatsAppMatchedContact[]; count: number }> {
    const res = await this.client.request<any>('/api/v1/integrations/whatsapp/contacts');
    return {
      contacts: res.contacts || [],
      count: res.count || (res.contacts ? res.contacts.length : 0),
    };
  }

  async importWhatsAppContactNames(names: { phone: string; name: string }[]): Promise<{ imported: number }> {
    return this.client.request('/api/v1/integrations/whatsapp/contact-names', {
      method: 'POST',
      body: JSON.stringify({ contacts: names }),
    });
  }

  // --- Gmail ---
  async getGmailStatus(): Promise<GmailStatus> {
    return this.client.request<GmailStatus>('/api/v1/integrations/gmail/status');
  }

  async scanGmail(params?: { days?: number; limit?: number }): Promise<any> {
    return this.client.request('/api/v1/integrations/gmail/scan', {
      method: 'POST',
      body: JSON.stringify(params || {}),
    });
  }

  async disconnectGmail(): Promise<{ message: string }> {
    return this.client.request('/api/v1/integrations/gmail/disconnect', {
      method: 'DELETE',
    });
  }

  async createGmailDraft(draft: GmailDraftInput): Promise<GmailDraftResponse> {
    return this.client.request<GmailDraftResponse>('/api/v1/integrations/gmail/draft', {
      method: 'POST',
      body: JSON.stringify(draft),
    });
  }

  async sendGmailEmail(email: GmailDraftInput): Promise<GmailSendResponse> {
    return this.client.request<GmailSendResponse>('/api/v1/integrations/gmail/send', {
      method: 'POST',
      body: JSON.stringify(email),
    });
  }

  // --- AI Settings & Morning Briefing ---
  async getAISettings(): Promise<AISettings> {
    const res = await this.client.request<any>('/api/v1/users/ai-settings');
    return res.settings || res;
  }

  async updateAISettings(data: Partial<AISettings>): Promise<AISettings> {
    return this.client.request<AISettings>('/api/v1/users/ai-settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getBriefingSettings(): Promise<MorningBriefingSettings> {
    const res = await this.client.request<any>('/api/v1/users/briefing');
    return res.settings || res;
  }

  async updateBriefingSettings(data: Partial<MorningBriefingSettings>): Promise<MorningBriefingSettings> {
    return this.client.request<MorningBriefingSettings>('/api/v1/users/briefing', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // --- Notifications ---
  async getNotificationStatus(): Promise<{ registered: boolean; device_count: number }> {
    return this.client.request('/api/v1/notifications/status');
  }

  async registerDeviceToken(token: string, platform = 'web'): Promise<{ status: string }> {
    return this.client.request('/api/v1/notifications/device-token', {
      method: 'POST',
      body: JSON.stringify({ token, platform }),
    });
  }

  async testNotification(priority = 'default', title?: string, body?: string): Promise<any> {
    return this.client.request('/api/v1/notifications/test', {
      method: 'POST',
      body: JSON.stringify({ priority, title, body }),
    });
  }
}
