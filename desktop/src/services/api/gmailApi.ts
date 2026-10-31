import { ApiClient } from './client';

export interface GmailStatusResponse {
  connected: boolean;
  email: string;
  last_scanned_at: string | null;
}

export interface ScannedBill {
  id: string;
  email_id: string;
  sender: string;
  subject: string;
  received_at: string;
  amount: number;
  due_date: string;
  linha_digitavel: string;
  pdf_attachment_id?: string;
}

export interface ScannedFlight {
  id: string;
  email_id: string;
  airline: string;
  booking_locator: string;
  flight_number: string;
  departure_airport: string;
  arrival_airport: string;
  departure_time: string;
  arrival_time: string;
}

export interface UrgentEmail {
  id: string;
  email_id: string;
  sender: string;
  subject: string;
  snippet: string;
  urgency_reason: string;
  received_at: string;
}

export interface GmailScanResult {
  scanned_count: number;
  bills: ScannedBill[];
  flights: ScannedFlight[];
  urgent_emails: UrgentEmail[];
}

export interface GmailDraftInput {
  to: string;
  subject: string;
  body: string;
}

export interface GmailDraftResponse {
  id: string;
  thread_id: string;
}

export interface GmailSendResponse {
  id: string;
  message: string;
}

export class GmailApi {
  constructor(private client: ApiClient) {}

  async getStatus(): Promise<GmailStatusResponse> {
    const raw = await this.client.request<any>('/api/v1/integrations/gmail/status');
    const data = raw?.data ?? raw;
    return {
      connected: Boolean(data?.connected),
      email: data?.email || '',
      last_scanned_at: data?.last_scanned_at ?? null,
    };
  }

  async scanEmails(params?: { days?: number; limit?: number }): Promise<GmailScanResult> {
    const raw = await this.client.request<any>('/api/v1/integrations/gmail/scan', {
      method: 'POST',
      body: JSON.stringify(params || {}),
    });
    const data = raw?.data ?? raw;
    return {
      scanned_count: data?.scanned_count ?? (data?.messages_read ?? 0),
      bills: data?.bills ?? [],
      flights: data?.flights ?? [],
      urgent_emails: data?.urgent_emails ?? [],
    };
  }

  async disconnect(): Promise<{ message: string }> {
    const raw = await this.client.request<any>('/api/v1/integrations/gmail/disconnect', {
      method: 'DELETE',
    });
    const data = raw?.data ?? raw;
    return {
      message: data?.message || 'Desconectado com sucesso',
    };
  }

  async createDraft(draft: GmailDraftInput): Promise<GmailDraftResponse> {
    const raw = await this.client.request<any>('/api/v1/integrations/gmail/draft', {
      method: 'POST',
      body: JSON.stringify(draft),
    });
    const data = raw?.data ?? raw;
    return {
      id: data?.id || (data?.draft_id ?? ''),
      thread_id: data?.thread_id ?? '',
    };
  }

  async sendEmail(email: GmailDraftInput): Promise<GmailSendResponse> {
    const raw = await this.client.request<any>('/api/v1/integrations/gmail/send', {
      method: 'POST',
      body: JSON.stringify(email),
    });
    const data = raw?.data ?? raw;
    return {
      id: data?.id || data?.message_id || '',
      message: data?.message || 'E-mail enviado com sucesso',
    };
  }
}
