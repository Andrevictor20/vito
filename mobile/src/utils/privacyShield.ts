export const VERIFIED_UNIVERSAL_LINK_ORIGIN = 'https://vito.rasppi.cloud';

/**
 * Determina se o escudo de privacidade deve cobrir a tela no multitarefa do SO.
 * Ativo apenas em plataformas nativas (Android / iOS) quando o AppState sai de 'active'.
 */
export const shouldShowPrivacyShield = (
  appState: string,
  platformOS: string = 'android'
): boolean => {
  if (platformOS === 'web') {
    return false;
  }
  return appState === 'background' || appState === 'inactive';
};

/**
 * Verifica se uma URL pertence ao domínio verificado de App Links / Universal Links do Vito.
 */
export const isVerifiedUniversalLinkPrefix = (url: string): boolean => {
  if (!url) return false;
  const trimmed = url.trim();
  return (
    trimmed === VERIFIED_UNIVERSAL_LINK_ORIGIN ||
    trimmed.startsWith(`${VERIFIED_UNIVERSAL_LINK_ORIGIN}/`)
  );
};
