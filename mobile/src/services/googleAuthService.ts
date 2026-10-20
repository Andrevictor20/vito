import * as Linking from 'expo-linking';
import { User } from '../types';
import { getMobileDeviceName, IN_APP_BROWSER_OPTIONS, IN_APP_BROWSER_OPTIONS_WITH_PROXY } from '../utils/platformInfo';
import {
  isGoogleOAuthCallbackUrl,
  parseGoogleOAuthCallback,
  parseOAuthCallbackQuery,
} from './googleOAuthCallback';
import {
  GoogleSignInCancelledError,
  isCancelledSignInResult,
  isConfigurationError,
  isPlayServicesUnavailable,
  isUserCancellation,
  normalizeGoogleSignInErrorCode,
} from './googleSignInErrors';

export { getMobileDeviceName, IN_APP_BROWSER_OPTIONS, IN_APP_BROWSER_OPTIONS_WITH_PROXY };

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

// Janela de tolerância no Android: o `openAuthSessionAsync` resolve { type: 'dismiss' }
// assim que o app volta a ficar ativo, potencialmente antes de o evento de deep link
// ser despachado pelo sistema para o Linking.
const OAUTH_REDIRECT_GRACE_MS = 2000;

interface OAuthBrowserFlowMessages {
  label: string;
  cancel: string;
  failure: string;
}

function waitForRedirectGracePeriod(): Promise<null> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(null), OAUTH_REDIRECT_GRACE_MS);
  });
}

function matchesOAuthRedirect(candidate: string, redirectUrl: string): boolean {
  const expected = redirectUrl.replace(/\/+$/, '');
  const withoutHash = candidate.split('#')[0];
  if (
    withoutHash === expected ||
    withoutHash.startsWith(`${expected}?`) ||
    withoutHash.startsWith(`${expected}/?`)
  ) {
    return true;
  }
  // O Android pode normalizar o scheme/URL do deep link; o path canônico
  // /oauth/callback é o discriminante confiável.
  return isGoogleOAuthCallbackUrl(candidate);
}

/**
 * Abre o navegador in-app e aguarda o callback OAuth por duas vias simultâneas:
 * 1. o retorno do `openAuthSessionAsync` (quando o expo-web-browser consegue
 *    capturar o redirect dentro da própria Custom Tab);
 * 2. o listener de `Linking` (quando o Android entrega o deep link ao MainActivity).
 *
 * A corrida evita a perda do callback quando o app volta a ficar ativo antes de
 * o evento de URL ser despachado, incluindo uma pequena janela de tolerância
 * após `dismiss`/`cancel`.
 */
