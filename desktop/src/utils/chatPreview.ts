// Higienização de títulos e prévias de chat no Desktop.

const TECH_PATTERNS = [
  /fetch failed/i,
  /unknownhost/i,
  /java\.net\./i,
  /HTTP \d{3}/,
  /exception/i,
  /stack ?trace/i,
  /TypeError|ReferenceError|SyntaxError/,
  /https?:\/\/\S+/,
];

/** Remove quebras de linha, colapsa espaços e corta no limite sem quebrar palavra. */
export function cleanSnippet(raw: string, maxLen = 32): string {
  const flat = (raw || '').replace(/\s+/g, ' ').trim();
  if (flat.length <= maxLen) return flat;
  const cut = flat.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > maxLen / 2 ? cut.slice(0, lastSpace) : cut).trim() + '...';
}

/** Título semântico a partir da primeira mensagem do usuário. */
export function semanticTitle(firstUserText: string | undefined, fallback = 'Conversa Atual'): string {
  if (!firstUserText || !firstUserText.trim()) return fallback;
  const head = firstUserText.trim().split(/[.!?\n]/)[0];
  return cleanSnippet(head, 34) || fallback;
}

/** Prévia segura: troca texto com cara de erro técnico por mensagem elegante. */
export function humanizePreview(raw: string | undefined): string {
  const text = (raw || '').trim();
  if (!text) return 'Sem mensagens';
  if (TECH_PATTERNS.some((re) => re.test(text))) {
    return 'Falha de conexão — toque para resgatar a conversa';
  }
  return text.length > 60 ? cleanSnippet(text, 60) : text;
}
