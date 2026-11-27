import { ApiClient } from '../../../services/api/client';
import {
  BookingAppointment,
  BookingType,
  DeleteBookingImpact,
  MeetingWithDetails,
} from '../../../types';

export class BookingApi {
  constructor(private client: ApiClient) {}

  async getBookingTypes(): Promise<BookingType[]> {
    const res = await this.client.request<BookingType[]>('/api/v1/booking/types');
    return Array.isArray(res) ? res : [];
  }

  async updateBookingType(id: string, data: Partial<BookingType>): Promise<BookingType> {
    return this.client.request<BookingType>(`/api/v1/booking/types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteBookingType(id: string): Promise<DeleteBookingImpact> {
    const res = await this.client.request<DeleteBookingImpact>(`/api/v1/booking/types/${id}`, {
      method: 'DELETE',
    });
    if (res && typeof res.deleted_appointments === 'number') return res;
    return { deleted_appointments: 0, deleted_events: 0 };
  }

  async getBookingAppointments(): Promise<BookingAppointment[]> {
    const res = await this.client.request<BookingAppointment[]>('/api/v1/booking/appointments');
    return Array.isArray(res) ? res : [];
  }

  async deleteBookingAppointment(id: string): Promise<void> {
    await this.client.request<void>(`/api/v1/booking/appointments/${id}`, {
      method: 'DELETE',
    });
  }
}

export class MeetingsApi {
  constructor(private client: ApiClient) {}

  async getMeetings(status?: string): Promise<MeetingWithDetails[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await this.client.request<MeetingWithDetails[]>(`/api/v1/meetings${query}`);
    return Array.isArray(res) ? res : [];
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
}
