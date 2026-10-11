export type MainTabType = 'chat' | 'calendar' | 'triggers';

export const TAB_ORDER: readonly MainTabType[] = ['chat', 'calendar', 'triggers'] as const;

/**
 * Retorna o índice numérico correspondente à aba informada.
 */
export function getIndexForTab(tab: MainTabType): number {
  const index = TAB_ORDER.indexOf(tab);
  return index >= 0 ? index : 0;
}

/**
 * Retorna a aba correspondente ao índice numérico, com proteção contra limites.
 */
export function getTabForIndex(index: number): MainTabType {
  if (index <= 0) return TAB_ORDER[0];
  if (index >= TAB_ORDER.length - 1) return TAB_ORDER[TAB_ORDER.length - 1];
  return TAB_ORDER[index];
}

/**
 * Calcula o índice da página mais próxima com base no deslocamento horizontal e largura do container.
 */
export function calculatePageIndex(contentOffsetX: number, screenWidth: number): number {
  if (screenWidth <= 0) return 0;
  const rawIndex = Math.round(contentOffsetX / screenWidth);
  return Math.max(0, Math.min(rawIndex, TAB_ORDER.length - 1));
}

/**
 * Calcula a posição X em pixels para a rolagem programada da aba informada.
 */
export function calculateScrollTarget(tab: MainTabType, screenWidth: number): number {
  const index = getIndexForTab(tab);
  return Math.max(0, index * screenWidth);
}

/**
 * Avalia se o gesto de swipe horizontal deve ser temporariamente prevenido
 * (por exemplo, quando o usuário está digitando no chat ou interagindo com modal/sub-tela).
 */
export function shouldPreventSwipe(params: {
  isKeyboardOpen: boolean;
  hasModal: boolean;
  hasSubScreen: boolean;
}): boolean {
  return params.isKeyboardOpen || params.hasModal || params.hasSubScreen;
}

export type BackAction =
  | { type: 'CLOSE_SUBSCREEN'; handled: true }
  | { type: 'CLOSE_MODAL'; handled: true }
  | { type: 'NAVIGATE_TO_TAB'; targetTab: MainTabType; handled: true }
  | { type: 'EXIT_APP'; handled: false };

/**
 * Determina a ação hierárquica a ser executada no botão Voltar do sistema/Android.
 */
export function determineBackAction(params: {
  activeTab: MainTabType;
  hasSubScreen: boolean;
  hasModal: boolean;
}): BackAction {
  if (params.hasSubScreen) {
    return { type: 'CLOSE_SUBSCREEN', handled: true };
  }
  if (params.hasModal) {
    return { type: 'CLOSE_MODAL', handled: true };
  }
  if (params.activeTab !== 'chat') {
    return { type: 'NAVIGATE_TO_TAB', targetTab: 'chat', handled: true };
  }
  return { type: 'EXIT_APP', handled: false };
}
