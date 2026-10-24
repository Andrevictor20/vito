export interface TriggerSourceItem {
  title?: string;
  name: string;
  url: string;
  domain?: string;
}

export interface ParsedReportData {
  status?: string;
  condition_met?: boolean;
  data?: string;
  paragraphs?: string[];
  bullets?: string[];
  metric_label?: string;
  metric_value?: string;
  sources?: TriggerSourceItem[];
  urgency?: string;
  is_breaking?: boolean;
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

export function extractRadarBullets(
  message?: string,
  parsed?: ParsedReportData | null
): string[] {
  if (parsed?.bullets && Array.isArray(parsed.bullets) && parsed.bullets.length > 0) {
    const cleaned = parsed.bullets
      .map((b) => String(b).replace(/^[•\-\*]\s*/, '').trim())
      .filter((b) => b.length > 0 && !b.startsWith('{') && !b.startsWith('{"'));
    if (cleaned.length > 0) {
      return cleaned.slice(0, 4);
    }
  }

  const paras = extractReportParagraphs(message, parsed);
  if (paras.length === 0) return [];

  const bullets: string[] = [];
  for (const p of paras) {
    const lines = p.split(/\n+/).map((l) => l.replace(/^[•\-\*]\s*/, '').trim());
    for (const line of lines) {
      if (line.length > 0 && !line.startsWith('http://') && !line.startsWith('https://')) {
        // Se a linha for muito longa, corta respeitando palavras
        if (line.length > 150) {
          bullets.push(line.slice(0, 147) + '…');
        } else {
          bullets.push(line);
        }
      }
    }
  }

  return bullets.slice(0, 4);
}

export function extractDomain(urlStr: string): string {
  try {
    const match = urlStr.match(/^https?:\/\/([^/?#]+)(?:[/?#]|$)/i);
    if (match && match[1]) {
      return match[1].toLowerCase().replace(/^www\./, '');
    }
  } catch {
    // fallback
  }
  return '';
}

export function getFaviconUrl(domainOrUrl: string): string {
  const domain = domainOrUrl.includes('/') ? extractDomain(domainOrUrl) : domainOrUrl;
  if (!domain) return '';
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

export function cleanSourceName(name?: string, domain?: string): string {
  if (name && name.trim().length > 0) {
    return name.trim();
  }
  if (!domain) return 'Fonte';
  if (domain.includes('globo.com')) return 'ge.globo';
  if (domain.includes('uol.com.br')) return 'UOL';
  if (domain.includes('mercadolivre.com')) return 'Mercado Livre';
  if (domain.includes('amazon.com')) return 'Amazon';
  if (domain.includes('g1.globo')) return 'G1';
  if (domain.includes('cnnbrasil')) return 'CNN Brasil';
  if (domain.includes('valor.globo')) return 'Valor Econômico';
  return domain;
}

export function extractRadarSources(
  message?: string,
  parsed?: ParsedReportData | null
): TriggerSourceItem[] {
  const out: TriggerSourceItem[] = [];
  const seenUrls = new Set<string>();

  // 1. Fontes estruturadas vindas do backend
  if (parsed?.sources && Array.isArray(parsed.sources)) {
    for (const s of parsed.sources) {
      if (s && s.url && !seenUrls.has(s.url)) {
        seenUrls.add(s.url);
        const domain = s.domain || extractDomain(s.url);
        out.push({
          title: s.title || '',
          name: cleanSourceName(s.name, domain),
          url: s.url,
          domain,
        });
      }
    }
  }

  // 2. Fallback: extrai URLs no texto se não houver fontes estruturadas
  if (out.length === 0) {
    const raw = `${message || ''} ${parsed?.data || ''}`;
    const urlMatches = raw.match(/https?:\/\/[^\s)"]+/g);
    if (urlMatches) {
      for (const rawUrl of urlMatches) {
        const cleanUrl = rawUrl.replace(/[.,;!?]+$/, '');
        if (!seenUrls.has(cleanUrl)) {
          seenUrls.add(cleanUrl);
          const domain = extractDomain(cleanUrl);
          out.push({
            name: cleanSourceName('', domain),
            url: cleanUrl,
            domain,
          });
        }
      }
    }
  }

  return out.slice(0, 4);
}

export function isRadarUrgentOrBreaking(
  urgency?: string,
  isBreaking?: boolean,
  message?: string
): boolean {
  if (isBreaking) return true;
  if (message && /🚨|urgente|breaking|alerta crítico|queda histórica/i.test(message)) {
    return true;
  }
  if (!urgency) return false;
  const u = urgency.toLowerCase().trim();
  return u === 'breaking' || u === 'high' || u === 'urgent';
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
