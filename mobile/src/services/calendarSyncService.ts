import { api } from './api';

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
  credentials: string; // Token OAuth2 ou JSON {username, password}
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
