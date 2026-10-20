import { ApiClient } from './client';
import { User } from '../../types';
import { getMobileDeviceName } from '../../utils/platformInfo';

export interface RequestWhatsAppOTPResponse {
  status: string;
  phone: string;
  expires_in: number;
}

export interface VerifyWhatsAppOTPResponse {
  access_token: string;
  refresh_token: string;
  session_id: string;
  user: User;
}

export interface LinkPhoneResponse {
  data: {
    status: string;
    message: string;
  };
}

export class WhatsAppAuthApi {
  constructor(private client: ApiClient) {}

  async requestOTP(phone: string): Promise<RequestWhatsAppOTPResponse> {
    return this.client.request<RequestWhatsAppOTPResponse>('/api/v1/auth/whatsapp/request-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }

  async verifyOTP(phone: string, code: string, deviceName?: string): Promise<VerifyWhatsAppOTPResponse> {
    const resolvedDevice = deviceName || getMobileDeviceName();
    const res = await this.client.request<VerifyWhatsAppOTPResponse>('/api/v1/auth/whatsapp/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, code, device_name: resolvedDevice }),
    });

    if (typeof (this.client as any).setAuthTokens === 'function') {
      await (this.client as any).setAuthTokens(res.access_token, res.refresh_token, res.session_id);
    } else {
      await this.client.setToken(res.access_token);
    }

    return res;
  }

  async linkPhone(phone: string): Promise<LinkPhoneResponse> {
    return this.client.request<LinkPhoneResponse>('/api/v1/auth/whatsapp/link', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }
}
