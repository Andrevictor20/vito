import { ApiClient } from './client';

export type WhatsAppContextScope = 'off' | 'quoted' | 'chat' | 'all';

export interface WhatsAppContextSettings {
  scope: WhatsAppContextScope;
  window_size: number;
}

/** Prévia do que o Vito está enxergando agora (janela de contexto montada). */
export interface WhatsAppContextPreview {
  scope: WhatsAppContextScope;
  window_size: number;
  max_age_days: number;
  archived_total: number;
  window_messages: number;
  chats: string[];
  sample: string[];
}

/** Conversa do WhatsApp resumida (diretório de contatos / pendências). */
export interface WhatsAppChatContact {
  name: string;
  preview?: string;
  age?: string;
  pending?: boolean;
}

/** Diretório de contatos + conversas que esperam resposta do usuário. */
export interface WhatsAppDirectory {
  contacts: WhatsAppChatContact[];
  pending: WhatsAppChatContact[];
}

/** Estado do enriquecimento de mídia (áudio/imagem) do histórico. */
export interface WhatsAppMediaStatus {
  pending: number;
  done: number;
  failed: number;
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

  async getPreview(): Promise<WhatsAppContextPreview> {
    return this.client.request<WhatsAppContextPreview>('/api/v1/integrations/whatsapp/context-preview');
  }

  async getDirectory(): Promise<WhatsAppDirectory> {
    return this.client.request<WhatsAppDirectory>('/api/v1/integrations/whatsapp/context-directory');
  }

  /** Estado do enriquecimento de mídia do histórico (o Vito já leu as imagens/áudios?). */
  async getMediaStatus(): Promise<WhatsAppMediaStatus> {
    return this.client.request<WhatsAppMediaStatus>('/api/v1/integrations/whatsapp/media-status');
  }

  /** Dispara o enriquecimento de mídia sob demanda ("analisar agora"). */
  async processMedia(limit = 5): Promise<{ enriched: number }> {
    return this.client.request<{ enriched: number }>('/api/v1/integrations/whatsapp/media-process', {
      method: 'POST',
      body: JSON.stringify({ limit }),
      timeoutMs: 120000,
    });
  }
}
