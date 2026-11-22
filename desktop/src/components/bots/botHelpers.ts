import { ActionPolicy, Bot, BotAppStatus, isAlwaysAskAction } from '../../types/bot';

/**
 * Gera o subtítulo dinâmico da tela Bots (AC-14).
 */
export function getBotsHeaderSubtitle(bots: Bot[]): string {
  const totalPending = bots.reduce((sum, b) => sum + (b.pending?.length || 0), 0);
  if (totalPending > 0) {
    return totalPending === 1
      ? '1 ação aguarda sua aprovação'
      : `${totalPending} ações aguardam sua aprovação`;
  }
  return 'Mini assistentes, cada um com uma função só';
}

/**
 * Opções de política permitidas para uma ação (AC-03: ALWAYS nunca permite 'auto').
 */
export function getAllowedPolicyOptions(
  actionKey: string,
  alwaysAsk?: boolean
): Array<{ value: ActionPolicy; label: string }> {
  if (isAlwaysAskAction(actionKey, alwaysAsk)) {
    return [
      { value: 'ask', label: 'Aprovar antes' },
      { value: 'off', label: 'Desligada' },
    ];
  }
  return [
    { value: 'auto', label: 'Automática' },
    { value: 'ask', label: 'Aprovar antes' },
    { value: 'off', label: 'Desligada' },
  ];
}

const APP_META: Record<string, { label: string; short: string; color: string }> = {
  vito: { label: 'Vito', short: 'V', color: '#0b9a5f' },
  web: { label: 'Web', short: 'W', color: '#2b7fd4' },
  fin: { label: 'Finanças', short: 'F', color: '#0e8f9b' },
  gcal: { label: 'Agenda', short: 'A', color: '#2b7fd4' },
  gmail: { label: 'Gmail', short: 'G', color: '#d6355a' },
  wa: { label: 'WhatsApp', short: 'WA', color: '#0b9a5f' },
  outlook: { label: 'Outlook', short: 'O', color: '#2b7fd4' },
  maps: { label: 'Google Maps', short: 'M', color: '#d9681a' },
  trello: { label: 'Trello', short: 'T', color: '#2b7fd4' },
};

export function getAppMeta(appKey: string) {
  return APP_META[appKey] || { label: appKey, short: appKey.slice(0, 2).toUpperCase(), color: '#69706d' };
}

export function getBotAppsFooter(bot: Bot, globalApps?: BotAppStatus[]): BotAppStatus[] {
  if (bot.apps && bot.apps.length > 0) {
    return bot.apps;
  }
  const keys = Array.from(new Set((bot.actions || []).map((a) => a.app_key)));
  return keys.map((k) => {
    const found = globalApps?.find((g) => g.app_key === k);
    return found || { app_key: k, name: getAppMeta(k).label, connected: k === 'vito' || k === 'web' };
  });
}

export const VITO_CHIP_PROMPTS: Array<{ label: string; prompt: string }> = [
  { label: 'Resumo da manhã', prompt: 'Vito, cria um bot para me dar um resumo da manhã todo dia às 7h30.' },
  { label: 'Hora de sair', prompt: 'Vito, cria um bot para me avisar a hora de sair para meus compromissos.' },
  { label: 'Editais', prompt: 'Vito, cria um bot para garimpar novos editais e preparar prazos.' },
  { label: 'Fatura', prompt: 'Vito, cria um bot para ler faturas no meu e-mail e criar tarefas antes do vencimento.' },
];
