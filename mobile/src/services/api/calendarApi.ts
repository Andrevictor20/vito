import { ApiClient } from './client';
import { Event, ConflictInfo } from '../../types';

export class CalendarApi {
  constructor(private client: ApiClient) {}

  async getEvents(): Promise<Event[]> {
    const res = await this.client.request<Event[]>('/api/v1/events');
    return res || [];
  }

  async createEvent(event: { title: string; description?: string; location?: string; start_at: string; end_at: string; recurrence?: string }) {
    return this.client.request<{ event: Event; conflict?: ConflictInfo }>('/api/v1/events', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  async updateEvent(id: string, eventData: Partial<Event> & { update_series?: boolean }): Promise<{ event: Event; updated_count: number }> {
    return this.client.request<{ event: Event; updated_count: number }>(`/api/v1/events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(eventData),
    });
  }

  async deleteEvent(id: string, allSeries: boolean = false): Promise<void> {
    const query = allSeries ? '?all_series=true' : '';
    return this.client.request<void>(`/api/v1/events/${id}${query}`, { method: 'DELETE' });
  }

  async syncCalendar(provider: string = 'google'): Promise<{ status: string; provider: string }> {
    return this.client.post<{ status: string; provider: string }>(`/api/v1/integrations/calendars/${provider}/sync`, {});
  }
}
