import * as Linking from 'expo-linking';
import { User } from '../types';
import { getMobileDeviceName, IN_APP_BROWSER_OPTIONS, IN_APP_BROWSER_OPTIONS_WITH_PROXY } from '../utils/platformInfo';

export { getMobileDeviceName, IN_APP_BROWSER_OPTIONS, IN_APP_BROWSER_OPTIONS_WITH_PROXY };

const GOOGLE_WEB_CLIENT_ID = '125131803371-im5dtmilhasug6spdhc50pr0ssb4l92b.apps.googleusercontent.com';

// Mapeamento de códigos de erro conhecidos do Google Sign-In (valores numéricos da API nativa Android)
const GOOGLE_SIGN_IN_ERROR_CODES: Record<number, string> = {
  0: 'OK',
  4: 'SIGN_IN_CANCELLED',
  6: 'NETWORK_ERROR',
  7: 'INTERNAL_ERROR',
  8: 'IN_PROGRESS',
  10: 'DEVELOPER_ERROR', // SHA-1 mismatch, package name mismatch, etc.
  13: 'PLAY_SERVICES_NOT_AVAILABLE',
  14: 'PLAY_SERVICES_VERSION_OUTDATED',
  15: 'PLAY_SERVICES_DISABLED',
  16: 'SIGN_IN_FAILED',
  17: 'API_EXCEPTION',
};

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
    console.log('[googleAuthService] GoogleSignin configurado com sucesso', { 
      hasStatusCodes: !!statusCodes,
      statusCodesKeys: statusCodes ? Object.keys(statusCodes) : [],
    });
  }
} catch (e) {
  console.warn('[googleAuthService] Módulo @react-native-google-signin/google-signin não disponível:', e);
  GoogleSignin = null;
  statusCodes = null;
}

/**
 * Normaliza códigos de erro do Google Sign-In para strings conhecidas.
 * Suporta tanto códigos string (statusCodes do módulo) quanto numéricos (API nativa Android).
 */
function normalizeGoogleSignInErrorCode(err: any): string | null {
  if (!err) return null;
  
  // Se já tem código string conhecido
  const code = err?.code;
  if (typeof code === 'string') {
    return code;
  }
  
  // Se é código numérico da API nativa
  if (typeof code === 'number' && GOOGLE_SIGN_IN_ERROR_CODES[code]) {
    return GOOGLE_SIGN_IN_ERROR_CODES[code];
  }
  
  // Tenta extrair do message se contém padrão conhecido
  const msg = err?.message || '';
  if (msg.includes('DEVELOPER_ERROR') || msg.includes('10:')) return 'DEVELOPER_ERROR';
  if (msg.includes('SIGN_IN_CANCELLED') || msg.includes('4:')) return 'SIGN_IN_CANCELLED';
  if (msg.includes('PLAY_SERVICES_NOT_AVAILABLE') || msg.includes('13:')) return 'PLAY_SERVICES_NOT_AVAILABLE';
  if (msg.includes('IN_PROGRESS') || msg.includes('8:')) return 'IN_PROGRESS';
  if (msg.includes('NETWORK_ERROR') || msg.includes('6:')) return 'NETWORK_ERROR';
  if (msg.includes('SIGN_IN_FAILED') || msg.includes('16:')) return 'SIGN_IN_FAILED';
  
  return null;
}

/**
 * Verifica se o erro é um cancelamento genuíno do usuário (não erro de configuração).
 */
function isUserCancellation(err: any): boolean {
  const code = normalizeGoogleSignInErrorCode(err);
  return code === 'SIGN_IN_CANCELLED' || code === 'IN_PROGRESS';
}

/**
 * Verifica se o erro é de configuração (SHA-1, package name, etc.) - deve acionar fallback web.
 */
function isConfigurationError(err: any): boolean {
  const code = normalizeGoogleSignInErrorCode(err);
  return code === 'DEVELOPER_ERROR' || code === 'SIGN_IN_FAILED' || code === 'API_EXCEPTION';
}

/**
 * Verifica se o erro é de indisponibilidade do Play Services - deve acionar fallback web.
 */
function isPlayServicesUnavailable(err: any): boolean {
  const code = normalizeGoogleSignInErrorCode(err);
  return code === 'PLAY_SERVICES_NOT_AVAILABLE' || 
         code === 'PLAY_SERVICES_VERSION_OUTDATED' || 
         code === 'PLAY_SERVICES_DISABLED';
}