async function openOAuthBrowserAndWait(
  authStartUrl: string,
  redirectUrl: string,
  browserOptions: Record<string, unknown>,
  messages: OAuthBrowserFlowMessages
): Promise<string> {
  if (WebBrowser === null || typeof WebBrowser.openAuthSessionAsync !== 'function') {
    throw new Error('Esta versão do aplicativo não suporta a autenticação com Google.');
  }

  let resolveRedirect: ((url: string) => void) | null = null;
  const redirectPromise = new Promise<string>((resolve) => {
    resolveRedirect = resolve;
  });

  const deliverRedirect = (url: string | null | undefined) => {
    if (!url || !resolveRedirect || !matchesOAuthRedirect(url, redirectUrl)) return;
    const resolve = resolveRedirect;
    resolveRedirect = null;
    resolve(url);
  };

  const subscription = Linking.addEventListener('url', (event: { url: string }) => {
    deliverRedirect(event.url);
  });

  try {
    console.log(`[googleAuthService] Abrindo navegador OAuth (${messages.label})`);
    console.log(`[googleAuthService] URL de início (${messages.label}):`, authStartUrl);
    console.log(`[googleAuthService] Redirect esperado (${messages.label}):`, redirectUrl);

    const browserOutcome = WebBrowser.openAuthSessionAsync(
      authStartUrl,
      redirectUrl,
      browserOptions
    )
      .then((result: any) => ({ source: 'browser' as const, result }))
      .catch((error: unknown) => ({ source: 'browser-error' as const, error }));

    const firstOutcome = await Promise.race([
      browserOutcome,
      redirectPromise.then((url) => ({ source: 'redirect' as const, url })),
    ]);

    if (firstOutcome.source === 'redirect') {
      // O deep link chegou antes do WebBrowser concluir: fecha a aba para não
      // deixar uma Custom Tab órfã na frente do app.
      try {
        await WebBrowser.dismissBrowser?.();
      } catch {}
      console.log(`[googleAuthService] Callback capturado via Linking (${messages.label})`);
      return firstOutcome.url;
    }

    if (firstOutcome.source === 'browser-error') {
      console.warn(`[googleAuthService] Navegador falhou (${messages.label}):`, firstOutcome.error);
      throw firstOutcome.error;
    }

    const result = firstOutcome.result;
    console.log(
      `[googleAuthService] Resultado do navegador (${messages.label}):`,
      JSON.stringify(result)
    );

    if (result?.type === 'success' && typeof result.url === 'string') {
      return result.url;
    }

    if (result?.type === 'cancel' || result?.type === 'dismiss') {
      // No Android, o app pode voltar a ficar ativo antes do evento de URL.
      const lateRedirect = await Promise.race([redirectPromise, waitForRedirectGracePeriod()]);
      if (lateRedirect) {
        console.log(
          `[googleAuthService] Callback capturado na janela de tolerância (${messages.label})`
        );
        return lateRedirect;
      }
      throw new Error(messages.cancel);
    }

    throw new Error(messages.failure);
  } finally {
    subscription.remove();
  }
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

        // v16 do módulo retorna { type: 'cancelled' } ao fechar o seletor de contas,
        // sem lançar exceção. Tratar aqui evita o falso erro de "SHA-1" e o fallback web indevido.
        if (isCancelledSignInResult(signinResult)) {
          console.log('[googleAuthService] Usuário fechou o seletor de contas do Google (type=cancelled)');
          throw new GoogleSignInCancelledError();
        }

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
          throw new GoogleSignInCancelledError();
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

    // 2. Fallback Web Seguro com Custom Tabs integrado (proxy activity + task própria)
    if (WebBrowser === null || typeof WebBrowser.openAuthSessionAsync !== 'function') {
      throw new Error('A autenticação com Google requer a versão mais recente do aplicativo.');
    }

    console.log('[googleAuthService] Iniciando fallback web com WebBrowser.openAuthSessionAsync');

    const redirectUrl = Linking.createURL('oauth/callback');
    const authStartUrl = `${serverUrl.replace(/\/+$/, '')}/api/v1/auth/google/start?mode=login&redirect_scheme=${encodeURIComponent(redirectUrl)}&device_name=${encodeURIComponent(deviceName)}`;

    const callbackUrl = await openOAuthBrowserAndWait(
      authStartUrl,
      redirectUrl,
      IN_APP_BROWSER_OPTIONS_WITH_PROXY,
      {
        label: 'login',
        cancel: 'Login com Google cancelado.',
        failure: 'Falha ao abrir autenticação Google.',
      }
    );

    const callback = parseGoogleOAuthCallback(callbackUrl);
    if (!callback) {
      console.error('[googleAuthService] URL de callback não reconhecida:', callbackUrl);
      throw new Error('Resposta de autenticação Google incompleta.');
    }
    if (callback.kind === 'error') {
      console.error('[googleAuthService] Google retornou erro no callback:', callback.error);
      throw new Error(`Google retornou erro: ${callback.error}`);
    }
    if (callback.kind === 'invalid') {
      console.error('[googleAuthService] Callback OAuth inválido:', callback.reason);
      throw new Error(callback.reason);
    }

    console.log('[googleAuthService] Login via fallback web bem-sucedido para:', callback.user.email);
    return {
      token: callback.accessToken,
      accessToken: callback.accessToken,
      refreshToken: callback.refreshToken,
      sessionId: callback.sessionId,
      user: callback.user,
    };
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

    const callbackUrl = await openOAuthBrowserAndWait(
      authStartUrl,
      redirectUrl,
      IN_APP_BROWSER_OPTIONS_WITH_PROXY,
      {
        label: 'calendar',
        cancel: 'Conexão com Google Calendar cancelada.',
        failure: 'Falha ao conectar com o Google Calendar.',
      }
    );

    const query = parseOAuthCallbackQuery(callbackUrl) || {};

    if (query.error) {
      throw new Error(`Permissão de calendário negada ou erro: ${query.error}`);
    }

    const status = query.status || 'success';
    const email = query.email || '';

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

    const callbackUrl = await openOAuthBrowserAndWait(
      authStartUrl,
      redirectUrl,
      IN_APP_BROWSER_OPTIONS_WITH_PROXY,
      {
        label: 'gmail',
        cancel: 'Conexão com Gmail cancelada.',
        failure: 'Falha ao conectar com o Gmail.',
      }
    );

    const query = parseOAuthCallbackQuery(callbackUrl) || {};

    if (query.error) {
      throw new Error(`Permissão do Gmail negada ou erro: ${query.error}`);
    }

    const status = query.status || 'success';
    const email = query.email || '';

    return { status, email };
  },
};
