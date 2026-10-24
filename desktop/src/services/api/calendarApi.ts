import { ApiClient } from './client';
import { CalendarEvent } from '../../types';

export class CalendarApi {
  constructor(private client: ApiClient) {}

  async getEvents(): Promise<CalendarEvent[]> {
    const res = await this.client.request<any>('/api/v1/events');
    return Array.isArray(res) ? res : res.events || [];
  }

  async createEvent(event: Partial<CalendarEvent>): Promise<CalendarEvent> {
    return this.client.request<CalendarEvent>('/api/v1/events', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  async updateEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent> {
    return this.client.request<CalendarEvent>(`/api/v1/events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteEvent(id: string): Promise<void> {
    await this.client.request(`/api/v1/events/${id}`, { method: 'DELETE' });
  }

  async syncCalendar(provider: string = 'google'): Promise<{ status: string; provider: string }> {
    return this.client.request(`/api/v1/integrations/calendars/${provider}/sync`, {
      method: 'POST',
    });
  }
}
