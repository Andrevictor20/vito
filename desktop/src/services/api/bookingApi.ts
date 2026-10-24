import { ApiClient } from './client';
import { BookingType } from '../../types';

export class BookingApi {
  constructor(private client: ApiClient) {}

  async getBookingTypes(): Promise<BookingType[]> {
    const res = await this.client.request<any>('/api/v1/booking/types');
    return Array.isArray(res) ? res : res.types || res.booking_types || [];
  }

  async getBookings(): Promise<BookingType[]> {
    return this.getBookingTypes();
  }

  async createBookingType(data: Partial<BookingType>): Promise<BookingType> {
    return this.client.request<BookingType>('/api/v1/booking/types', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBookingType(id: string, data: Partial<BookingType>): Promise<BookingType> {
    return this.client.request<BookingType>(`/api/v1/booking/types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteBookingType(id: string): Promise<void> {
    await this.client.request(`/api/v1/booking/types/${id}`, { method: 'DELETE' });
  }

  async getBookingAppointments(): Promise<any[]> {
    const res = await this.client.request<any>('/api/v1/booking/appointments');
    return Array.isArray(res) ? res : res.appointments || [];
  }

  async deleteBookingAppointment(id: string): Promise<void> {
    await this.client.request(`/api/v1/booking/appointments/${id}`, { method: 'DELETE' });
  }
}
