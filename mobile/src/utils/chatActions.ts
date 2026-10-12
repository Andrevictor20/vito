/**
 * Utilitários puros para ações modernas de chat (Copiar, Editar, Abortar requisições)
 */

/**
 * Prepara o texto markdown para a área de transferência,
 * higienizando cabeçalhos e formatações pesadas e convertendo listas para bullets limpos.
 */
export function preparePlainTextForCopy(rawText: string): string {
  if (!rawText) return '';

  return rawText
    // Remove cabeçalhos markdown (###, ##, #)
    .replace(/^#{1,6}\s+/gm, '')
    // Converte listas com asterisco ou traço (* item, - item) em bullets elegantes
    .replace(/^[\*\-]\s+/gm, '• ')
    // Remove delimitadores de negrito **
    .replace(/\*\*(.*?)\*\*/g, '$1')
    // Remove asteriscos soltos
    .replace(/\*/g, '')
    .trim();
}

/**
 * Prepara o rascunho de edição para o campo de digitação.
 */
export function prepareEditDraft(currentInput: string, messageToEdit: string): string {
  const trimmed = (messageToEdit || '').trim();
  return trimmed || currentInput;
}

/**
 * Detecta se o erro capturado foi um cancelamento intencional da requisição pelo usuário.
 */
export function isAbortError(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === 'object') {
    const errorObj = err as { name?: string; message?: string };
    if (errorObj.name === 'AbortError') return true;
    if (errorObj.message === 'USER_CANCELLED') return true;
    if (errorObj.message?.toLowerCase().includes('aborted')) return true;
  }
  return false;
}
