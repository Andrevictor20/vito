import { ApiClient } from './client';

export type WhatsAppContextScope = 'off' | 'quoted' | 'chat' | 'all';

export interface WhatsAppContextSettings {
  scope: WhatsAppContextScope;
  window_size: number;
}

export const WHATSAPP_CONTEXT_SCOPES: { value: WhatsAppContextScope; label: string; hint: string }[] = [
  { value: 'off', label: 'Desligado', hint: 'O Vito não recebe nenhum contexto do WhatsApp.' },
  {
    value: 'quoted',
    label: 'Só a mensagem citada',
    hint: 'O Vito enxerga apenas a mensagem que você apontou ou respondeu.',
  },
  {
    value: 'chat',
    label: 'Esta conversa',
    hint: 'O Vito enxerga as últimas mensagens da conversa em que você está falando com ele.',
  },
  {
    value: 'all',
    label: 'Todos os meus chats',
    hint: 'O Vito também enxerga o que você falou em outros chats. Vale no chat "Você" e em grupos só seus; em grupos com outras pessoas e chats de terceiros, ele nunca usa outros chats.',
  },
];

export const WHATSAPP_CONTEXT_WINDOW_SIZES = [6, 12, 24, 48];

export class WhatsAppContextApi {
  constructor(private client: ApiClient) {}

  async getSettings(): Promise<WhatsAppContextSettings> {
    return this.client.request<WhatsAppContextSettings>('/api/v1/integrations/whatsapp/context-settings');
  }

  async updateSettings(scope: WhatsAppContextScope, windowSize: number): Promise<WhatsAppContextSettings> {
    return this.client.request<WhatsAppContextSettings>('/api/v1/integrations/whatsapp/context-settings', {
      method: 'PUT',
      body: JSON.stringify({ scope, window_size: windowSize }),
    });
  }

  async purgeMessages(): Promise<{ message: string }> {
    return this.client.request<{ message: string }>('/api/v1/integrations/whatsapp/context-messages', {
      method: 'DELETE',
    });
  }
}
