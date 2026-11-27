import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../../services/api';
import { dataSync } from '../../../services/dataSync';
import {
  AI_PROVIDER_CATALOG,
  findModelInGroups,
  resolveEffectiveModel,
  resolveSessionModelPref,
} from '../../../services/ai/aiProviderCatalog';
import type { ConversationSession } from '../../../types';
import type { ModelProviderGroup, ReasoningEffort } from '../../../types/aiProviders';

export { resolveSessionModelPref };

export function useChatModelSelection(
  activeSessionId: string,
  sessions: ConversationSession[] = []
) {
  const [modelGroups, setModelGroups] = useState<ModelProviderGroup[]>([]);
  const [defaultModel, setDefaultModel] = useState<string>('srv:auto');
  const [defaultEffort, setDefaultEffort] = useState<ReasoningEffort>('auto');
  const [threadModel, setThreadModel] = useState<string | null>(null);
  const [threadEffort, setThreadEffort] = useState<ReasoningEffort>('auto');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const loadModelsAndPrefs = useCallback(async () => {
    try {
      const [groups, prefs] = await Promise.all([
        api.aiProviders.listSelectableModels().catch(() => []),
        api.aiProviders.getPreferences().catch(() => ({
          default_model: 'srv:auto',
          default_effort: 'auto' as ReasoningEffort,
        })),
      ]);
      setModelGroups(groups);
      setDefaultModel(prefs.default_model || 'srv:auto');
      setDefaultEffort(prefs.default_effort || 'auto');
    } catch {
      // Mantém fallback srv:auto
    }
  }, []);

  useEffect(() => {
    loadModelsAndPrefs();
    return dataSync.subscribe('refresh_ai_providers', loadModelsAndPrefs);
  }, [loadModelsAndPrefs]);

  useEffect(() => {
    let cancelled = false;
    const currentSession = sessions.find((s) => s.id === activeSessionId);
    const localPref = resolveSessionModelPref(currentSession, defaultEffort);
    setThreadModel(localPref.model);
    setThreadEffort(localPref.effort);

    if (!activeSessionId || !currentSession || (currentSession.messages?.length || 0) === 0) {
      return () => {
        cancelled = true;
      };
    }

    api
      .getChatSessionWithMessages(activeSessionId)
      .then((detailed) => {
        if (cancelled || !detailed?.session) return;
        const remotePref = resolveSessionModelPref(detailed.session, defaultEffort);
        setThreadModel(remotePref.model);
        setThreadEffort(remotePref.effort);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeSessionId, defaultEffort]);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(''), 2600);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const effective = useMemo(
    () => resolveEffectiveModel(modelGroups, threadModel, defaultModel),
    [modelGroups, threadModel, defaultModel]
  );

  const pillDotColor =
    AI_PROVIDER_CATALOG[effective.group.provider_key]?.accentColor || '#17191B';

  const selectThreadModel = useCallback(
    async (modelValue: string | null) => {
      const prevModel = threadModel;
      setThreadModel(modelValue);
      if (!activeSessionId) {
        if (modelValue) {
          const found = findModelInGroups(modelGroups, modelValue);
          setToastMessage(`Próximas mensagens usam ${found?.model.name || modelValue}`);
        } else {
          setToastMessage('Voltou ao modelo padrão');
        }
        return;
      }
      try {
        await api.aiProviders.updateThreadModel(activeSessionId, {
          model_pref: modelValue || '',
          effort_pref: modelValue ? threadEffort : '',
        });
        if (modelValue) {
          const found = findModelInGroups(modelGroups, modelValue);
          setToastMessage(`Próximas mensagens usam ${found?.model.name || modelValue}`);
        } else {
          setToastMessage('Voltou ao modelo padrão');
        }
      } catch {
        setThreadModel(prevModel);
        setToastMessage('Não foi possível alterar o modelo da conversa');
      }
    },
    [activeSessionId, modelGroups, threadEffort, threadModel]
  );

  const selectThreadEffort = useCallback(
    async (effort: ReasoningEffort) => {
      const prevEffort = threadEffort;
      setThreadEffort(effort);
      if (!activeSessionId) return;
      try {
        await api.aiProviders.updateThreadModel(activeSessionId, {
          model_pref: threadModel || '',
          effort_pref: effort,
        });
      } catch {
        setThreadEffort(prevEffort);
        setToastMessage('Não foi possível salvar o nível de raciocínio');
      }
    },
    [activeSessionId, threadEffort, threadModel]
  );

  return {
    modelGroups,
    defaultModel,
    threadModel,
    threadEffort,
    pillLabel: effective.model.name,
    pillDotColor,
    pickerVisible,
    setPickerVisible,
    toastMessage,
    selectThreadModel,
    selectThreadEffort,
  };
}
