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

export class GmailApi {
  constructor(private client: ApiClient) {}

  async getStatus(): Promise<GmailStatusResponse> {
    return this.client.request<GmailStatusResponse>('/api/v1/integrations/gmail/status');
  }

  async scanEmails(params?: { days?: number; limit?: number }): Promise<GmailScanResult> {
    return this.client.request<GmailScanResult>('/api/v1/integrations/gmail/scan', {
      method: 'POST',
      body: JSON.stringify(params || {}),
      timeoutMs: 60000,
    });
  }

  async disconnect(): Promise<{ message: string }> {
    return this.client.request<{ message: string }>('/api/v1/integrations/gmail/disconnect', {
      method: 'DELETE',
    });
  }

  async createDraft(draft: GmailDraftInput): Promise<GmailDraftResponse> {
    return this.client.request<GmailDraftResponse>('/api/v1/integrations/gmail/draft', {
      method: 'POST',
      body: JSON.stringify(draft),
    });
  }
}
