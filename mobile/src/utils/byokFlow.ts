/** Máquina de estados pura do onboarding BYOK Pluggy (Plano 26). */

import { isPluggyUuid, normalizeKey } from './pluggyKeys';

export type ByokStep = 'tutorial' | '1' | '2' | '3' | 'done';

export interface ByokPersisted {
  hasKeys: boolean;
  tutorialSeen: boolean;
  step: ByokStep | null;
}

const ORDER: ByokStep[] = ['tutorial', '1', '2', '3', 'done'];

export function isByokStep(v: unknown): v is ByokStep {
  return typeof v === 'string' && (ORDER as string[]).includes(v);
}

/** Etapa em que o fluxo deve (re)abrir. Sem chaves salvas nunca passa da Etapa 1. */
export function initialStep(p: ByokPersisted): ByokStep {
  if (!p.hasKeys) return p.tutorialSeen ? '1' : 'tutorial';
  if (p.step === 'done' || p.step === '3' || p.step === '2') return p.step;
  return '2';
}

/** Modo atalho: chaves já validadas e fluxo concluído ao menos uma vez. */
export function isShortcutMode(p: ByokPersisted): boolean {
  return p.hasKeys && p.step === 'done';
}

/** Uma etapa só está liberada se todas as anteriores foram cumpridas. */
export function isStepUnlocked(step: '1' | '2' | '3', current: ByokStep, hasKeys: boolean): boolean {
  if (step === '1') return true;
  if (!hasKeys) return false;
  if (step === '2') return true;
  return current === '3' || current === 'done';
}

export function nextAfter(step: ByokStep): ByokStep {
  const i = ORDER.indexOf(step);
  return ORDER[Math.min(i + 1, ORDER.length - 1)];
}

/** Resultado da confirmação da Etapa 2: só avança com ≥ 1 item na Pluggy. */
export function step2Outcome(itemCount: number): { advance: boolean; message: string } {
  if (itemCount > 0) return { advance: true, message: '' };
  return {
    advance: false,
    message:
      'Ainda não encontramos nenhum banco conectado. Abra o Meu Pluggy, conecte pelo menos um banco e volte aqui.',
  };
}

/** Extrai o itemId do retorno `vito://pluggy-success?itemId=...`. */
export function parseItemId(url: string | undefined | null): string {
  if (!url) return '';
  const m = url.match(/[?&]item(?:Id|_id)=([^&#]+)/);
  if (!m) return '';
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return '';
  }
}

export interface SyncCheckpointDef {
  title: string;
  subtitle: string;
}

/** 6 checkpoints do fluxo de sincronização (`syncV` em Vito-telas-atualizadas.html). */
export const BYOK_SYNC_CHECKPOINTS: readonly SyncCheckpointDef[] = [
  { title: 'Autenticando na Pluggy', subtitle: 'POST /auth · celular → api.pluggy.ai' },
  { title: 'Gerando token de conexão', subtitle: 'POST /connect_token · clientUserId' },
  { title: 'Recebendo itemId', subtitle: 'vito://pluggy-success?itemId=…' },
  { title: 'Salvando conexão no servidor', subtitle: 'POST /api/v1/finance/connections' },
  { title: 'Lendo contas, extrato e faturas', subtitle: 'GET /accounts · /v2/transactions · /bills' },
  { title: 'Enviando ao servidor · Edge-Sync', subtitle: 'POST /api/v1/finance/sync' },
];

export const WEBVIEW_CHROME_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

const EXACT_OAUTH_HOSTS = new Set([
  'accounts.google.com',
  'accounts.youtube.com',
  'apis.google.com',
  'consent.google.com',
  'gds.google.com',
  'myaccount.google.com',
  'ogs.google.com',
  'oauth2.googleapis.com',
  'www.googleapis.com',
  'www.google.com',
  'ssl.gstatic.com',
  'www.gstatic.com',
  'fonts.gstatic.com',
  'www.recaptcha.net',
  'recaptcha.net',
  'github.com',
  'api.github.com',
  'login.microsoftonline.com',
  'login.live.com',
  'appleid.apple.com',
  'challenges.cloudflare.com',
]);

/**
 * Restrição estrita de URL para a WebView da Etapa 1 (`PluggyDashboardWebView`):
 * aceita apenas HTTPS para `*.pluggy.ai` e provedores OAuth oficiais usados pelo Dashboard.
 * Bloqueia `http://`, `file://`, `javascript:`, `data:` e domínios externos arbitrários.
 */
export function isAllowedPluggyWebViewUrl(url: string, isTopFrame = true): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed === 'about:blank') return !isTopFrame;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password) return false;

  const host = parsed.hostname.toLowerCase();
  if (host === 'pluggy.ai' || host.endsWith('.pluggy.ai')) return true;
  if (host === 'auth0.com' || host.endsWith('.auth0.com')) return true;
  if (!isTopFrame && (host.endsWith('.gstatic.com') || host.endsWith('.googleusercontent.com'))) {
    return true;
  }
  return EXACT_OAUTH_HOSTS.has(host);
}

