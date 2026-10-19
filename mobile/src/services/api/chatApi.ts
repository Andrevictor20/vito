import { Platform } from 'react-native';
import { ApiClient } from './client';
import { fileUriToBase64 } from './fileUtils';
import { AssistantChatOptions } from './types';
import {
  AssistantChatResponse,
  ConversationSession,
  ChatMessage,
} from '../../types';

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

  async assistantChat(
    prompt: string,
    options?: string | AssistantChatOptions
  ): Promise<AssistantChatResponse> {
    const opts: AssistantChatOptions =
      typeof options === 'string' ? { timezone: options } : options || {};
    const tz = opts.timezone || this.getUserTimezone();
    const currentLocalTime = this.getCurrentLocalTimeISO();
    return this.client.request<AssistantChatResponse>('/api/v1/assistant/chat', {
      method: 'POST',
      signal: opts.signal,
      body: JSON.stringify({
        prompt,
        timezone: tz,
        current_local_time: currentLocalTime,
        history: opts.history,
        focus_mode: opts.focus_mode,
      }),
    });
  }

  async assistantAudio(
    audioUri: string,
    filename: string = 'audio.m4a',
    options?: string | AssistantChatOptions
  ): Promise<AssistantChatResponse> {
    const opts: AssistantChatOptions =
      typeof options === 'string' ? { timezone: options } : options || {};
    const tz = opts.timezone || this.getUserTimezone();
    const currentLocalTime = this.getCurrentLocalTimeISO();

    try {
      const b64 = await fileUriToBase64(audioUri);
      if (b64 && b64.length > 0) {
        return await this.client.request<AssistantChatResponse>('/api/v1/assistant/audio', {
          method: 'POST',
          body: JSON.stringify({
            audio_b64: b64,
            audio_mime: 'audio/m4a',
            filename,
            timezone: tz,
            current_local_time: currentLocalTime,
            history: opts.history,
            focus_mode: opts.focus_mode,
          }),
        });
      }
    } catch (b64Err) {
      console.warn('[assistantAudio] Falha ao converter áudio para base64, tentando multipart:', b64Err);
    }

    const cleanUri =
      Platform.OS === 'android' && !audioUri.startsWith('file://') && !audioUri.startsWith('content://')
        ? `file://${audioUri}`
        : audioUri;

    const formData = new FormData();
    formData.append('audio', {
      uri: cleanUri,
      name: filename,
      type: 'audio/m4a',
    } as unknown as Blob);
    formData.append('timezone', tz);
    formData.append('current_local_time', currentLocalTime);
    if (opts.focus_mode) {
      formData.append('focus_mode', opts.focus_mode);
    }


    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    const token = this.client.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch(`${this.client.getBaseUrl()}/api/v1/assistant/audio`, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro HTTP ${res.status}`);
      }

      return res.json();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Tempo limite esgotado (60s) ao processar áudio no servidor (${this.client.getBaseUrl()}).`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async assistantVision(
    imageUri: string,
    prompt?: string,
    filename: string = 'image.jpg',
    timezone?: string,
    base64Override?: string
  ): Promise<AssistantChatResponse> {
    const tz = timezone || this.getUserTimezone();
    const currentLocalTime = this.getCurrentLocalTimeISO();
    const mimeType = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';

    try {
      const b64 = base64Override || (await fileUriToBase64(imageUri));
      if (b64 && b64.length > 0) {
        return await this.client.request<AssistantChatResponse>('/api/v1/assistant/vision', {
          method: 'POST',
          body: JSON.stringify({
            image_b64: b64,
            image_mime: mimeType,
            prompt,
            timezone: tz,
            current_local_time: currentLocalTime,
          }),
        });
      }
    } catch (b64Err) {
      console.warn('[assistantVision] Falha ao converter imagem para base64, tentando multipart:', b64Err);
    }

    const cleanUri =
      Platform.OS === 'android' && !imageUri.startsWith('file://') && !imageUri.startsWith('content://')
        ? `file://${imageUri}`
        : imageUri;

    const formData = new FormData();
    formData.append('image', {
      uri: cleanUri,
      name: filename,
      type: mimeType,
    } as unknown as Blob);

    if (prompt) {
      formData.append('prompt', prompt);
    }
    formData.append('timezone', tz);
    formData.append('current_local_time', currentLocalTime);

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    const token = this.client.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch(`${this.client.getBaseUrl()}/api/v1/assistant/vision`, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro HTTP ${res.status}`);
      }

      return res.json();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Tempo limite esgotado (60s) ao processar imagem no servidor (${this.client.getBaseUrl()}).`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getChatSessions(): Promise<ConversationSession[]> {
    const res = await this.client.request<any[]>('/api/v1/chat/sessions');
    return Array.isArray(res) ? res : [];
  }

  async getChatSessionWithMessages(id: string): Promise<{ session: ConversationSession; messages: ChatMessage[] } | null> {
    try {
      return await this.client.request<{ session: ConversationSession; messages: ChatMessage[] }>(`/api/v1/chat/sessions/${id}`);
    } catch {
      return null;
    }
  }

  async syncChatSession(session: ConversationSession, messages: ChatMessage[]): Promise<any> {
    try {
      return await this.client.request('/api/v1/chat/sync', {
        method: 'POST',
        body: JSON.stringify({
          session: {
            id: session.id,
            title: session.title,
            preview: session.preview,
            created_at: session.timestamp,
            updated_at: new Date().toISOString(),
          },
          messages: messages.map((m) => ({
            id: m.id,
            session_id: session.id,
            sender: m.sender,
            text: m.text,
            timestamp: m.timestamp,
            image_uri: m.imageUri,
            action_performed: m.action_performed,
          })),
        }),
      });
    } catch {
      return null;
    }
  }

  async deleteChatSession(id: string): Promise<void> {
    try {
      await this.client.request<void>(`/api/v1/chat/sessions/${id}`, {
        method: 'DELETE',
      });
    } catch {
      // Silencioso
    }
  }
}
