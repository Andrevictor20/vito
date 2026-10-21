/**
 * Política de solicitação da permissão de notificações (Android 13+ / POST_NOTIFICATIONS).
 *
 * Objetivo: o usuário concede a permissão **uma única vez por instalação** e nunca mais
 * sofre com o diálogo do sistema. O app só abre o pedido nativo quando:
 *   - a permissão ainda não foi pedida (primeiro login da instalação), ou
 *   - o usuário pediu explicitamente (ex.: ligando o toggle de notificações no Perfil).
 *
 * Em qualquer outro caso o pedido é dispensado — inclusive quando o sistema já bloqueou
 * de vez a permissão (canAskAgain === false), situação em que a chamada nativa é inútil
 * e o caminho correto é abrir as Configurações do aparelho.
 */

export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface NotificationPermissionInput {
  /** Status atual da permissão segundo o sistema operacional. */
  status: NotificationPermissionStatus;
  /** O sistema ainda permite exibir o diálogo nativo. */
  canAskAgain: boolean;
  /** O app já exibiu o diálogo nativo nesta instalação. */
  alreadyAsked: boolean;
  /** O pedido partiu de uma ação explícita do usuário. */
  userInitiated: boolean;
}

export type NotificationPermissionSkipReason = 'granted' | 'already-asked' | 'blocked';

export type NotificationPermissionDecision =
  | { action: 'skip'; reason: NotificationPermissionSkipReason }
  | { action: 'request' };

export function decideNotificationPermissionRequest(
  input: NotificationPermissionInput
): NotificationPermissionDecision {
  if (input.status === 'granted') {
    return { action: 'skip', reason: 'granted' };
  }

  // Bloqueio definitivo: o Android não exibe mais o diálogo → nada a fazer aqui.
  // A UI deve orientar o usuário a abrir as Configurações do aparelho.
  if (!input.canAskAgain) {
    return { action: 'skip', reason: 'blocked' };
  }

  // Já pedimos uma vez nesta instalação: não incomoda o usuário novamente.
  if (input.alreadyAsked && !input.userInitiated) {
    return { action: 'skip', reason: 'already-asked' };
  }

  return { action: 'request' };
}
