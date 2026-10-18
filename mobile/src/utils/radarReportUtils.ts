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

export function extractReportParagraphs(
  message?: string,
  parsed?: ParsedReportData | null
): string[] {
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

  const rawText = parsed?.data || message || '';
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

export function detectPaymentAndMarketFeatures(
  message?: string,
  data?: string,
  paragraphs?: string[]
): { hasPix: boolean; hasInstallments: boolean; hasReal: boolean } {
  const combined = [message || '', data || '', (paragraphs || []).join(' ')].join(' ').toLowerCase();
  return {
    hasPix: /pix|à vista no pix/i.test(combined),
    hasInstallments: /parcela|10x|12x|sem juros|no cartão|em até/i.test(combined),
    hasReal: /r\$|reais/i.test(combined),
  };
}

export function buildRadarChatPrompt(
  triggerTitle: string,
  kind: 'chat' | 'task' | 'schedule',
  content: string
): string {
  if (kind === 'chat') {
    return `Olá Vito! Gostaria de conversar e avaliar os próximos passos com base nesta atualização do radar "${triggerTitle}":\n\n"${content}"\n\nPor favor, analise essas informações para mim e me recomende ações práticas:\n- Se for oportunidade financeira/compra no Brasil, avalie se vale a pena comprar à vista via Pix ou parcelado, ou se devemos monitorar nova queda.\n- Se envolver prazos, notícias urgentes, voos ou compromissos, verifique se devo criar uma tarefa ou agendar no calendário.\n- Me diga claramente qual é o melhor plano de ação imediato.`;
  }
  if (kind === 'task') {
    return `Vito, com base neste alerta do radar "${triggerTitle}":\n\n"${content}"\n\nPor favor, crie uma tarefa no meu planejador com os passos necessários.`;
  }
  return `Vito, com base neste relatório do radar "${triggerTitle}":\n\n"${content}"\n\nPor favor, verifique a melhor data/horário e prepare um agendamento no meu calendário.`;
}
