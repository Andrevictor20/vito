import { ApiClient, getDesktopDeviceName } from './client';
import { User } from '../../types';

export interface RequestWhatsAppOTPResponse {
  status: string;
  phone?: string;
  expires_in?: number;
  message?: string;
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
    const raw = await this.client.request<any>('/api/v1/auth/whatsapp/request-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });

    const payload = raw?.data ?? raw ?? {};
    return {
      status: payload?.status ?? 'sent',
      phone: payload?.phone ?? phone,
      expires_in: payload?.expires_in ?? 300,
      message: payload?.message,
    };
  }

  async verifyOTP(phone: string, code: string, deviceName?: string): Promise<VerifyWhatsAppOTPResponse> {
    const resolvedDevice = deviceName || getDesktopDeviceName();
    const raw = await this.client.request<any>('/api/v1/auth/whatsapp/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, code, device_name: resolvedDevice }),
    });

    const payload: any = raw?.data ?? raw;
    const pair: any = payload?.token_pair ?? payload;

    const accessToken: string | undefined = pair?.access_token ?? pair?.token;
    const refreshToken: string | null = pair?.refresh_token ?? null;
    const sessionId: string | null = pair?.session_id ?? null;
    const user: User | undefined = payload?.user;

    if (!accessToken || !user?.id) {
      throw new Error('Resposta de login do WhatsApp incompleta: o servidor não devolveu token e usuário.');
    }

    this.client.setTokens(accessToken, refreshToken ?? undefined, sessionId ?? undefined);

    return {
      access_token: accessToken,
      refresh_token: refreshToken ?? '',
      session_id: sessionId ?? '',
      user,
    };
  }

  async linkPhone(phone: string): Promise<LinkPhoneResponse> {
    return this.client.request<LinkPhoneResponse>('/api/v1/auth/whatsapp/link-phone', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }
}
