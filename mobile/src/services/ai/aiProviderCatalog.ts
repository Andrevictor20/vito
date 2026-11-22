import type {
  AIProviderCatalogEntry,
  AIProviderKey,
  ModelProviderGroup,
  ProviderModelInfo,
  ReasoningEffort,
  UserAIProvider,
} from '../../types/aiProviders';

export const AI_PROVIDER_ORDER: AIProviderKey[] = [
  'srv',
  'anthropic',
  'google',
  'openai',
  'groq',
  'openrouter',
  'custom',
];

export const EFFORT_OPTIONS: Array<{ value: ReasoningEffort; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'low', label: 'Baixo' },
  { value: 'med', label: 'Médio' },
  { value: 'high', label: 'Alto' },
];

export const AI_PROVIDER_CATALOG: Record<AIProviderKey, AIProviderCatalogEntry> = {
  srv: {
    key: 'srv',
    name: 'Servidor do Vito',
    company: 'Cota do servidor',
    accentColor: '#17191B',
    fixed: true,
    keyPrefix: '',
    placeholder: '',
    helpText: 'O Vito Auto usa a cota do servidor e escolhe o modelo certo para cada tarefa. Não precisa de chave.',
    defaultModels: [
      {
        id: 'auto',
        name: 'Vito Auto',
        note: 'O Vito escolhe o modelo de cada tarefa',
        supports_tools: true,
        supports_vision: true,
        reasoning: false,
        quality_tier: 3,
        max_context: 128000,
      },
    ],
  },
  anthropic: {
    key: 'anthropic',
    name: 'Claude',
    company: 'Anthropic',
    accentColor: '#D97757',
    keyPrefix: 'sk-ant-',
    placeholder: 'sk-ant-...',
    helpText: 'Crie a chave no console da Anthropic. O gasto fica na sua conta.',
    defaultModels: [
      { id: 'claude-3-5-haiku-latest', name: 'Claude Haiku 5.5', note: 'Rápido e econômico', supports_tools: true, supports_vision: true, reasoning: false, quality_tier: 2, max_context: 200000 },
      { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 5.5', note: 'Equilibrado', supports_tools: true, supports_vision: true, reasoning: true, quality_tier: 3, max_context: 200000 },
      { id: 'claude-opus-4-1', name: 'Claude Opus 5.5', note: 'O mais capaz', supports_tools: true, supports_vision: true, reasoning: true, quality_tier: 3, max_context: 200000 },
    ],
  },
  google: {
    key: 'google',
    name: 'Gemini',
    company: 'Google',
    accentColor: '#2B7FD4',
    keyPrefix: 'AIza',
    placeholder: 'AIza...',
    helpText: 'Crie a chave no Google AI Studio. O gasto fica na sua conta.',
    defaultModels: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', note: 'Rápido', supports_tools: true, supports_vision: true, reasoning: true, quality_tier: 3, max_context: 1048576 },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', note: 'Raciocínio avançado', supports_tools: true, supports_vision: true, reasoning: true, quality_tier: 3, max_context: 1048576 },
    ],
  },
  openai: {
    key: 'openai',
    name: 'OpenAI',
    company: 'OpenAI',
    accentColor: '#10A37F',
    keyPrefix: 'sk-',
    placeholder: 'sk-...',
    helpText: 'Crie a chave na plataforma da OpenAI. O gasto fica na sua conta.',
    defaultModels: [
      { id: 'gpt-4.1', name: 'GPT-5.5', note: 'Uso geral', supports_tools: true, supports_vision: true, reasoning: true, quality_tier: 3, max_context: 128000 },
      { id: 'gpt-4o-mini', name: 'GPT-4o mini', note: 'Econômico', supports_tools: true, supports_vision: true, reasoning: false, quality_tier: 2, max_context: 128000 },
    ],
  },
  groq: {
    key: 'groq',
    name: 'Groq',
    company: 'Groq',
    accentColor: '#F55036',
    keyPrefix: 'gsk_',
    placeholder: 'gsk_...',
    helpText: 'Crie a chave no console da Groq. Respostas muito rápidas.',
    defaultModels: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', note: 'Muito rápido', supports_tools: true, supports_vision: false, reasoning: false, quality_tier: 2, max_context: 128000 },
      { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', note: 'Raciocínio rápido', supports_tools: true, supports_vision: false, reasoning: true, quality_tier: 3, max_context: 128000 },
    ],
  },
  openrouter: {
    key: 'openrouter',
    name: 'OpenRouter',
    company: 'OpenRouter',
    accentColor: '#6366F1',
    keyPrefix: 'sk-or-',
    placeholder: 'sk-or-...',
    helpText: 'Uma chave para vários provedores. Escolha qualquer modelo do catálogo.',
    defaultModels: [
      { id: 'anthropic/claude-sonnet-4-5', name: 'anthropic/claude-sonnet-5-5', note: 'Via OpenRouter', supports_tools: true, supports_vision: true, reasoning: true, quality_tier: 3, max_context: 200000 },
      { id: 'google/gemini-2.5-flash', name: 'google/gemini-2.5-flash', note: 'Via OpenRouter', supports_tools: true, supports_vision: true, reasoning: true, quality_tier: 3, max_context: 1048576 },
    ],
  },
  custom: {
    key: 'custom',
    name: 'Endpoint compatível',
    company: 'API no formato OpenAI',
    accentColor: '#0D9488',
    requiresUrl: true,
    keyPrefix: '',
    placeholder: 'Chave do endpoint',
    helpText: 'Qualquer endpoint no formato da API da OpenAI: gateways, proxies ou um modelo no seu próprio hardware.',
    defaultModels: [
      { id: 'default', name: 'Modelo do endpoint', note: 'Nome como o endpoint publica', supports_tools: true, supports_vision: false, reasoning: false, quality_tier: 2, max_context: 32768 },
    ],
  },
};

