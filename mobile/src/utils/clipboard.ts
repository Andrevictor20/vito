/**
 * Utilitário centralizado para manipulação da área de transferência (Clipboard).
 *
 * Utiliza o expo-clipboard com fallback seguro para ambientes onde o módulo nativo
 * não estiver compilado ou disponível (ex: testes em Node, Web sem permissão, etc).
 */

export interface NativeClipboard {
  setStringAsync: (text: string) => Promise<boolean | void>;
  getStringAsync?: () => Promise<string>;
}

let nativeClipboardModule: NativeClipboard | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  nativeClipboardModule = require('expo-clipboard');
} catch {
  nativeClipboardModule = null;
}

/**
 * Copia um texto para a área de transferência do dispositivo.
 *
 * @param text Texto a ser copiado. Se for vazio ou inválido, a operação é ignorada.
 * @returns Promise<boolean> que resolve true se a cópia ocorreu com sucesso, ou false caso contrário.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof text !== 'string' || text.length === 0) {
    return false;
  }

  try {
    if (nativeClipboardModule && typeof nativeClipboardModule.setStringAsync === 'function') {
      await nativeClipboardModule.setStringAsync(text);
      return true;
    }
    return false;
  } catch (error) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[clipboard] Falha ao copiar texto para a área de transferência:', error);
    }
    return false;
  }
}

/**
 * Injeta ou redefine o módulo Clipboard nativo para execução de testes unitários.
 * Não deve ser chamado em código de produção.
 */
export function __setClipboardModuleForTesting(mock: NativeClipboard | null): void {
  nativeClipboardModule = mock;
}
