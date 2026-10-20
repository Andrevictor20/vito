import * as Linking from 'expo-linking';
import { User } from '../types';
import { getMobileDeviceName, IN_APP_BROWSER_OPTIONS } from '../utils/platformInfo';

export { getMobileDeviceName, IN_APP_BROWSER_OPTIONS };

const GOOGLE_WEB_CLIENT_ID = '125131803371-im5dtmilhasug6spdhc50pr0ssb4l92b.apps.googleusercontent.com';

// Carregamento defensivo do módulo nativo GoogleSignin (Google Play Services nativo One Tap)
let GoogleSignin: any = null;
let statusCodes: any = null;
try {
  const gModule = require('@react-native-google-signin/google-signin');
  GoogleSignin = gModule.GoogleSignin;
  statusCodes = gModule.statusCodes;
  if (GoogleSignin && typeof GoogleSignin.configure === 'function') {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      offlineAccess: true,
      forceCodeForRefreshToken: true,
    });
  }
} catch (e) {
  GoogleSignin = null;
  statusCodes = null;
}

// Carregamento defensivo do módulo nativo WebBrowser para fallback de autenticação web
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
  accessToken?: string;
  refreshToken?: string;
  sessionId?: string;
  user: User;
}

export interface GoogleCalendarConnectResult {
  status: string;
  email: string;
}

export interface GmailConnectResult {
  status: string;
  email: string;
}

