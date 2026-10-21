/**
 * Opções do Google Sign-In (Google Play Services) usadas no login nativo.
 *
 * IMPORTANTE — não adicionar `offlineAccess` nem `forceCodeForRefreshToken`:
 * com essas flags o Play Services é obrigado a reexibir a tela de consentimento a cada
 * login (o que faz o Google enviar o e-mail "você compartilhou alguns dados" toda vez)
 * e a tela passa a mostrar apenas a última conta usada, em vez do seletor com todas as
 * contas. A sessão do Vito (access token + refresh token) é emitida pelo backend a partir
 * do ID token, portanto o app não precisa de refresh token do Google.
 */
export const GOOGLE_SIGN_IN_OPTIONS: { webClientId: string } = {
  webClientId: '125131803371-im5dtmilhasug6spdhc50pr0ssb4l92b.apps.googleusercontent.com',
};
