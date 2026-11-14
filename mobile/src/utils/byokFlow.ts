/** Máquina de estados pura do onboarding BYOK Pluggy (Plano 26). */

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

const EXACT_OAUTH_HOSTS = new Set([
  'accounts.google.com',
  'apis.google.com',
  'ssl.gstatic.com',
  'myaccount.google.com',
  'gds.google.com',
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
    return 'dashboard.pluggy.ai';
  }
}
