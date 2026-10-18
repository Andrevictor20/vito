import { ApiClient } from './client';

export interface WhatsAppIntegrationStatus {
  id?: string;
  status: 'disconnected' | 'connecting' | 'connected';
  phone?: string;
  pairing_code?: string;
  last_connected_at?: string;
}

export class WhatsAppApi {
  constructor(private client: ApiClient) {}

  async getStatus(): Promise<WhatsAppIntegrationStatus> {
    return this.client.request<WhatsAppIntegrationStatus>('/integrations/whatsapp/status');
  }

  async requestPairingCode(phone: string): Promise<{ pairing_code: string; status: string }> {
    return this.client.request<{ pairing_code: string; status: string }>('/integrations/whatsapp/pairing-code', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }

  async disconnect(): Promise<{ message: string; status: string }> {
    return this.client.request<{ message: string; status: string }>('/integrations/whatsapp/disconnect', {
      method: 'DELETE',
    });
  }
}
