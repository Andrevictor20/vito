import { ApiClient } from './client';
import {
  Meeting,
  MeetingWithDetails,
  CreateMeetingInput,
  WhatsAppShareData,
} from '../../types';

export class MeetingsApi {
  constructor(private client: ApiClient) {}

  async getMeetings(status?: string): Promise<Meeting[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await this.client.request<Meeting[]>(`/api/v1/meetings${query}`);
    return Array.isArray(res) ? res : [];
  }

  async getMeeting(id: string): Promise<MeetingWithDetails> {
    return this.client.request<MeetingWithDetails>(`/api/v1/meetings/${id}`);
  }

  async createMeeting(data: CreateMeetingInput): Promise<MeetingWithDetails> {
    return this.client.request<MeetingWithDetails>('/api/v1/meetings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteMeeting(id: string): Promise<void> {
    await this.client.request<void>(`/api/v1/meetings/${id}`, {
      method: 'DELETE',
    });
  }

  async confirmConsensus(id: string, slotId: string): Promise<{ status: string }> {
    return this.client.request<{ status: string }>(`/api/v1/meetings/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ slot_id: slotId }),
    });
  }

  async getWhatsAppShare(id: string): Promise<WhatsAppShareData> {
    return this.client.request<WhatsAppShareData>(`/api/v1/meetings/${id}/share`);
  }
}