/** Garante que postMessage da WebView venha estritamente de host HTTPS `*.pluggy.ai` (ex: `dashboard.pluggy.ai`). */
export function isPluggyDashboardUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return false;
    const host = parsed.hostname.toLowerCase();
    return host === 'dashboard.pluggy.ai' || host === 'pluggy.ai' || host.endsWith('.pluggy.ai');
  } catch {
    return false;
  }
}

/** Formata a URL atual para exibição segura na barra superior da WebView. */
export function formatWebViewDisplayUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    return `${parsed.hostname}${path}`;
  } catch {
    return 'pluggy.ai';
  }
}

const DANGEROUS_SCHEMES = new Set(['javascript:', 'file:', 'data:', 'blob:', 'vbscript:', 'about:']);

/**
 * Classifica navegações da WebView do Meu Pluggy e Pluggy Connect:
 * - `vito_success`: callback de conclusão com itemId;
 * - `allow`: domínio HTTPS oficial Pluggy/OAuth na WebView;
 * - `external`: app bancário (nubank://, itau://, intent://, etc.) para abrir nativamente;
 * - `block`: esquemas inseguros (`javascript:`, `file:`, `data:`, `http://`).
 */
export function classifyPortalNavigation(
  url: string,
  isTopFrame = true,
): 'allow' | 'vito_success' | 'external' | 'block' {
  if (!url || typeof url !== 'string') return 'block';
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();

  if (lower.startsWith('vito://pluggy-success')) return 'vito_success';
  if (trimmed === 'about:blank') return isTopFrame ? 'block' : 'allow';
  if (isAllowedPluggyWebViewUrl(trimmed, isTopFrame)) return 'allow';

  const colonIdx = lower.indexOf(':');
  if (colonIdx <= 0) return 'block';
  const scheme = lower.slice(0, colonIdx + 1);
  if (DANGEROUS_SCHEMES.has(scheme) || scheme === 'http:') return 'block';

  // Links externos de bancos Open Finance (apps nativos ou app links top-level)
  if (scheme === 'https:') {
    if (!isTopFrame) return 'block';
    try {
      const parsed = new URL(trimmed);
      if (parsed.username || parsed.password) return 'block';
      return 'external';
    } catch {
      return 'block';
    }
  }

  return isTopFrame ? 'external' : 'block';
}

export interface ParsedConnectItemMessage {
  itemId: string;
  status?: string;
  source: 'network' | 'postmessage';
}

/** Faz parse seguro de eventos de itemId capturados em `connect.pluggy.ai`. */
export function parsePluggyConnectItemMessage(raw: string): ParsedConnectItemMessage | null {
  if (!raw || typeof raw !== 'string') return null;
  let parsed: Record<string, unknown>;
  try {
    const json: unknown = JSON.parse(raw);
    if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
    parsed = json as Record<string, unknown>;
  } catch {
    return null;
  }
  if (parsed.type !== 'pluggy_connect_item') return null;
  const itemId = typeof parsed.itemId === 'string' ? normalizeKey(parsed.itemId) : '';
  if (!isPluggyUuid(itemId)) return null;
  const status = typeof parsed.status === 'string' ? parsed.status.trim() : undefined;
  const source = parsed.source === 'postmessage' ? 'postmessage' : 'network';
  return { itemId, status, source };
}

/** Monta URL do widget Pluggy Connect focado no conector Meu Pluggy (ID 200). */
export function buildPluggyConnectUrl(connectToken: string, isDark: boolean): string {
  const tok = encodeURIComponent(connectToken);
  return (
    `https://connect.pluggy.ai/?connect_token=${tok}&connectToken=${tok}` +
    `&includeSandbox=false&selectedConnectorId=200&theme=${isDark ? 'dark' : 'light'}`
  );
}

/** Combina sugestões de UUID da área de transferência com os campos atuais. */
export function mergeClipboardSuggestion(
  clipboardUuids: string[],
  clientId: string,
  clientSecret: string,
  target?: 'id' | 'secret',
): { nextId: string; nextSec: string } {
  if (clipboardUuids.length >= 2) {
    return { nextId: clipboardUuids[0], nextSec: clipboardUuids[1] };
  }
  const dest = target ?? (!clientId ? 'id' : 'secret');
  return dest === 'id'
    ? { nextId: clipboardUuids[0], nextSec: clientSecret }
    : { nextId: clientId, nextSec: clipboardUuids[0] };
}
