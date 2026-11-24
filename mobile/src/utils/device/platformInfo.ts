/**
 * Utilitário de detecção de plataforma e opções in-app de navegador.
 * Desacoplado de bibliotecas nativas para execução ágil e sem efeitos colaterais
 * tanto no runtime Hermes/React Native quanto nos testes Node.js/tsx.
 */

export function getPlatformOS(): 'android' | 'ios' | 'web' {
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('android')) return 'android';
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) return 'ios';
  }
  if (typeof global !== 'undefined' && (global as any).Platform?.OS) {
    return (global as any).Platform.OS;
  }
  return 'android';
}

export function getMobileDeviceName(): string {
  const os = getPlatformOS();
  if (os === 'ios') {
    return 'iPhone / iOS (Vito App)';
  }
  return 'Android (Vito App)';
}

/**
 * Opções de imersão In-App Custom Tabs / SKSafariViewController.
 * Mantém o fluxo 100% contido dentro do próprio aplicativo Vito,
 * sem abrir janelas externas separadas no gerenciador de tarefas do Android.
 */
export const IN_APP_BROWSER_OPTIONS: Readonly<{
  toolbarColor: string;
  secondaryToolbarColor: string;
  controlsColor: string;
  createTask: boolean;
  useProxyActivity: boolean;
  showInRecents: boolean;
  enableDefaultShareMenuItem: boolean;
  enableBarCollapsing: boolean;
  showTitle: boolean;
  presentationStyle: string;
  dismissButtonStyle: string;
  preferEphemeralSession: boolean;
}> = {
  // Paleta True OLED do Vito
  toolbarColor: '#0B0D10',
  secondaryToolbarColor: '#14171C',
  controlsColor: '#FFFFFF',
  // Android Custom Tabs dentro da mesma tarefa do app Vito
  createTask: false,
  useProxyActivity: false,
  showInRecents: false,
  enableDefaultShareMenuItem: false,
  enableBarCollapsing: true,
  showTitle: false,
  // iOS PageSheet nativo deslizante sobreposto
  presentationStyle: 'pageSheet',
  dismissButtonStyle: 'close',
  preferEphemeralSession: false,
};

/**
 * Opções de navegador in-app com proxy activity para garantir que o deep link
 * (ex: vito://oauth/callback) seja interceptado confiavelmente no Android.
 * DEVE ser usado em TODOS os fluxos de autenticação OAuth (login, calendar, gmail)
 * onde o app precisa receber o callback via deep link após o navegador fechar.
 *
 * `createTask: true` é obrigatório: o `CustomTabsActivitiesHelper` do expo-web-browser
 * só respeita `useProxyActivity` quando `shouldCreateTask` é verdadeiro. Sem isso, a
 * Custom Tab compartilha a task do app e o `singleTask` do MainActivity pode destruí-la
 * antes de o redirect ser entregue ao JavaScript.
 */
export const IN_APP_BROWSER_OPTIONS_WITH_PROXY: typeof IN_APP_BROWSER_OPTIONS = {
  ...IN_APP_BROWSER_OPTIONS,
  createTask: true,
  useProxyActivity: true,
};
