import { ApiClient } from '../../../services/api/client';
import { api } from '../../../services/api';
import { Event, ConflictInfo } from '../../../types';

export class CalendarApi {
  constructor(private client: ApiClient) {}

  async getEvents(): Promise<Event[]> {
    const res = await this.client.request<Event[]>('/api/v1/events');
    return res || [];
  }

  async createEvent(event: {
    title: string;
    description?: string;
    location?: string;
    start_at: string;
    end_at: string;
    recurrence?: string;
    critical_alarm?: boolean;
    wake_offset_minutes?: number;
  }) {
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

export interface CalendarIntegration {
  id: string;
  user_id: string;
  provider: 'google' | 'apple_caldav' | 'apple_native';
  account_email: string;
  calendar_id: string;
  calendar_name?: string;
  status: 'active' | 'reauth_required' | 'error';
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ConnectCalendarPayload {
  provider: 'google' | 'apple_caldav' | 'apple_native';
  account_email: string;
  credentials: string;
  calendar_id?: string;
  calendar_name?: string;
}

export const calendarSyncService = {
  async listIntegrations(): Promise<CalendarIntegration[]> {
    return api.get<CalendarIntegration[]>('/api/v1/integrations/calendars');
  },

  async connectIntegration(payload: ConnectCalendarPayload): Promise<CalendarIntegration> {
    return api.post<CalendarIntegration>('/api/v1/integrations/calendars/connect', payload);
  },

  async syncIntegration(provider: string): Promise<{ status: string; provider: string }> {
    return api.post<{ status: string; provider: string }>(`/api/v1/integrations/calendars/${provider}/sync`, {});
  },

  async disconnectIntegration(provider: string): Promise<{ status: string; provider: string }> {
    return api.delete<{ status: string; provider: string }>(`/api/v1/integrations/calendars/${provider}`);
  },
};