export function splitModelValue(value?: string | null): [AIProviderKey | null, string] {
  if (!value || !value.includes(':')) return [null, ''];
  const idx = value.indexOf(':');
  const key = value.slice(0, idx) as AIProviderKey;
  const modelId = value.slice(idx + 1);
  return [key in AI_PROVIDER_CATALOG ? key : null, modelId];
}

export function buildServerFallbackGroup(): ModelProviderGroup {
  return {
    provider_key: 'srv',
    name: AI_PROVIDER_CATALOG.srv.name,
    status: 'ok',
    models: AI_PROVIDER_CATALOG.srv.defaultModels,
  };
}

export function filterConnectedGroups(groups: ModelProviderGroup[]): ModelProviderGroup[] {
  const okGroups = (groups || []).filter((g) => g.status === 'ok' && Array.isArray(g.models) && g.models.length > 0);
  if (!okGroups.some((g) => g.provider_key === 'srv')) {
    return [buildServerFallbackGroup(), ...okGroups];
  }
  return okGroups;
}

export function findModelInGroups(
  groups: ModelProviderGroup[],
  modelValue?: string | null
): { group: ModelProviderGroup; model: ProviderModelInfo } | null {
  const [pKey, mId] = splitModelValue(modelValue);
  if (!pKey || !mId) return null;
  const okGroups = filterConnectedGroups(groups);
  const group = okGroups.find((g) => g.provider_key === pKey);
  if (!group) return null;
  const model = group.models.find((m) => m.id === mId);
  if (!model) return null;
  return { group, model };
}

export function resolveEffectiveModel(
  groups: ModelProviderGroup[],
  ...candidates: Array<string | null | undefined>
): { value: string; group: ModelProviderGroup; model: ProviderModelInfo } {
  for (const candidate of candidates) {
    const found = findModelInGroups(groups, candidate);
    if (found && candidate) {
      return { value: candidate, ...found };
    }
  }
  const srvGroup = buildServerFallbackGroup();
  return {
    value: 'srv:auto',
    group: srvGroup,
    model: srvGroup.models[0],
  };
}

export function mergeProvidersWithCatalog(raw: UserAIProvider[]): UserAIProvider[] {
  const byKey = new Map<AIProviderKey, UserAIProvider>();
  for (const item of raw || []) {
    if (item?.provider_key) byKey.set(item.provider_key, item);
  }
  return AI_PROVIDER_ORDER.map((key) => {
    const entry = AI_PROVIDER_CATALOG[key];
    const remote = byKey.get(key);
    if (key === 'srv') {
      return {
        provider_key: 'srv',
        name: entry.name,
        company: entry.company,
        status: 'ok',
        fixed: true,
        models: remote?.models?.length ? remote.models : entry.defaultModels,
        model_count: remote?.model_count ?? entry.defaultModels.length,
      };
    }
    return {
      provider_key: key,
      name: remote?.name || entry.name,
      company: remote?.company || entry.company,
      base_url: remote?.base_url || '',
      key_last4: remote?.key_last4 || '',
      status: remote?.status || 'disconnected',
      verified_at: remote?.verified_at,
      models: remote?.models || [],
      model_count: remote?.model_count ?? (remote?.models?.length || 0),
    };
  });
}

export function summarizeOwnProviders(providers: UserAIProvider[]): string {
  const ownCount = (providers || []).filter(
    (p) => p.provider_key !== 'srv' && p.status === 'ok'
  ).length;
  if (ownCount === 0) return 'Só o servidor';
  return `Servidor + ${ownCount} ${ownCount === 1 ? 'próprio' : 'próprios'}`;
}

export function formatModelDisplayName(
  rawModelUsed?: string,
  groups: ModelProviderGroup[] = []
): string {
  if (!rawModelUsed) return '';
  const found = findModelInGroups(groups, rawModelUsed);
  if (found) return found.model.name;
  for (const g of groups) {
    const byId = g.models.find((m) => m.id === rawModelUsed);
    if (byId) return byId.name;
  }
  return rawModelUsed.includes(':') ? splitModelValue(rawModelUsed)[1] || rawModelUsed : rawModelUsed;
}

export function getProviderSheetMode(
  provider: UserAIProvider | null
): 'srv' | 'connected' | 'unconnected' {
  if (!provider || provider.provider_key === 'srv' || provider.fixed) return 'srv';
  if (provider.status === 'ok' || provider.status === 'invalid') return 'connected';
  return 'unconnected';
}

export function getPickerViewModel(params: {
  groups: ModelProviderGroup[];
  selectedModel: string | null | undefined;
  inheritedModel?: string | null;
  allowInherit: boolean;
}) {
  const connectedGroups = filterConnectedGroups(params.groups);
  const inheritedResolved = resolveEffectiveModel(connectedGroups, params.inheritedModel);
  const effective = resolveEffectiveModel(
    connectedGroups,
    params.selectedModel,
    params.allowInherit ? params.inheritedModel : undefined
  );
  const hasExplicitValidSelection = Boolean(
    params.selectedModel && findModelInGroups(connectedGroups, params.selectedModel)
  );
  return {
    connectedGroups,
    inheritedResolved,
    effective,
    hasExplicitValidSelection,
    showReasoningSelector: Boolean(effective.model.reasoning),
  };
}

export function resolveSessionModelPref(
  session: { model_pref?: string; effort_pref?: string } | undefined,
  defaultEffort: ReasoningEffort
): { model: string | null; effort: ReasoningEffort } {
  const model = session?.model_pref?.trim() ? session.model_pref.trim() : null;
  const effort = (session?.effort_pref?.trim() as ReasoningEffort) || defaultEffort;
  return { model, effort };
}
