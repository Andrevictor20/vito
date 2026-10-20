// Mapeamento de códigos de erro conhecidos do Google Sign-In.
// A API nativa Android retorna números; o módulo JS expõe statusCodes em string.
export const GOOGLE_SIGN_IN_ERROR_CODES: Record<number, string> = {
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
  // Códigos internos do Google Play Services (GoogleSignInStatusCodes / ApiException).
  // O caso 12500 ("Invalid key value") é o mismatch de SHA-1 do client OAuth Android.
  12500: 'SIGN_IN_FAILED',
  12501: 'SIGN_IN_CANCELLED',
  12502: 'IN_PROGRESS',
  12503: 'PLAY_SERVICES_NOT_AVAILABLE',
};

export interface GoogleSignInErrorLike {
  code?: string | number;
  message?: string;
}

/**
 * Erro explícito de cancelamento do usuário.
 * O GoogleSignin v16 retorna { type: 'cancelled' } sem lançar exceção;
 * convertemos esse retorno em um erro tipado para que o fluxo não caia
 * no fallback web nem exiba mensagem de configuração (SHA-1).
 */
export class GoogleSignInCancelledError extends Error {
  readonly code = 'SIGN_IN_CANCELLED';

  constructor() {
    super('Login com Google cancelado.');
    this.name = 'GoogleSignInCancelledError';
  }
}

function readProperty(target: object, key: string): unknown {
  return Reflect.get(target, key);
}

function toErrorLike(err: unknown): GoogleSignInErrorLike {
  if (typeof err !== 'object' || err === null) {
    return {};
  }
  const rawCode = readProperty(err, 'code');
  const rawMessage = readProperty(err, 'message');
  return {
    code: typeof rawCode === 'string' || typeof rawCode === 'number' ? rawCode : undefined,
    message: typeof rawMessage === 'string' ? rawMessage : undefined,
  };
}

/**
 * Normaliza códigos de erro do Google Sign-In para strings conhecidas.
 * Suporta códigos string (statusCodes do módulo), numéricos (API nativa Android)
 * e códigos numéricos serializados como string (ex.: "10").
 */
export function normalizeGoogleSignInErrorCode(err: unknown): string | null {
  const { code, message } = toErrorLike(err);
  const msg = message || '';

  // O Google Play Services devolve 12500 + "Invalid key value" quando o SHA-1
  // ou o package name diverge. A mensagem é mais específica que o código e
  // precisa prevalecer para acionar o fallback web como erro de configuração.
  if (/invalid key value/i.test(msg)) return 'DEVELOPER_ERROR';

  if (typeof code === 'string') {
    const numericCode = Number(code);
    if (Number.isInteger(numericCode) && GOOGLE_SIGN_IN_ERROR_CODES[numericCode]) {
      return GOOGLE_SIGN_IN_ERROR_CODES[numericCode];
    }
    if (code.trim() !== '') {
      return code;
    }
  }

  if (typeof code === 'number' && GOOGLE_SIGN_IN_ERROR_CODES[code]) {
    return GOOGLE_SIGN_IN_ERROR_CODES[code];
  }

  if (msg.includes('DEVELOPER_ERROR') || msg.includes('10:')) return 'DEVELOPER_ERROR';
  if (msg.includes('SIGN_IN_CANCELLED') || msg.includes('4:') || msg.includes('12501')) return 'SIGN_IN_CANCELLED';
  if (msg.includes('PLAY_SERVICES_NOT_AVAILABLE') || msg.includes('13:') || msg.includes('12503')) {
    return 'PLAY_SERVICES_NOT_AVAILABLE';
  }
  if (msg.includes('IN_PROGRESS') || msg.includes('8:') || msg.includes('12502')) return 'IN_PROGRESS';
  if (msg.includes('NETWORK_ERROR') || msg.includes('6:')) return 'NETWORK_ERROR';
  if (msg.includes('SIGN_IN_FAILED') || msg.includes('16:') || msg.includes('12500')) return 'SIGN_IN_FAILED';

  return null;
}

/**
 * O GoogleSignin v16 sinaliza cancelamento no retorno, não por exceção.
 * Detectar isso antes de checar o idToken evita o falso erro de SHA-1.
 */
export function isCancelledSignInResult(result: unknown): boolean {
  if (typeof result !== 'object' || result === null) {
    return false;
  }
  return readProperty(result, 'type') === 'cancelled';
}

/** Cancelamento genuíno do usuário (ou tentativa concorrente em andamento). */
export function isUserCancellation(err: unknown): boolean {
  const code = normalizeGoogleSignInErrorCode(err);
  if (code === 'SIGN_IN_CANCELLED' || code === 'IN_PROGRESS') {
    return true;
  }
  const { message } = toErrorLike(err);
  return /cancel/i.test(message || '');
}

/** Erro de configuração (SHA-1, package name, etc.) que justifica fallback web. */
export function isConfigurationError(err: unknown): boolean {
  const code = normalizeGoogleSignInErrorCode(err);
  return code === 'DEVELOPER_ERROR' || code === 'SIGN_IN_FAILED' || code === 'API_EXCEPTION';
}

/** Play Services indisponível/desatualizado/desabilitado: justifica fallback web. */
export function isPlayServicesUnavailable(err: unknown): boolean {
  const code = normalizeGoogleSignInErrorCode(err);
  return (
    code === 'PLAY_SERVICES_NOT_AVAILABLE' ||
    code === 'PLAY_SERVICES_VERSION_OUTDATED' ||
    code === 'PLAY_SERVICES_DISABLED'
  );
}
