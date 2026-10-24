import { ApiClient } from './client';
import { Meeting } from '../../types';

export class MeetingsApi {
  constructor(private client: ApiClient) {}

  async getMeetings(status?: string): Promise<Meeting[]> {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await this.client.request<any>(`/api/v1/meetings${q}`);
    return Array.isArray(res) ? res : res.meetings || [];
  }

  async getMeeting(id: string): Promise<Meeting> {
    return this.client.request<Meeting>(`/api/v1/meetings/${id}`);
  }

  async createMeeting(data: Partial<Meeting>): Promise<Meeting> {
    return this.client.request<Meeting>('/api/v1/meetings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMeeting(id: string, data: Partial<Meeting>): Promise<Meeting> {
    return this.client.request<Meeting>(`/api/v1/meetings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteMeeting(id: string): Promise<void> {
    await this.client.request(`/api/v1/meetings/${id}`, { method: 'DELETE' });
  }

  async confirmMeetingConsensus(meetingId: string, slotId: string): Promise<{ status: string }> {
    return this.client.request<{ status: string }>(`/api/v1/meetings/${meetingId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ slot_id: slotId }),
    });
  }

  async getMeetingWhatsAppShare(id: string): Promise<any> {
    return this.client.request(`/api/v1/meetings/${id}/share`);
  }
}
