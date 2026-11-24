import {
  AiModelGroup,
  AiModelItem,
  AiProviderInfo,
  AiProviderKey,
  AiReasoningEffort,
} from '../../types';

export type AiProviderPricingTone = 'free' | 'freemium' | 'paid' | 'variable';

export interface AiProviderCatalogMeta {
  key: AiProviderKey;
  name: string;
  company: string;
  color: string;
  prefix: string;
  placeholder: string;
  requiresUrl: boolean;
  fixed: boolean;
  help: string;
  pricingLabel: string;
  pricingTone: AiProviderPricingTone;
  pricingDescription: string;
  keyUrl?: string;
  keyUrlLabel?: string;
  defaultModels: AiModelItem[];
}

export const AI_PROVIDER_ORDER: AiProviderKey[] = [
  'srv',
  'anthropic',
  'google',
  'openai',
  'groq',
  'openrouter',
  'custom',
];

export const AI_PROVIDERS_CATALOG: Record<AiProviderKey, AiProviderCatalogMeta> = {
  srv: {
    key: 'srv',
    name: 'Servidor do Vito',
    company: 'Cota do servidor',
    color: 'var(--ink)',
    prefix: '',
    placeholder: '',
    requiresUrl: false,
    fixed: true,
    help: 'O Vito Auto usa a cota do servidor e escolhe o modelo certo para cada tarefa. Não precisa de chave.',
    pricingLabel: 'Grátis (cota do Vito)',
    pricingTone: 'free',
    pricingDescription: 'Incluso no Vito com limite diário do servidor. Não precisa de chave nem cartão.',
    defaultModels: [
      {
        id: 'auto',
        name: 'Vito Auto',
        note: 'O Vito escolhe o modelo de cada tarefa',
        reasoning: false,
      },
    ],
  },
  anthropic: {
    key: 'anthropic',
    name: 'Claude',
    company: 'Anthropic',
    color: 'var(--orange)',
    prefix: 'sk-ant-',
    placeholder: 'sk-ant-...',
    requiresUrl: false,
    fixed: false,
    help: 'Crie a chave no console da Anthropic. O gasto fica na sua conta.',
    pricingLabel: 'Paga (pré-pago)',
    pricingTone: 'paid',
    pricingDescription: 'Exige compra de créditos pré-pagos na Anthropic (pay-as-you-go); não possui plano gratuito permanente para API.',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyUrlLabel: 'Abrir Console da Anthropic',
    defaultModels: [
      { id: 'haiku', name: 'Claude Haiku 5.5', note: 'Rápido e econômico', reasoning: false },
      { id: 'sonnet', name: 'Claude Sonnet 5.5', note: 'Equilibrado', reasoning: true },
      { id: 'opus', name: 'Claude Opus 5.5', note: 'O mais capaz', reasoning: true },
    ],
  },
  google: {
    key: 'google',
    name: 'Gemini',
    company: 'Google',
    color: 'var(--blue)',
    prefix: 'AIza',
    placeholder: 'AIza...',
    requiresUrl: false,
    fixed: false,
    help: 'Crie a chave no Google AI Studio. O gasto fica na sua conta.',
    pricingLabel: 'Tem plano grátis',
    pricingTone: 'freemium',
    pricingDescription: 'O Google AI Studio oferece nível gratuito com limite por minuto (ideal para uso pessoal) e plano pago conforme o consumo.',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyUrlLabel: 'Abrir Google AI Studio',
    defaultModels: [
      { id: 'g36f', name: 'Gemini 3.6 Flash', note: 'Rápido', reasoning: true },
      { id: 'g25f', name: 'Gemini 2.5 Flash', note: 'Econômico', reasoning: true },
    ],
  },
  openai: {
    key: 'openai',
    name: 'OpenAI',
    company: 'OpenAI',
    color: 'var(--acc)',
    prefix: 'sk-',
    placeholder: 'sk-...',
    requiresUrl: false,
    fixed: false,
    help: 'Crie a chave na plataforma da OpenAI. O gasto fica na sua conta.',
    pricingLabel: 'Paga (pré-pago)',
    pricingTone: 'paid',
    pricingDescription: 'Exige compra de créditos pré-pagos na OpenAI (pay-as-you-go); não possui plano gratuito permanente para API.',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyUrlLabel: 'Abrir Plataforma OpenAI',
    defaultModels: [
      { id: 'gpt55', name: 'GPT-5.5', note: 'Uso geral', reasoning: true },
      { id: 'g4om', name: 'GPT-4o mini', note: 'Econômico', reasoning: false },
    ],
  },
  groq: {
    key: 'groq',
    name: 'Groq',
    company: 'Groq',
    color: 'var(--red)',
    prefix: 'gsk_',
    placeholder: 'gsk_...',
    requiresUrl: false,
    fixed: false,
    help: 'Crie a chave no console da Groq. Respostas muito rápidas.',
    pricingLabel: 'Tem plano grátis',
    pricingTone: 'freemium',
    pricingDescription: 'A Groq oferece nível gratuito com limites por minuto para testar e usar modelos rápidos, além de plano pago para maior volume.',
    keyUrl: 'https://console.groq.com/keys',
    keyUrlLabel: 'Abrir Console da Groq',
    defaultModels: [
      { id: 'l70', name: 'Llama 3.3 70B', note: 'Muito rápido', reasoning: false },
      { id: 'oss', name: 'GPT-OSS 120B', note: 'Raciocínio rápido', reasoning: true },
    ],
  },
  openrouter: {
    key: 'openrouter',
    name: 'OpenRouter',
    company: 'OpenRouter',
    color: 'var(--purple)',
    prefix: 'sk-or-',
    placeholder: 'sk-or-...',
    requiresUrl: false,
    fixed: false,
    help: 'Uma chave para vários provedores. Escolha qualquer modelo do catálogo.',
    pricingLabel: 'Grátis e pago',
    pricingTone: 'freemium',
    pricingDescription: 'Possui vários modelos gratuitos (marcados como :free) com limite diário, e modelos pagos por uso via créditos pré-pagos.',
    keyUrl: 'https://openrouter.ai/keys',
    keyUrlLabel: 'Abrir OpenRouter Keys',
    defaultModels: [
      { id: 'sonnet', name: 'anthropic/claude-sonnet-5-5', note: 'Via OpenRouter', reasoning: true },
      { id: 'gem', name: 'google/gemini-2.5-flash', note: 'Via OpenRouter', reasoning: true },
      { id: 'llama', name: 'meta-llama/llama-3.3-70b-instruct', note: 'Via OpenRouter', reasoning: false },
    ],
  },
  custom: {
    key: 'custom',
    name: 'Endpoint compatível',
    company: 'API no formato OpenAI',
    color: 'var(--teal)',
    prefix: '',
    placeholder: 'Chave do endpoint',
    requiresUrl: true,
    fixed: false,
    help: 'Qualquer endpoint no formato da API da OpenAI: gateways, proxies ou um modelo no seu próprio hardware.',
    pricingLabel: 'Depende do endpoint',
    pricingTone: 'variable',
    pricingDescription: 'Grátis se rodar localmente (ex.: Ollama ou LM Studio) ou cobrado conforme o serviço/gateway escolhido.',
    defaultModels: [
      { id: 'm', name: 'Modelo do endpoint', note: 'Nome como o endpoint publica', reasoning: false },
    ],
  },
};

