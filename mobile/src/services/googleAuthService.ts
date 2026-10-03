import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { User } from '../types';

// Carregamento defensivo do módulo nativo WebBrowser para evitar crash no bootstrap caso o binário nativo não esteja presente
let WebBrowser: any = null;
try {
  WebBrowser = require('expo-web-browser');
  if (WebBrowser && typeof WebBrowser.maybeCompleteAuthSession === 'function') {
    WebBrowser.maybeCompleteAuthSession();
  }
} catch (e) {
  console.warn('[googleAuthService] expo-web-browser não disponível neste runtime:', e);
  WebBrowser = null;
}

export interface GoogleLoginResult {
  token: string;
  user: User;
}

export interface GoogleCalendarConnectResult {
  status: string;
  email: string;
}

export const googleAuthService = {
  isAvailable(): boolean {
    return WebBrowser !== null && typeof WebBrowser.openAuthSessionAsync === 'function';
  },

  /**
   * Inicia o fluxo de Login / Cadastro via Google OAuth2.
   */
  async loginWithGoogle(serverUrl: string): Promise<GoogleLoginResult> {
    if (!this.isAvailable()) {
      throw new Error('A autenticação com Google requer a versão mais recente do aplicativo. Por favor, atualize o APK.');
    }

    const redirectUrl = Linking.createURL('oauth/callback');
    const authStartUrl = `${serverUrl.replace(/\/+$/, '')}/api/v1/auth/google/start?mode=login&redirect_scheme=${encodeURIComponent(redirectUrl)}`;

    const result = await WebBrowser.openAuthSessionAsync(authStartUrl, redirectUrl);

    if (result.type !== 'success') {
      if (result.type === 'cancel' || result.type === 'dismiss') {
        throw new Error('Login com Google cancelado.');
      }
      throw new Error('Falha ao abrir autenticação Google.');
    }

    const { url } = result;
    const parsed = Linking.parse(url);
    const query = parsed.queryParams || {};

    if (query.error) {
      throw new Error(`Google retornou erro: ${query.error}`);
    }

    const token = query.token as string;
    const userStr = query.user as string;

    if (!token || !userStr) {
      throw new Error('Resposta de autenticação Google incompleta.');
    }

    try {
      const user = JSON.parse(decodeURIComponent(userStr)) as User;
      return { token, user };
    } catch {
      throw new Error('Falha ao processar dados de usuário do Google.');
    }
  },

  /**
   * Inicia o fluxo de concessão de permissão e vinculação do Google Calendar.
   */
  async connectGoogleCalendar(serverUrl: string, jwtToken: string): Promise<GoogleCalendarConnectResult> {
    if (!this.isAvailable()) {
      throw new Error('A sincronização com Google Calendar requer a versão mais recente do aplicativo. Por favor, atualize o APK.');
    }

    const redirectUrl = Linking.createURL('oauth/callback');
    const authStartUrl = `${serverUrl.replace(/\/+$/, '')}/api/v1/auth/google/start?mode=calendar&token=${encodeURIComponent(jwtToken)}&redirect_scheme=${encodeURIComponent(redirectUrl)}`;

    const result = await WebBrowser.openAuthSessionAsync(authStartUrl, redirectUrl);

    if (result.type !== 'success') {
      if (result.type === 'cancel' || result.type === 'dismiss') {
        throw new Error('Conexão com Google Calendar cancelada.');
      }
      throw new Error('Falha ao conectar com o Google Calendar.');
    }

    const { url } = result;
    const parsed = Linking.parse(url);
    const query = parsed.queryParams || {};

    if (query.error) {
      throw new Error(`Permissão de calendário negada ou erro: ${query.error}`);
    }

    const status = (query.status as string) || 'success';
    const email = decodeURIComponent((query.email as string) || '');

    return { status, email };
  },
};