// Carregamento defensivo do módulo nativo WebBrowser para fallback de autenticação web
let WebBrowser: any = null;
try {
  WebBrowser = require('expo-web-browser');
  if (WebBrowser && typeof WebBrowser.maybeCompleteAuthSession === 'function') {
    WebBrowser.maybeCompleteAuthSession();
    console.log('[googleAuthService] WebBrowser.maybeCompleteAuthSession() chamado');
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
   * Caso o módulo nativo não esteja presente ou ocorra erro de Play Services/configuração,
   * aciona o fallback resiliente com Custom Tabs integrado (useProxyActivity: true).
   */
  async loginWithGoogle(serverUrl: string): Promise<GoogleLoginResult> {
    const deviceName = getMobileDeviceName();
    console.log('[googleAuthService] Iniciando loginWithGoogle, deviceName:', deviceName);

    // 1. Tenta fluxo nativo do Google Play Services (One Tap nativo sem abrir navegador)
    if (GoogleSignin && typeof GoogleSignin.hasPlayServices === 'function') {
      try {
        console.log('[googleAuthService] Verificando Google Play Services...');
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        console.log('[googleAuthService] Google Play Services disponível, iniciando signIn...');
        const signinResult = await GoogleSignin.signIn();
        console.log('[googleAuthService] signIn resultado:', JSON.stringify(signinResult));

        const idToken = signinResult?.data?.idToken || signinResult?.idToken;
        if (idToken) {
          console.log('[googleAuthService] idToken obtido, enviando para backend...');
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
              console.log('[googleAuthService] Login nativo bem-sucedido');
              return {
                token: pair.access_token,
                accessToken: pair.access_token,
                refreshToken: pair.refresh_token,
                sessionId: pair.session_id,
                user,
              };
            }
            console.warn('[googleAuthService] Resposta do backend sem token_pair ou user:', json);
            throw new Error('Resposta de autenticação nativa incompleta do servidor');
          } else {
            const errJson = await resp.json().catch(() => ({}));
            const backendError = errJson?.error || `Erro HTTP ${resp.status} na autenticação nativa`;
            console.warn('[googleAuthService] Backend rejeitou ID Token nativo:', backendError);
            throw new Error(`Falha no login com Google nativo: ${backendError}`);
          }
        } else {
          console.warn('[googleAuthService] GoogleSignin não retornou idToken válido. Resultado completo:', JSON.stringify(signinResult));
          throw new Error('Google Sign-in nativo não retornou token de identificação. Verifique a configuração do SHA-1 no Google Cloud Console.');
        }
      } catch (err: any) {
        const normalizedCode = normalizeGoogleSignInErrorCode(err);
        console.log('[googleAuthService] Erro no fluxo nativo:', { 
          originalCode: err?.code, 
          normalizedCode, 
          message: err?.message,
          isUserCancellation: isUserCancellation(err),
          isConfigError: isConfigurationError(err),
          isPlayServicesUnavailable: isPlayServicesUnavailable(err),
        });

        // Erros de cancelamento genuíno do usuário: propaga para a UI tratar silenciosamente
        if (isUserCancellation(err)) {
          console.log('[googleAuthService] Usuário cancelou o login nativo');
          throw new Error('Login com Google cancelado.');
        }

        // Erros de configuração (SHA-1 mismatch, package name, etc.): loga claramente e aciona fallback web
        if (isConfigurationError(err)) {
          console.error('[googleAuthService] Erro de configuração do Google Sign-In nativo (SHA-1/package name mismatch). Acionando fallback web:', {
            code: normalizedCode,
            message: err?.message,
            hint: 'Verifique se o SHA-1 do keystore de assinatura do APK está cadastrado no Google Cloud Console para o OAuth Client ID Web.',
          });
          // NÃO lança erro - deixa cair para o fallback web abaixo
        }
        // Play Services indisponível/desatualizado: loga e aciona fallback web
        else if (isPlayServicesUnavailable(err)) {
          console.warn('[googleAuthService] Google Play Services indisponível, acionando fallback web:', {
            code: normalizedCode,
            message: err?.message,
          });
        }
        // Erro do backend (token rejeitado): NÃO mascara com fallback - lança para o usuário ver a causa raiz
        else if (err?.message?.includes('Falha no login com Google nativo') || err?.message?.includes('não retornou token de identificação') || err?.message?.includes('Resposta de autenticação nativa incompleta')) {
          console.error('[googleAuthService] Erro crítico no fluxo nativo (não mascarando com fallback):', err?.message);
          throw err;
        }
        // Erros de rede/timeout: aciona fallback web
        else if (normalizedCode === 'NETWORK_ERROR' || normalizedCode === 'INTERNAL_ERROR') {
          console.warn('[googleAuthService] Erro de rede/interno no fluxo nativo, acionando fallback web:', {
            code: normalizedCode,
            message: err?.message,
          });
        }
        // Outros erros inesperados: loga detalhes e aciona fallback web
        else {
          console.warn('[googleAuthService] Google Sign-in nativo falhou inesperadamente, acionando fallback web seguro:', {
            code: normalizedCode,
            originalCode: err?.code,
            message: err?.message,
            stack: err?.stack,
          });
        }
      }
    } else {
      console.warn('[googleAuthService] GoogleSignin não disponível ou hasPlayServices não é função, pulando para fallback web');
    }

    // 2. Fallback Web Seguro com Custom Tabs integrado (useProxyActivity: true)
    if (WebBrowser === null || typeof WebBrowser.openAuthSessionAsync !== 'function') {
      throw new Error('A autenticação com Google requer a versão mais recente do aplicativo.');
    }

    console.log('[googleAuthService] Iniciando fallback web com WebBrowser.openAuthSessionAsync');

    const redirectUrl = Linking.createURL('oauth/callback');
    const authStartUrl = `${serverUrl.replace(/\/+$/, '')}/api/v1/auth/google/start?mode=login&redirect_scheme=${encodeURIComponent(redirectUrl)}&device_name=${encodeURIComponent(deviceName)}`;

    // Para o deep link de retorno funcionar confiavelmente após o redirecionamento OAuth,
    // o Android precisa usar a activity de proxy do expo-web-browser
    const webBrowserOptions = IN_APP_BROWSER_OPTIONS_WITH_PROXY;

    console.log('[googleAuthService] Abrindo WebBrowser com URL:', authStartUrl);
    console.log('[googleAuthService] Redirect URL:', redirectUrl);
    console.log('[googleAuthService] Opções do WebBrowser:', JSON.stringify(webBrowserOptions));

    const result = await WebBrowser.openAuthSessionAsync(authStartUrl, redirectUrl, webBrowserOptions);

    console.log('[googleAuthService] WebBrowser resultado:', JSON.stringify(result));

    if (result.type !== 'success') {
      if (result.type === 'cancel' || result.type === 'dismiss') {
        console.log('[googleAuthService] Usuário cancelou/fechou o navegador web');
        throw new Error('Login com Google cancelado.');
      }
      console.error('[googleAuthService] WebBrowser falhou:', result);
      throw new Error('Falha ao abrir autenticação Google.');
    }

    const { url } = result;
    const parsed = Linking.parse(url);
    const query = parsed.queryParams || {};

    if (query.error) {
      console.error('[googleAuthService] Google retornou erro no callback:', query.error);
      throw new Error(`Google retornou erro: ${query.error}`);
    }

    const token = ((query.access_token as string) || (query.token as string)) || '';
    const accessToken = token;
    const refreshToken = (query.refresh_token as string) || undefined;
    const sessionId = (query.session_id as string) || undefined;
    const userStr = query.user as string;

    if (!token || !userStr) {
      console.error('[googleAuthService] Resposta de autenticação incompleta:', { token, userStr, query });
      throw new Error('Resposta de autenticação Google incompleta.');
    }

    try {
      const user = JSON.parse(decodeURIComponent(userStr)) as User;
      console.log('[googleAuthService] Login via fallback web bem-sucedido para:', user.email);
      return { token, accessToken, refreshToken, sessionId, user };
    } catch {
      console.error('[googleAuthService] Falha ao parsear usuário do callback');
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

    // useProxyActivity: true garante interceptação confiável do deep link no Android
    const result = await WebBrowser.openAuthSessionAsync(authStartUrl, redirectUrl, IN_APP_BROWSER_OPTIONS_WITH_PROXY);

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

    // useProxyActivity: true garante interceptação confiável do deep link no Android
    const result = await WebBrowser.openAuthSessionAsync(authStartUrl, redirectUrl, IN_APP_BROWSER_OPTIONS_WITH_PROXY);

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
