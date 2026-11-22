import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { dataSync } from '../services/dataSync';
import {
  mergeProvidersWithCatalog,
  resolveEffectiveModel,
} from '../services/ai/aiProviderCatalog';
import type {
  ModelProviderGroup,
  ReasoningEffort,
  UserAIProvider,
} from '../types/aiProviders';

export function useProfileAiModel() {
  const [providers, setProviders] = useState<UserAIProvider[]>(() => mergeProvidersWithCatalog([]));
  const [modelGroups, setModelGroups] = useState<ModelProviderGroup[]>([]);
  const [defaultModel, setDefaultModel] = useState<string>('srv:auto');
  const [defaultEffort, setDefaultEffort] = useState<ReasoningEffort>('auto');
  const [pickerVisible, setPickerVisible] = useState(false);

  const refreshAiState = useCallback(async () => {
    try {
      const [provList, groups, prefs] = await Promise.all([
        api.aiProviders.listProviders().catch(() => []),
        api.aiProviders.listSelectableModels().catch(() => []),
        api.aiProviders.getPreferences().catch(() => ({
          default_model: 'srv:auto',
          default_effort: 'auto' as ReasoningEffort,
        })),
      ]);
      setProviders(mergeProvidersWithCatalog(provList));
      setModelGroups(groups);
      setDefaultModel(prefs.default_model || 'srv:auto');
      setDefaultEffort(prefs.default_effort || 'auto');
    } catch {
      // Mantém fallback srv:auto
    }
  }, []);

  useEffect(() => {
    refreshAiState();
    return dataSync.subscribe('refresh_ai_providers', refreshAiState);
  }, [refreshAiState]);

  const resolvedDefault = useMemo(
    () => resolveEffectiveModel(modelGroups, defaultModel),
    [modelGroups, defaultModel]
  );

  const selectDefaultModel = useCallback(
    async (modelValue: string | null) => {
      const next = modelValue || 'srv:auto';
      setDefaultModel(next);
      try {
        await api.aiProviders.updatePreferences({
          default_model: next,
          default_effort: defaultEffort,
        });
        dataSync.notify('refresh_ai_providers');
      } catch {
        // Silencioso
      }
    },
    [defaultEffort]
  );

  const selectDefaultEffort = useCallback(
    async (effort: ReasoningEffort) => {
      setDefaultEffort(effort);
      try {
        await api.aiProviders.updatePreferences({
          default_model: defaultModel,
          default_effort: effort,
        });
        dataSync.notify('refresh_ai_providers');
      } catch {
        // Silencioso
      }
    },
    [defaultModel]
  );

  return {
    providers,
    modelGroups,
    defaultModel,
    defaultEffort,
    defaultModelName: resolvedDefault.model.name,
    pickerVisible,
    setPickerVisible,
    refreshAiState,
    selectDefaultModel,
    selectDefaultEffort,
  };
}
