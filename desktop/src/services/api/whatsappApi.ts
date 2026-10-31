import { ApiClient } from './client';

export interface WhatsAppIntegrationStatus {
  id?: string;
  status: 'disconnected' | 'connecting' | 'connected' | string;
  phone?: string;
  pairing_code?: string;
  last_connected_at?: string;
}

export interface WhatsAppMatchedContact {
  phone: string;
  name?: string;
  push_name?: string;
  is_saved: boolean;
}

export class WhatsAppApi {
  constructor(private client: ApiClient) {}

  async getStatus(): Promise<WhatsAppIntegrationStatus> {
    return this.client.request<WhatsAppIntegrationStatus>('/api/v1/integrations/whatsapp/status');
  }

  async requestPairingCode(phone: string): Promise<{ pairing_code: string; status: string }> {
    return this.client.request<{ pairing_code: string; status: string }>('/api/v1/integrations/whatsapp/pairing-code', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }

  async disconnect(): Promise<{ message: string; status: string }> {
    return this.client.request<{ message: string; status: string }>('/api/v1/integrations/whatsapp/disconnect', {
      method: 'DELETE',
    });
  }

  async getContacts(): Promise<{ contacts: WhatsAppMatchedContact[]; count: number }> {
    const res = await this.client.request<any>('/api/v1/integrations/whatsapp/contacts');
    return {
      contacts: res.contacts || [],
      count: res.count || (res.contacts ? res.contacts.length : 0),
    };
  }
}
