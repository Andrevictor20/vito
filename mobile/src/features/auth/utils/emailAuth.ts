export interface EmailAuthInput {
  email: string
  password: string
  name?: string
  isRegister: boolean
}

export function validateEmailAuth(input: EmailAuthInput): string | null {
  const email = input.email.trim().toLowerCase()
  const password = input.password
  const name = (input.name ?? '').trim()

  if (!email || !password || (input.isRegister && !name)) {
    return 'Preencha todos os campos obrigatórios.'
  }
  if (!email.includes('@') || !email.includes('.')) {
    return 'Informe um endereço de e-mail válido.'
  }
  if (password.length < 6) {
    return 'A senha deve ter no mínimo 6 caracteres.'
  }
  return null
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function mapGoogleAuthError(message: string): string | null {
  if (
    message === 'Login com Google cancelado.' ||
    message === 'Login com Google já em andamento.'
  ) {
    return null
  }
  if (
    message.includes('não retornou token de identificação') ||
    message.includes('Verifique a configuração do SHA-1')
  ) {
    return 'Falha no login nativo do Google. Verifique se o app está assinado com a keystore correta e o SHA-1 está cadastrado no Google Cloud Console.'
  }
  if (message.includes('Falha no login com Google nativo:')) {
    return message.replace('Falha no login com Google nativo: ', 'Erro do servidor: ')
  }
  if (
    message.includes('DEVELOPER_ERROR') ||
    message.includes('SIGN_IN_FAILED') ||
    message.includes('configuração do Google')
  ) {
    return 'Configuração do Google Sign-In inválida. O SHA-1 do app não confere com o Google Cloud Console. Use o fallback web ou verifique a assinatura do APK.'
  }
  return message || 'Falha ao autenticar com o Google. Tente novamente.'
}

export function mapNetworkAuthError(message: string, serverUrl: string): string {
  if (
    message.includes('Network') ||
    message.includes('fetch') ||
    message.includes('Failed') ||
    message.includes('esgotado') ||
    message.includes('AbortError')
  ) {
    return `Falha ao conectar no servidor (${serverUrl || 'vito.rasppi.cloud'}). Verifique sua conexão com a internet.`
  }
  return message || 'Falha ao autenticar.'
}
