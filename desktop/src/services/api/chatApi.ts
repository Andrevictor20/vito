import { ApiClient } from './client';
import { ConversationSession, ChatMessage } from '../../types';

export class ChatApi {
  constructor(private client: ApiClient) {}

  getUserTimezone(): string {
    try {
      const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const offsetMinutes = new Date().getTimezoneOffset();
      if (!resolved || resolved === 'UTC' || resolved === 'Etc/UTC') {
        if (offsetMinutes === 180) return 'America/Sao_Paulo';
        if (offsetMinutes === 240) return 'America/Manaus';
        if (offsetMinutes === 120) return 'America/Noronha';
        if (offsetMinutes === 300) return 'America/Rio_Branco';
        return 'America/Sao_Paulo';
      }
      return resolved;
    } catch {
      return 'America/Sao_Paulo';
    }
  }

  getCurrentLocalTimeISO(): string {
    const now = new Date();
    const tzo = -now.getTimezoneOffset();
    const dif = tzo >= 0 ? '+' : '-';
    const pad = (num: number) => (num < 10 ? '0' : '') + num;
    return (
      now.getFullYear() +
      '-' +
      pad(now.getMonth() + 1) +
      '-' +
      pad(now.getDate()) +
      'T' +
      pad(now.getHours()) +
      ':' +
      pad(now.getMinutes()) +
      ':' +
      pad(now.getSeconds()) +
      dif +
      pad(Math.floor(Math.abs(tzo) / 60)) +
      ':' +
      pad(Math.abs(tzo) % 60)
    );
  }

  async assistantChat(prompt: string, context?: any): Promise<any> {
    const tz = context?.timezone || this.getUserTimezone();
    const currentLocalTime = this.getCurrentLocalTimeISO();

    const res = await this.client.request<any>('/api/v1/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        text: prompt,
        timezone: tz,
        current_local_time: currentLocalTime,
        history: context?.history,
        focus_mode: context?.focus_mode,
        ...context,
      }),
    });

    return {
      reply: res.reply || res.message || res.text || '',
      message: res.message || res.reply || '',
      actions: res.actions,
      event: res.event,
      todo: res.todo,
      trigger: res.trigger,
      booking: res.booking,
      whatsapp_message: res.whatsapp_message,
      gmail_message: res.gmail_message,
    };
  }

  async assistantAudio(audioB64: string, filename = 'audio.m4a', context?: any): Promise<any> {
    const tz = context?.timezone || this.getUserTimezone();
    const currentLocalTime = this.getCurrentLocalTimeISO();

    return this.client.request('/api/v1/assistant/audio', {
      method: 'POST',
      body: JSON.stringify({
        audio_b64: audioB64,
        audio_mime: 'audio/m4a',
        filename,
        timezone: tz,
        current_local_time: currentLocalTime,
        history: context?.history,
        focus_mode: context?.focus_mode,
      }),
    });
  }

  async assistantVision(imageB64: string, mimeType = 'image/jpeg', prompt = '', context?: any): Promise<any> {
    const tz = context?.timezone || this.getUserTimezone();
    const currentLocalTime = this.getCurrentLocalTimeISO();

    return this.client.request('/api/v1/assistant/vision', {
      method: 'POST',
      body: JSON.stringify({
        image_b64: imageB64,
        image_mime: mimeType,
        prompt,
        timezone: tz,
        current_local_time: currentLocalTime,
        history: context?.history,
      }),
    });
  }

  async getChatSessions(): Promise<ConversationSession[]> {
    const res = await this.client.request<any>('/api/v1/chat/sessions');
    return Array.isArray(res) ? res : res.sessions || [];
  }

  async getChatSessionWithMessages(id: string): Promise<{ session: ConversationSession; messages: ChatMessage[] } | null> {
    const res = await this.client.request<any>(`/api/v1/chat/sessions/${id}`);
    if (!res) return null;
    return {
      session: res.session || res,
      messages: res.messages || [],
    };
  }

  async deleteChatSession(id: string): Promise<void> {
    await this.client.request(`/api/v1/chat/sessions/${id}`, { method: 'DELETE' });
  }

  async syncChatSession(session: any, messages: any[]): Promise<any> {
    return this.client.request('/api/v1/chat/sessions', {
      method: 'POST',
      body: JSON.stringify({
        session_id: session.id,
        title: session.title,
        preview: session.preview,
        messages,
      }),
    });
  }
}