export const EFFORT_OPTIONS: { value: AiReasoningEffort; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'low', label: 'Baixo' },
  { value: 'med', label: 'Médio' },
  { value: 'high', label: 'Alto' },
];

export type ProviderFilterCategory = 'Todas' | 'Conectados' | 'Disponíveis';

export const PROVIDER_FILTER_CHIPS: ProviderFilterCategory[] = [
  'Todas',
  'Conectados',
  'Disponíveis',
];

/**
 * Valida chave e URL antes do envio ao servidor conforme §2 do Plano 03.
 */
export function validateProviderCredentials(
  providerKey: AiProviderKey,
  apiKey: string,
  baseUrl?: string
): string | null {
  const meta = AI_PROVIDERS_CATALOG[providerKey];
  if (!meta) return 'Provedor inválido.';

  const trimmedKey = apiKey.trim().replace(/^["']+|["']+$/g, '');
  const trimmedUrl = (baseUrl ?? '').trim();

  if (meta.requiresUrl) {
    if (!trimmedKey || !trimmedUrl) {
      return 'Preencha o endereço e a chave.';
    }
    if (!/^https?:\/\//.test(trimmedUrl)) {
      return 'O endereço precisa começar com http:// ou https://.';
    }
    return null;
  }

  if (!trimmedKey) {
    return 'Preencha a chave.';
  }

  if (providerKey === 'openai' && /^sk-(ant|or)-/.test(trimmedKey)) {
    return 'Esta chave parece ser de outro provedor.';
  }

  if (providerKey === 'google') {
    if (!trimmedKey.startsWith('AIza') && !trimmedKey.startsWith('AQ.')) {
      return `Esta chave não parece ser do ${meta.name}. Ela deve começar com ${meta.prefix}.`;
    }
    return null;
  }

  if (meta.prefix && !trimmedKey.startsWith(meta.prefix)) {
    return `Esta chave não parece ser do ${meta.name}. Ela deve começar com ${meta.prefix}.`;
  }

  return null;
}

export function mergeProvidersWithCatalog(apiProviders: AiProviderInfo[]): AiProviderInfo[] {
  const byKey = new Map<AiProviderKey, AiProviderInfo>();
  for (const item of apiProviders) {
    if (item?.provider_key) {
      byKey.set(item.provider_key, item);
    }
  }

  return AI_PROVIDER_ORDER.map((key) => {
    const meta = AI_PROVIDERS_CATALOG[key];
    const remote = byKey.get(key);
    if (meta.fixed) {
      return {
        provider_key: 'srv',
        name: remote?.name || meta.name,
        company: remote?.company || meta.company,
        status: 'ok',
        fixed: true,
        connected: true,
        model_count: remote?.models?.length || meta.defaultModels.length,
        models: remote?.models?.length ? remote.models : meta.defaultModels,
      };
    }

    const status = remote?.status || (remote?.connected ? 'ok' : 'disconnected');
    const isConnected = status === 'ok' || status === 'invalid' || Boolean(remote?.connected);
    const models = remote?.models && remote.models.length > 0 ? remote.models : meta.defaultModels;

    return {
      provider_key: key,
      name: remote?.name || meta.name,
      company: remote?.company || meta.company,
      status,
      fixed: false,
      connected: isConnected,
      key_last4: remote?.key_last4,
      base_url: remote?.base_url,
      model_count: remote?.model_count ?? (isConnected ? models.length : 0),
      verified_at: remote?.verified_at,
      models,
    };
  });
}

export function splitModelRef(ref: string): [AiProviderKey, string] {
  const idx = ref.indexOf(':');
  if (idx === -1) return ['srv', 'auto'];
  return [ref.slice(0, idx) as AiProviderKey, ref.slice(idx + 1)];
}

export function isProviderActive(provider: AiProviderInfo): boolean {
  return Boolean(provider.fixed || provider.status === 'ok' || provider.status === 'invalid');
}

export function getOwnOkProviderCount(providers: AiProviderInfo[]): number {
  return providers.filter((p) => !p.fixed && p.status === 'ok').length;
}

export function formatProvidersSummary(providers: AiProviderInfo[]): string {
  const ownOk = getOwnOkProviderCount(providers);
  if (ownOk === 0) return 'Só o servidor';
  return ownOk === 1 ? 'Servidor + 1 próprio' : `Servidor + ${ownOk} próprios`;
}

export function formatKeyMask(last4?: string): string {
  return last4 ? `••••${last4}` : '••••';
}

export function buildSelectableGroups(
  providers: AiProviderInfo[],
  remoteGroups?: AiModelGroup[]
): AiModelGroup[] {
  if (remoteGroups && remoteGroups.length > 0) {
    const filtered = remoteGroups.filter(
      (g) => g.provider_key === 'srv' || !g.status || g.status === 'ok'
    );
    const hasSrv = filtered.some((g) => g.provider_key === 'srv');
    if (hasSrv) return filtered;
    const srvMeta = AI_PROVIDERS_CATALOG.srv;
    return [
      {
        provider_key: 'srv',
        provider_name: srvMeta.name,
        status: 'ok',
        models: srvMeta.defaultModels,
      },
      ...filtered,
    ];
  }

  return providers
    .filter((p) => p.fixed || p.status === 'ok')
    .map((p) => ({
      provider_key: p.provider_key,
      provider_name: p.name,
      status: 'ok' as const,
      models: p.models && p.models.length > 0 ? p.models : AI_PROVIDERS_CATALOG[p.provider_key].defaultModels,
    }));
}

export function isModelSelectable(ref: string | null | undefined, groups: AiModelGroup[]): boolean {
  if (!ref) return false;
  const [providerKey, modelId] = splitModelRef(ref);
  const group = groups.find(
    (g) => g.provider_key === providerKey && (!g.status || g.status === 'ok')
  );
  if (!group) return false;
  return group.models.some((m) => m.id === modelId);
}

export function resolveModelRef(
  candidates: (string | null | undefined)[],
  groups: AiModelGroup[]
): string {
  for (const candidate of candidates) {
    if (isModelSelectable(candidate, groups)) {
      return candidate as string;
    }
  }
  return 'srv:auto';
}

export function getResolvedModelDisplay(
  ref: string,
  groups: AiModelGroup[]
): { providerKey: AiProviderKey; providerName: string; color: string; model: AiModelItem } {
  const [providerKey, modelId] = splitModelRef(ref);
  const meta = AI_PROVIDERS_CATALOG[providerKey] || AI_PROVIDERS_CATALOG.srv;
  const group = groups.find((g) => g.provider_key === providerKey);
  const foundModel =
    group?.models.find((m) => m.id === modelId) ||
    meta.defaultModels.find((m) => m.id === modelId) ||
    AI_PROVIDERS_CATALOG.srv.defaultModels[0];

  return {
    providerKey: meta.key,
    providerName: group?.provider_name || meta.name,
    color: meta.color,
    model: foundModel,
  };
}