export const googleAuthService = {
  isAvailable(): boolean {
    const hasNative = GoogleSignin !== null && typeof GoogleSignin.signIn === 'function';
    const hasWeb = WebBrowser !== null && typeof WebBrowser.openAuthSessionAsync === 'function';
    return hasNative || hasWeb;
  },

  /**
   * Inicia o fluxo de Login / Cadastro via Google OAuth2.
   * Prioriza o Google Play Services nativo (sem navegador).
   * Caso o módulo nativo não esteja presente ou ocorra erro de Play Services,
   * aciona o fallback resiliente com Custom Tabs integrado.
   */
  async loginWithGoogle(serverUrl: string): Promise<GoogleLoginResult> {
    const deviceName = getMobileDeviceName();

    // 1. Tenta fluxo nativo do Google Play Services (One Tap nativo sem abrir navegador)
    if (GoogleSignin && typeof GoogleSignin.hasPlayServices === 'function') {
      try {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const signinResult = await GoogleSignin.signIn();

        const idToken = signinResult?.data?.idToken || signinResult?.idToken;
        if (idToken) {
          const resp = await fetch(`${serverUrl.replace(/\/+$/, '')}/api/v1/auth/google/native`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id_token: idToken,
              device_name: deviceName,
            }),
          });

          if (resp.ok) {
            const json = await resp.json();
            const pair = json.data?.token_pair;
            const user = json.data?.user;
            if (pair?.access_token && user) {
              return {
                token: pair.access_token,
                accessToken: pair.access_token,
                refreshToken: pair.refresh_token,
                sessionId: pair.session_id,
                user,
              };
            }
          } else {
            const errJson = await resp.json().catch(() => ({}));
            const backendError = errJson?.error || `Erro HTTP ${resp.status} na autenticação nativa`;
            console.warn('[googleAuthService] Backend rejeitou ID Token nativo:', backendError);
            throw new Error(`Falha no login com Google nativo: ${backendError}`);
          }
        } else {
          console.warn('[googleAuthService] GoogleSignin não retornou idToken válido');
        }
      } catch (err: any) {
        if (err?.code === statusCodes?.SIGN_IN_CANCELLED) {
          throw new Error('Login com Google cancelado.');
        }
        if (err?.code === statusCodes?.IN_PROGRESS) {
          throw new Error('Login com Google já em andamento.');
        }
        // Se foi erro do backend, não mascara com fallback: lança o erro para o usuário
        if (err?.message?.includes('Falha no login com Google nativo')) {
          throw err;
        }
        console.warn('[googleAuthService] Google Sign-in nativo falhou, acionando fallback web seguro:', err?.message || err);
      }
    }

    // 2. Fallback Web Seguro com Custom Tabs integrado
    if (WebBrowser === null || typeof WebBrowser.openAuthSessionAsync !== 'function') {
      throw new Error('A autenticação com Google requer a versão mais recente do aplicativo.');
    }

    const redirectUrl = Linking.createURL('oauth/callback');
    const authStartUrl = `${serverUrl.replace(/\/+$/, '')}/api/v1/auth/google/start?mode=login&redirect_scheme=${encodeURIComponent(redirectUrl)}&device_name=${encodeURIComponent(deviceName)}`;

    // Para o deep link de retorno funcionar confiavelmente após o redirecionamento OAuth,
    // o Android precisa usar a activity de proxy do expo-web-browser
    const webBrowserOptions = {
      ...IN_APP_BROWSER_OPTIONS,
      createTask: false,
      useProxyActivity: true, // Garante que a Intent do deep link seja interceptada pelo app
    };

    const result = await WebBrowser.openAuthSessionAsync(authStartUrl, redirectUrl, webBrowserOptions);

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

    const token = ((query.access_token as string) || (query.token as string)) || '';
    const accessToken = token;
    const refreshToken = (query.refresh_token as string) || undefined;
    const sessionId = (query.session_id as string) || undefined;
    const userStr = query.user as string;

    if (!token || !userStr) {
      throw new Error('Resposta de autenticação Google incompleta.');
    }

    try {
      const user = JSON.parse(decodeURIComponent(userStr)) as User;
      return { token, accessToken, refreshToken, sessionId, user };
    } catch {
      throw new Error('Falha ao processar dados de usuário do Google.');
    }
  },

  /**
   * Inicia o fluxo de concessão de permissão e vinculação do Google Calendar.
   */
  async connectGoogleCalendar(serverUrl: string, jwtToken: string): Promise<GoogleCalendarConnectResult> {
    if (WebBrowser === null || typeof WebBrowser.openAuthSessionAsync !== 'function') {
      throw new Error('A sincronização com Google Calendar requer a versão mais recente do aplicativo.');
    }

    const redirectUrl = Linking.createURL('oauth/callback');
    const authStartUrl = `${serverUrl.replace(/\/+$/, '')}/api/v1/auth/google/start?mode=calendar&token=${encodeURIComponent(jwtToken)}&redirect_scheme=${encodeURIComponent(redirectUrl)}`;

    const result = await WebBrowser.openAuthSessionAsync(authStartUrl, redirectUrl, IN_APP_BROWSER_OPTIONS);

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

  /**
   * Inicia o fluxo de concessão de permissão incremental e vinculação do Gmail.
   */
  async connectGmail(serverUrl: string, jwtToken: string): Promise<GmailConnectResult> {
    if (WebBrowser === null || typeof WebBrowser.openAuthSessionAsync !== 'function') {
      throw new Error('A integração com Gmail requer a versão mais recente do aplicativo.');
    }

    const redirectUrl = Linking.createURL('oauth/callback');
    const authStartUrl = `${serverUrl.replace(/\/+$/, '')}/api/v1/auth/google/start?mode=gmail&token=${encodeURIComponent(jwtToken)}&redirect_scheme=${encodeURIComponent(redirectUrl)}`;

    const result = await WebBrowser.openAuthSessionAsync(authStartUrl, redirectUrl, IN_APP_BROWSER_OPTIONS);

    if (result.type !== 'success') {
      if (result.type === 'cancel' || result.type === 'dismiss') {
        throw new Error('Conexão com Gmail cancelada.');
      }
      throw new Error('Falha ao conectar com o Gmail.');
    }

    const { url } = result;
    const parsed = Linking.parse(url);
    const query = parsed.queryParams || {};

    if (query.error) {
      throw new Error(`Permissão do Gmail negada ou erro: ${query.error}`);
    }

    const status = (query.status as string) || 'success';
    const email = decodeURIComponent((query.email as string) || '');

    return { status, email };
  },
};
