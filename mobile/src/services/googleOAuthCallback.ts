/**
 * Parser próprio dos deep links de callback do Google OAuth.
 *
 * Motivação: `Linking.parse` do expo-linking decodifica os query params via
 * `URLSearchParams` e depois chama `decodeURIComponent` novamente (dupla
 * decodificação). Isso corrompe valores que contenham `%` (ex.: nomes como
 * "100%") e pode lançar `URIError`. Aqui a query é decodificada exatamente
 * uma vez, com tolerância a `+` (espaço no formato `application/x-www-form-urlencoded`
 * usado pelo `url.QueryEscape` do backend Go).
 *
 * Módulo puro (sem imports de Expo/React Native) para permitir testes com tsx/Node.
 */

import { User } from '../types';

export type GoogleOAuthCallback =
  | {
      kind: 'success';
      accessToken: string;
      refreshToken?: string;
      sessionId?: string;
      user: User;
      status: string;
    }
  | {
      kind: 'error';
      error: string;
    }
  | {
      kind: 'invalid';
      reason: string;
    };

const OAUTH_CALLBACK_PATH = '/oauth/callback';
const TRUSTED_OAUTH_SCHEMES = ['vito://', 'exp://', 'exps://'];
const TRUSTED_OAUTH_HOSTS = ['vito.rasppi.cloud', 'vitoassistant.rasppi.cloud'];

/**
 * Só aceita origens que pertencem ao próprio app ou ao domínio oficial do Vito.
 * Sem isso, qualquer link `https://atacante/oauth/callback?...` poderia ser
 * interpretado como callback e aplicar uma sessão arbitrária no app.
 */
function hasTrustedOAuthOrigin(rawUrl: string): boolean {
  const lower = rawUrl.toLowerCase();
  if (TRUSTED_OAUTH_SCHEMES.some((scheme) => lower.startsWith(scheme))) {
    return true;
  }
  if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
    return false;
  }
  const authority = lower.slice(lower.indexOf('://') + 3).split(/[/?#]/)[0] || '';
  const host = authority.split(':')[0];
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    TRUSTED_OAUTH_HOSTS.includes(host)
  );
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseQueryString(rawQuery: string): Record<string, string> {
  const result: Record<string, string> = {};
  const query = rawQuery.split('#')[0];
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const separator = pair.indexOf('=');
    const rawKey = separator >= 0 ? pair.slice(0, separator) : pair;
    const rawValue = separator >= 0 ? pair.slice(separator + 1) : '';
    const key = safeDecode(rawKey.replace(/\+/g, ' '));
    const value = safeDecode(rawValue.replace(/\+/g, ' '));
    if (key) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Verifica se a URL é um callback OAuth do Vito.
 * Aceita apenas origens confiáveis (`vito://`, `exp://`, `exps://`, localhost
 * e os domínios oficiais do Vito) e o path canônico `/oauth/callback`.
 */
export function isGoogleOAuthCallbackUrl(rawUrl: string | null | undefined): boolean {
  if (!rawUrl || !hasTrustedOAuthOrigin(rawUrl)) return false;
  const queryIndex = rawUrl.indexOf('?');
  const pathPart = (queryIndex >= 0 ? rawUrl.slice(0, queryIndex) : rawUrl)
    .split('#')[0]
    .replace(/\/+$/, '');
  return pathPart.endsWith(OAUTH_CALLBACK_PATH);
}

/**
 * Extrai e decodifica (uma única vez) os parâmetros de um callback OAuth.
 * Retorna `null` quando a URL não é um callback do Vito.
 */
export function parseOAuthCallbackQuery(
  rawUrl: string | null | undefined
): Record<string, string> | null {
  if (!isGoogleOAuthCallbackUrl(rawUrl)) return null;
  const queryIndex = rawUrl!.indexOf('?');
  if (queryIndex < 0) return {};
  return parseQueryString(rawUrl!.slice(queryIndex + 1));
}

/**
 * Interpreta o deep link de login do Google.
 * - `success`: tokens + usuário prontos para persistir.
 * - `error`: o Google/backend devolveu um erro explícito.
 * - `invalid`: é um callback do Vito, mas sem os dados obrigatórios de sessão.
 * - `null`: não é um callback OAuth do Vito.
 */
export function parseGoogleOAuthCallback(
  rawUrl: string | null | undefined
): GoogleOAuthCallback | null {
  const query = parseOAuthCallbackQuery(rawUrl);
  if (!query) return null;

  const explicitError = query.error || (query.error_description ?? '');
  if (explicitError) {
    return { kind: 'error', error: explicitError };
  }
  if (query.status && query.status !== 'success') {
    return { kind: 'error', error: query.status };
  }

  const accessToken = query.access_token || query.token || '';
  const userJson = query.user || '';
  if (!accessToken || !userJson) {
    return {
      kind: 'invalid',
      reason: 'Resposta de autenticação Google incompleta.',
    };
  }

  let parsedUser: unknown;
  try {
    parsedUser = JSON.parse(userJson);
  } catch {
    return {
      kind: 'invalid',
      reason: 'Falha ao processar dados de usuário do Google.',
    };
  }

  if (
    typeof parsedUser !== 'object' ||
    parsedUser === null ||
    typeof (parsedUser as { id?: unknown }).id !== 'string' ||
    (parsedUser as { id: string }).id.trim() === ''
  ) {
    return {
      kind: 'invalid',
      reason: 'Dados de usuário do Google inválidos.',
    };
  }

  return {
    kind: 'success',
    accessToken,
    refreshToken: query.refresh_token || undefined,
    sessionId: query.session_id || undefined,
    user: parsedUser as User,
    status: query.status || 'success',
  };
}
