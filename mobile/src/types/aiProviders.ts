export type AIProviderKey =
  | 'srv'
  | 'anthropic'
  | 'google'
  | 'openai'
  | 'groq'
  | 'openrouter'
  | 'custom';

export type AIProviderStatus = 'ok' | 'invalid' | 'disconnected';

export type ReasoningEffort = 'auto' | 'low' | 'med' | 'high';

export interface ProviderModelInfo {
  id: string;
  name: string;
  note?: string;
  supports_tools: boolean;
  supports_vision: boolean;
  reasoning: boolean;
  quality_tier: number;
  max_context: number;
}

export interface UserAIProvider {
  provider_key: AIProviderKey;
  name?: string;
  company?: string;
  base_url?: string;
  key_last4?: string;
  status: AIProviderStatus;
  verified_at?: string;
  model_count?: number;
  models?: ProviderModelInfo[];
  fixed?: boolean;
}

export interface ModelProviderGroup {
  provider_key: AIProviderKey;
  name: string;
  status: AIProviderStatus;
  models: ProviderModelInfo[];
}

export interface AIPreferences {
  default_model: string;
  default_effort: ReasoningEffort;
}

export interface ConnectProviderPayload {
  api_key: string;
  base_url?: string;
}

export interface TestProviderResponse {
  status: AIProviderStatus;
  valid?: boolean;
  message?: string;
  error?: string;
  verified_at?: string;
}

export interface UpdateModelPrefPayload {
  model_pref: string;
  effort_pref: ReasoningEffort | '';
}

export type AIProviderPricingTone = 'free' | 'freemium' | 'paid' | 'variable';

export interface AIProviderCatalogEntry {
  key: AIProviderKey;
  name: string;
  company: string;
  accentColor: string;
  fixed?: boolean;
  requiresUrl?: boolean;
  keyPrefix: string;
  placeholder: string;
  helpText: string;
  pricingLabel: string;
  pricingTone: AIProviderPricingTone;
  pricingDescription: string;
  keyUrl?: string;
  keyUrlLabel?: string;
  defaultModels: ProviderModelInfo[];
}
