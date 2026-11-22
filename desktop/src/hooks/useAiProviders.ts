import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../services/api';
import {
  AiModelGroup,
  AiModelItem,
  AiPreferences,
  AiProviderInfo,
  AiProviderKey,
  AiReasoningEffort,
} from '../types';
import {
  AI_PROVIDERS_CATALOG,
  buildSelectableGroups,
  formatProvidersSummary,
  getResolvedModelDisplay,
  mergeProvidersWithCatalog,
  resolveModelRef,
} from '../components/ai/aiProvidersCatalog';
import { ConnectAiProviderInput, TestAiProviderResponse } from '../services/api/aiProvidersApi';

export function useAiProviders() {
  const [rawProviders, setRawProviders] = useState<AiProviderInfo[]>([]);
  const [remoteGroups, setRemoteGroups] = useState<AiModelGroup[]>([]);
  const [preferences, setPreferences] = useState<AiPreferences>({
    default_model: 'srv:auto',
    default_effort: 'auto',
  });
  const [loading, setLoading] = useState(false);

  const providers = useMemo(
    () => mergeProvidersWithCatalog(rawProviders),
    [rawProviders]
  );

  const modelGroups = useMemo(
    () => buildSelectableGroups(providers, remoteGroups),
    [providers, remoteGroups]
  );

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      const [provRes, modelsRes, prefsRes] = await Promise.allSettled([
        api.aiProvidersApi.listProviders(),
        api.aiProvidersApi.listSelectableModels(),
        api.aiProvidersApi.getPreferences(),
      ]);

      if (provRes.status === 'fulfilled' && Array.isArray(provRes.value)) {
        setRawProviders(provRes.value);
      }
      if (modelsRes.status === 'fulfilled' && Array.isArray(modelsRes.value)) {
        setRemoteGroups(modelsRes.value);
      }
      if (prefsRes.status === 'fulfilled' && prefsRes.value) {
        setPreferences({
          default_model: prefsRes.value.default_model || 'srv:auto',
          default_effort: prefsRes.value.default_effort || 'auto',
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const connectProvider = useCallback(
    async (providerKey: AiProviderKey, input: ConnectAiProviderInput): Promise<AiProviderInfo> => {
      const updated = await api.aiProvidersApi.connectProvider(providerKey, input);
      await refreshAll();
      return updated;
    },
    [refreshAll]
  );

  const testProvider = useCallback(
    async (providerKey: AiProviderKey): Promise<TestAiProviderResponse> => {
      const res = await api.aiProvidersApi.testProvider(providerKey);
      await refreshAll();
      return res;
    },
    [refreshAll]
  );

  const removeProvider = useCallback(
    async (providerKey: AiProviderKey): Promise<void> => {
      await api.aiProvidersApi.removeProvider(providerKey);
      await refreshAll();
    },
    [refreshAll]
  );

  const refreshProviderModels = useCallback(
    async (providerKey: AiProviderKey, refresh = true): Promise<AiModelItem[]> => {
      const models = await api.aiProvidersApi.getProviderModels(providerKey, refresh);
      await refreshAll();
      return models;
    },
    [refreshAll]
  );

  const updatePreferences = useCallback(
    async (next: Partial<AiPreferences>): Promise<AiPreferences> => {
      const merged: AiPreferences = {
        default_model: next.default_model ?? preferences.default_model,
        default_effort: next.default_effort ?? preferences.default_effort,
      };
      setPreferences(merged);
      try {
        const saved = await api.aiProvidersApi.updatePreferences(merged);
        if (saved) {
          setPreferences({
            default_model: saved.default_model || merged.default_model,
            default_effort: saved.default_effort || merged.default_effort,
          });
          return saved;
        }
      } catch (err) {
        await refreshAll();
        throw err;
      }
      return merged;
    },
    [preferences, refreshAll]
  );

  const updateThreadModel = useCallback(
    async (
      threadId: string,
      modelPref: string,
      effortPref: AiReasoningEffort | ''
    ): Promise<void> => {
      if (!threadId) return;
      await api.aiProvidersApi.updateThreadModel(threadId, {
        model_pref: modelPref,
        effort_pref: effortPref,
      });
    },
    []
  );

  const resolvedDefaultRef = useMemo(
    () => resolveModelRef([preferences.default_model], modelGroups),
    [preferences.default_model, modelGroups]
  );

  const resolvedDefaultDisplay = useMemo(
    () => getResolvedModelDisplay(resolvedDefaultRef, modelGroups),
    [resolvedDefaultRef, modelGroups]
  );

  const summaryText = useMemo(() => formatProvidersSummary(providers), [providers]);

  const activeProviderKeys = useMemo(
    () =>
      providers
        .filter((p) => p.fixed || p.status === 'ok')
        .map((p) => p.provider_key),
    [providers]
  );

  const getCatalogMeta = useCallback(
    (key: AiProviderKey) => AI_PROVIDERS_CATALOG[key],
    []
  );

  return {
    providers,
    modelGroups,
    preferences,
    loading,
    summaryText,
    activeProviderKeys,
    resolvedDefaultRef,
    resolvedDefaultDisplay,
    refreshAll,
    connectProvider,
    testProvider,
    removeProvider,
    refreshProviderModels,
    updatePreferences,
    updateThreadModel,
    getCatalogMeta,
  };
}
