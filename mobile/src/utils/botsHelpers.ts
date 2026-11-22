import { parseMascotSkin } from '../components/mascot/mascotPalettes';
import {
  ALWAYS_ASK_ACTIONS,
  ActionPolicy,
  Bot,
  BotAnimState,
  BotSkin,
} from '../types/bots';

export const BOTS_DEFAULT_SUBTITLE = 'Mini assistentes, cada um com uma função só';

/**
 * AC-14: Subtítulo dinâmico do cabeçalho de Bots.
 * - Com pendências: "N ação aguarda sua aprovação" / "N ações aguardam sua aprovação"
 * - Sem pendências: "Mini assistentes, cada um com uma função só"
 */
export function getBotsHeaderSubtitle(bots: Pick<Bot, 'pending'>[]): string {
  const pendingCount = bots.reduce((acc, b) => acc + (b.pending?.length ?? 0), 0);
  if (pendingCount <= 0) {
    return BOTS_DEFAULT_SUBTITLE;
  }
  if (pendingCount === 1) {
    return '1 ação aguarda sua aprovação';
  }
  return `${pendingCount} ações aguardam sua aprovação`;
}

/**
 * AC-03: Ações que alteram algo para terceiros (ex: wasend, share, publish, delete, pay)
 * nunca podem virar 'auto' nem exibir "Sempre permitir".
 */
export function isAlwaysAskAction(actionKey: string, alwaysAskFlag?: boolean): boolean {
  if (alwaysAskFlag) return true;
  return ALWAYS_ASK_ACTIONS.has(actionKey.toLowerCase().trim());
}

/**
 * AC-03: Políticas disponíveis no seletor de ações.
 * Ações ALWAYS só permitem 'ask' ("Aprovar antes") e 'off' ("Desligada").
 */
export function getAvailablePoliciesForAction(
  actionKey: string,
  alwaysAskFlag?: boolean
): ActionPolicy[] {
  if (isAlwaysAskAction(actionKey, alwaysAskFlag)) {
    return ['ask', 'off'];
  }
  return ['auto', 'ask', 'off'];
}

export function getPolicyLabel(policy: ActionPolicy): string {
  switch (policy) {
    case 'auto':
      return 'Automática';
    case 'ask':
      return 'Aprovar antes';
    case 'off':
      return 'Desligada';
  }
}

export function parseBotSkin(skinJson?: string | null, fallbackSkin?: BotSkin): BotSkin {
  return parseMascotSkin(skinJson, fallbackSkin);
}

export function resolveBotAnimState(bot: Pick<Bot, 'status' | 'anim_state' | 'pending' | 'last_run_at'>): BotAnimState {
  if (bot.anim_state) return bot.anim_state;
  if (bot.status === 'paused') return 'sleeping';
  if ((bot.pending?.length ?? 0) > 0) return 'surprised';
  if (bot.status === 'error') return 'thinking';
  return 'idle';
}

export function formatTimeAgoPt(isoDate?: string): string {
  if (!isoDate) return 'Nunca executado';
  const ms = new Date(isoDate).getTime();
  if (Number.isNaN(ms)) return isoDate;
  const diffMin = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if (diffMin < 1) return 'Agora mesmo';
  if (diffMin < 60) return `Há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Há ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  return `Há ${diffD} d`;
}

/**
 * AC-13: Validador puro para garantir zero ocorrências de "radar" ou "radares"
 * em strings visíveis da UI.
 */
export function findRadarCopyViolations(texts: string[]): string[] {
  const regex = /\bradar(?:es)?\b/i;
  return texts.filter((t) => regex.test(t));
}
