export interface ParsedReportData {
  status?: string;
  condition_met?: boolean;
  data?: string;
  paragraphs?: string[];
  simulated_notification?: string;
  tested_at?: string;
  confidence?: number;
  why_relevant?: string;
  summary?: string;
  last_error?: string;
}

function tryParseJsonString(str: unknown): any {
  if (typeof str !== 'string') return null;
  const trimmed = str.trim();
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  return null;
}

export function parseReportPayload(payload?: string, message?: string): ParsedReportData | null {
  const parsedFromPayload = tryParseJsonString(payload);
  if (parsedFromPayload && typeof parsedFromPayload === 'object') {
    return parsedFromPayload;
  }
  const parsedFromMessage = tryParseJsonString(message);
  if (parsedFromMessage && typeof parsedFromMessage === 'object') {
    return parsedFromMessage;
  }
  return null;
}

export function extractReportParagraphs(
  message?: string,
  payload?: string
): string[] {
  const parsed = parseReportPayload(payload, message);

  if (parsed?.paragraphs && Array.isArray(parsed.paragraphs) && parsed.paragraphs.length > 0) {
    const unwrapped: string[] = [];
    for (const item of parsed.paragraphs) {
      const trimmed = (item || '').trim();
      const jsonObj = tryParseJsonString(trimmed);
      if (jsonObj && typeof jsonObj === 'object') {
        if (Array.isArray(jsonObj.paragraphs) && jsonObj.paragraphs.length > 0) {
          unwrapped.push(...jsonObj.paragraphs.map((p: any) => String(p).trim()).filter(Boolean));
        } else if (jsonObj.summary) {
          unwrapped.push(String(jsonObj.summary).trim());
        } else if (jsonObj.data) {
          unwrapped.push(String(jsonObj.data).trim());
        }
      } else if (trimmed && !trimmed.startsWith('{') && !trimmed.startsWith('{"')) {
        unwrapped.push(trimmed);
      }
    }
    if (unwrapped.length > 0) {
      return unwrapped;
    }
  }

  const rawText = parsed?.data || parsed?.summary || message || '';
  if (!rawText) return [];

  const rawJson = tryParseJsonString(rawText);
  if (rawJson && typeof rawJson === 'object') {
    if (Array.isArray(rawJson.paragraphs) && rawJson.paragraphs.length > 0) {
      return rawJson.paragraphs.map((p: any) => String(p).trim()).filter(Boolean);
    }
    if (rawJson.summary) {
      return [String(rawJson.summary).trim()];
    }
  }

  const parts = rawText
    .split(/\n{1,2}/)
    .map((p) => p.trim())
    .filter(
      (p) =>
        p.length > 0 &&
        !p.startsWith('http://') &&
        !p.startsWith('https://') &&
        !p.startsWith('{"') &&
        !p.startsWith('{')
    );
  return parts.length > 0
    ? parts
    : rawText.trim().startsWith('{')
    ? []
    : [rawText.trim()];
}

export function buildRadarChatPrompt(
  triggerTitle: string,
  content: string
): string {
  return `Olá Vito! Gostaria de conversar e avaliar os próximos passos com base nesta atualização do radar "${triggerTitle}":\n\n"${content}"\n\nPor favor, analise essas informações para mim e me recomende ações práticas.`;
}
