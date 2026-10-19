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
export const IN_APP_BROWSER_OPTIONS: any = {
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
