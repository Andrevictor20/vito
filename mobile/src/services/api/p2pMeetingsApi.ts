import { ApiClient } from './client';
import {
  P2PMeetingInvite,
  ContactMatchResult,
  P2PMutualSlot,
  SendP2PInviteInput,
} from '../../types';

export class P2PMeetingsApi {
  constructor(private client: ApiClient) {}

  async getChallenge(): Promise<{ salt: string }> {
    return this.client.request<{ salt: string }>('/api/v1/contacts/challenge');
  }

  async matchContacts(salt: string, hashes: string[]): Promise<ContactMatchResult[]> {
    const res = await this.client.request<{ matches: ContactMatchResult[] }>('/api/v1/contacts/match', {
      method: 'POST',
      body: JSON.stringify({ salt, hashes }),
    });
    return res && Array.isArray(res.matches) ? res.matches : [];
  }

  async updatePhone(phone: string): Promise<{ status: string }> {
    return this.client.request<{ status: string }>('/api/v1/users/phone', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }

  async getMutualSlots(
    targetUserId: string,
    from?: string,
    to?: string,
    duration?: number
  ): Promise<P2PMutualSlot[]> {
    const params = new URLSearchParams({ target_user_id: targetUserId });
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    if (duration) params.append('duration', duration.toString());

    const res = await this.client.request<{ mutual_slots: P2PMutualSlot[] }>(
      `/api/v1/meetings/p2p/mutual-slots?${params.toString()}`
    );
    return res && Array.isArray(res.mutual_slots) ? res.mutual_slots : [];
  }

  async sendInvite(data: SendP2PInviteInput): Promise<P2PMeetingInvite> {
    return this.client.request<P2PMeetingInvite>('/api/v1/meetings/p2p/invite', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPendingInvites(): Promise<P2PMeetingInvite[]> {
    const res = await this.client.request<P2PMeetingInvite[]>('/api/v1/meetings/p2p/invites/pending');
    return Array.isArray(res) ? res : [];
  }

  async getInvites(): Promise<P2PMeetingInvite[]> {
    const res = await this.client.request<P2PMeetingInvite[]>('/api/v1/meetings/p2p/invites');
    return Array.isArray(res) ? res : [];
  }

  async acceptInvite(id: string): Promise<P2PMeetingInvite> {
    return this.client.request<P2PMeetingInvite>(`/api/v1/meetings/p2p/invites/${id}/accept`, {
      method: 'POST',
    });
  }

  async declineInvite(id: string): Promise<{ status: string }> {
    return this.client.request<{ status: string }>(`/api/v1/meetings/p2p/invites/${id}/decline`, {
      method: 'POST',
    });
  }

  async cancelInvite(id: string): Promise<{ status: string }> {
    return this.client.request<{ status: string }>(`/api/v1/meetings/p2p/invites/${id}/cancel`, {
      method: 'POST',
    });
  }
}
