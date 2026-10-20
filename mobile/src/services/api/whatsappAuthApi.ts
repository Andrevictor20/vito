import { ApiClient } from './client';
import { User } from '../../types';
import { getMobileDeviceName } from '../../utils/platformInfo';

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

// Formato real devolvido pelo backend (backend/internal/handler/whatsapp_auth_handler.go):
//   { "data": { "user": {...}, "token_pair": { access_token, refresh_token, session_id, expires_in } } }
// O formato flat é aceito para compatibilidade com versões anteriores do servidor.
interface VerifyWhatsAppOTPRaw {
  data?: {
    user?: User;
    token_pair?: {
      access_token?: string;
      refresh_token?: string;
      session_id?: string;
      expires_in?: number;
    };
  };
  user?: User;
  access_token?: string;
  refresh_token?: string;
  session_id?: string;
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
    const resolvedDevice = deviceName || getMobileDeviceName();
    const raw = await this.client.request<VerifyWhatsAppOTPRaw>('/api/v1/auth/whatsapp/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, code, device_name: resolvedDevice }),
    });

    const payload: any = raw?.data ?? raw;
    const pair: any = payload?.token_pair ?? payload;

    const accessToken: string | undefined = pair?.access_token ?? pair?.token;
    const refreshToken: string | null = pair?.refresh_token ?? null;
    const sessionId: string | null = pair?.session_id ?? null;
    const user: User | undefined = payload?.user;

    // Guardrail: sem token e usuário não há sessão. Antes esta validação não existia e a
    // resposta com formato inesperado gravava "undefined" no storage, travando o app em
    // loading até o usuário limpar o cache do aplicativo.
    if (!accessToken || !user?.id) {
      throw new Error('Resposta de login do WhatsApp incompleta: o servidor não devolveu token e usuário. Tente novamente.');
    }

    if (typeof (this.client as any).setAuthTokens === 'function') {
      await (this.client as any).setAuthTokens(accessToken, refreshToken, sessionId);
    } else {
      await this.client.setToken(accessToken);
    }

    return {
      access_token: accessToken,
      refresh_token: refreshToken ?? '',
      session_id: sessionId ?? '',
      user,
    };
  }

  async linkPhone(phone: string): Promise<LinkPhoneResponse> {
    return this.client.request<LinkPhoneResponse>('/api/v1/auth/whatsapp/link', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }
}

export interface LinkPhoneResponse {
  data: {
    status: string;
    message: string;
  };
}
