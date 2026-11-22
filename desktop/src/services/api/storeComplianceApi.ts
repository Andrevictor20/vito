import { ApiClient } from './client';

export type PlanTier = 'free' | 'pro' | 'ultra';
export type BillingCycle = 'month' | 'year';

export interface UserSubscriptionState {
  plan: PlanTier;
  billing_cycle: BillingCycle;
  status: 'active' | 'trialing' | 'inactive' | string;
  trial_ends_at?: string;
  renews_at?: string;
}

export interface PrivacyPermissionsState {
  notifications: boolean;
  calendar: boolean;
  microphone: boolean;
  contacts: boolean;
  location: boolean;
}

export interface PrivacySettingsState {
  permissions: PrivacyPermissionsState;
  ai_processing_enabled: boolean;
  analytics_enabled: boolean;
}

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettingsState = {
  permissions: {
    notifications: true,
    calendar: true,
    microphone: false,
    contacts: false,
    location: false,
  },
  ai_processing_enabled: true,
  analytics_enabled: true,
};

export class StoreComplianceApi {
  constructor(private client: ApiClient) {}

  async getSubscription(): Promise<UserSubscriptionState> {
    const res = await this.client.request<
      { subscription?: UserSubscriptionState } | UserSubscriptionState
    >('/api/v1/billing/subscription', { method: 'GET' });
    const sub = (res as { subscription?: UserSubscriptionState })?.subscription ?? res;
    return {
      plan: 'free',
      billing_cycle: 'year',
      status: 'inactive',
      ...(sub as Partial<UserSubscriptionState>),
    };
  }

  async subscribe(
    plan: Exclude<PlanTier, 'free'>,
    billing_cycle: BillingCycle
  ): Promise<UserSubscriptionState> {
    const res = await this.client.request<
      { subscription?: UserSubscriptionState } | UserSubscriptionState
    >('/api/v1/billing/subscription', {
      method: 'POST',
      body: JSON.stringify({ plan, billing_cycle, start_trial: true }),
    });
    const sub = (res as { subscription?: UserSubscriptionState })?.subscription ?? res;
    return {
      plan,
      billing_cycle,
      status: 'trialing',
      ...(sub as Partial<UserSubscriptionState>),
    };
  }

  async restorePurchases(): Promise<{ restored: boolean; subscription?: UserSubscriptionState }> {
    return this.client.request<{ restored: boolean; subscription?: UserSubscriptionState }>(
      '/api/v1/billing/restore',
      { method: 'POST' }
    );
  }

  async getPrivacySettings(): Promise<PrivacySettingsState> {
    const res = await this.client.request<
      { settings?: PrivacySettingsState } | PrivacySettingsState
    >('/api/v1/privacy/settings', { method: 'GET' });
    const settings = (res as { settings?: PrivacySettingsState })?.settings ?? res;
    return {
      ...DEFAULT_PRIVACY_SETTINGS,
      ...(settings as Partial<PrivacySettingsState>),
      permissions: {
        ...DEFAULT_PRIVACY_SETTINGS.permissions,
        ...((settings as Partial<PrivacySettingsState>)?.permissions || {}),
      },
    };
  }

  async updatePrivacySettings(
    data: Partial<PrivacySettingsState>
  ): Promise<PrivacySettingsState> {
    const res = await this.client.request<
      { settings?: PrivacySettingsState } | PrivacySettingsState
    >('/api/v1/privacy/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    const settings = (res as { settings?: PrivacySettingsState })?.settings ?? res;
    return {
      ...DEFAULT_PRIVACY_SETTINGS,
      ...(settings as Partial<PrivacySettingsState>),
      permissions: {
        ...DEFAULT_PRIVACY_SETTINGS.permissions,
        ...((settings as Partial<PrivacySettingsState>)?.permissions || {}),
      },
    };
  }

  async exportAccountData(): Promise<{
    request_id?: string;
    status: string;
    data?: Record<string, unknown>;
  }> {
    return this.client.request<{
      request_id?: string;
      status: string;
      data?: Record<string, unknown>;
    }>('/api/v1/account/export', { method: 'POST' });
  }

  async deleteAccount(confirmation: string): Promise<{ status: string; scheduled_for?: string }> {
    return this.client.request<{ status: string; scheduled_for?: string }>(
      '/api/v1/account/delete',
      {
        method: 'POST',
        body: JSON.stringify({ confirmation }),
      }
    );
  }

  async sendSupportContact(message: string, subject = 'Suporte Vito'): Promise<{ status: string }> {
    return this.client.request<{ status: string }>('/api/v1/support/contact', {
      method: 'POST',
      body: JSON.stringify({ subject, message }),
    });
  }

  async reportAiContent(reason: string, thread_id?: string): Promise<{ status: string }> {
    return this.client.request<{ status: string }>('/api/v1/ai/report', {
      method: 'POST',
      body: JSON.stringify({ reason, thread_id }),
    });
  }
}
