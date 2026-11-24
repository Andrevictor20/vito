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
 * Trunca a lista de mensagens no ponto da mensagem editada (estilo ChatGPT/Gemini/Claude),
 * descartando todas as respostas e mensagens subsequentes e atualizando o texto da mensagem editada.
 */
export function truncateMessagesForEdit<T extends { id: string; text: string }>(
  messages: T[],
  messageIdToEdit: string,
  newText: string
): T[] {
  const index = messages.findIndex((m) => m.id === messageIdToEdit);
  if (index === -1) {
    return messages;
  }

  const updatedTarget: T = {
    ...messages[index],
    text: newText.trim(),
  };

  return [...messages.slice(0, index), updatedTarget];
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

