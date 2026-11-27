import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../../services/api';
import { dataSync } from '../../../services/dataSync';
import {
  DEFAULT_APPS_CATALOG,
  DEFAULT_BOT_TEMPLATES,
  DEFAULT_SKILL_PACKAGES,
} from '../data/botsCatalogFallback';
import {
  ActionPolicy,
  Bot,
  BotAppInfo,
  BotTemplate,
  CreateBotPayload,
  PendingResolutionDecision,
  SkillPackage,
  UpdateBotPayload,
} from '../types/bots';
import { isAlwaysAskAction } from '../utils/botsHelpers';
import { normalizeBot } from '../utils/botsNormalizers';

const BOTS_CACHE_PREFIX = '@vito_bots_cache_v1';

interface CachedBotsBundle {
  bots: Bot[];
  savedAt: string;
}

export const useBots = (userId?: string) => {
  const [bots, setBots] = useState<Bot[]>([]);
  const [templates, setTemplates] = useState<BotTemplate[]>(DEFAULT_BOT_TEMPLATES);
  const [skills, setSkills] = useState<SkillPackage[]>(DEFAULT_SKILL_PACKAGES);
  const [apps, setApps] = useState<BotAppInfo[]>(DEFAULT_APPS_CATALOG);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineCache, setIsOfflineCache] = useState(false);

  const cacheKey = `${BOTS_CACHE_PREFIX}_${userId || 'anon'}`;

  const saveCache = useCallback(
    async (nextBots: Bot[]) => {
      try {
        const bundle: CachedBotsBundle = {
          bots: nextBots,
          savedAt: new Date().toISOString(),
        };
        await AsyncStorage.setItem(cacheKey, JSON.stringify(bundle));
      } catch {
        // Cache persist failure is non-fatal
      }
    },
    [cacheKey]
  );

  const loadCache = useCallback(async (): Promise<boolean> => {
    try {
      const raw = await AsyncStorage.getItem(cacheKey);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as CachedBotsBundle;
      if (Array.isArray(parsed.bots)) {
        setBots(parsed.bots.map(normalizeBot));
        return true;
      }
    } catch {
      // Ignore corrupt cache
    }
    return false;
  }, [cacheKey]);

  const fetchAll = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      }
      setError(null);
      try {
        const [botsRes, tplRes, skillRes, appsRes] = await Promise.all([
          api.listBots(),
          api.getBotCatalogTemplates(),
          api.getBotCatalogSkills(),
          api.getBotApps(),
        ]);
        setBots(botsRes);
        setTemplates(tplRes);
        setSkills(skillRes);
        setApps(appsRes);
        setIsOfflineCache(false);
        await saveCache(botsRes);
      } catch (err) {
        const hasCache = await loadCache();
        if (hasCache) {
          setIsOfflineCache(true);
          setError(null);
        } else {
          setError(
            err instanceof Error
              ? err.message
              : 'Não foi possível carregar seus bots agora.'
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadCache, saveCache]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      await loadCache();
      if (mounted) {
        await fetchAll(false);
      }
    })();

    const unsub1 = dataSync.subscribe('refresh_bots', () => fetchAll(true));
    const unsub2 = dataSync.subscribe('refresh_triggers', () => fetchAll(true));
    const unsub3 = dataSync.subscribe('refresh_all', () => fetchAll(true));
    return () => {
      mounted = false;
      unsub1();
      unsub2();
      unsub3();
    };
  }, [fetchAll, loadCache]);

  const onRefresh = useCallback(() => {
    fetchAll(true);
  }, [fetchAll]);

  const createBot = useCallback(
    async (payload: CreateBotPayload): Promise<Bot> => {
      const created = await api.createBot(payload);
      setBots((prev) => [created, ...prev]);
      return created;
    },
    []
  );

  const updateBot = useCallback(async (id: string, payload: UpdateBotPayload): Promise<Bot> => {
    const updated = await api.updateBot(id, payload);
    setBots((prev) => prev.map((b) => (b.id === id ? updated : b)));
    return updated;
  }, []);

  const toggleBot = useCallback(
    async (bot: Bot): Promise<Bot> => {
      const nextStatus = bot.status === 'active' ? 'paused' : 'active';
      setBots((prev) => prev.map((b) => (b.id === bot.id ? { ...b, status: nextStatus } : b)));
      try {
        const updated = await api.updateBot(bot.id, { status: nextStatus });
        setBots((prev) => prev.map((b) => (b.id === bot.id ? updated : b)));
        return updated;
      } catch (err) {
        setBots((prev) => prev.map((b) => (b.id === bot.id ? bot : b)));
        throw err;
      }
    },
    []
  );

  const deleteBot = useCallback(async (id: string): Promise<void> => {
    setBots((prev) => prev.filter((b) => b.id !== id));
    await api.deleteBot(id);
  }, []);

  const loadBotDetails = useCallback(async (id: string): Promise<Bot | null> => {
    try {
      const detailed = await api.getBot(id);
      setBots((prev) => prev.map((b) => (b.id === id ? detailed : b)));
      return detailed;
    } catch {
      return null;
    }
  }, []);

  const runBot = useCallback(
    async (id: string) => {
      const report = await api.runBot(id);
      await loadBotDetails(id);
      await fetchAll(false);
      return report;
    },
    [fetchAll, loadBotDetails]
  );

  const resolvePending = useCallback(
    async (
      botId: string,
      confirmationId: string,
      decision: PendingResolutionDecision,
      alwaysAsk?: boolean
    ) => {
      if (alwaysAsk && decision === 'always_allow') {
        throw new Error('Ação protegida não permite "Sempre permitir".');
      }
      await api.resolveBotPending(botId, confirmationId, decision, alwaysAsk);
      setBots((prev) =>
        prev.map((b) =>
          b.id === botId
            ? {
                ...b,
                pending: (b.pending ?? []).filter((p) => p.confirmation_id !== confirmationId),
              }
            : b
        )
      );
      fetchAll(false);
    },
    [fetchAll]
  );

  const updateActionPolicy = useCallback(
    async (botId: string, actionKey: string, policy: ActionPolicy, alwaysAsk?: boolean) => {
      if (isAlwaysAskAction(actionKey, alwaysAsk) && policy === 'auto') {
        throw new Error('Esta ação sempre exige aprovação antes de executar.');
      }
      const updated = await api.updateBotAction(botId, actionKey, policy, alwaysAsk);
      setBots((prev) => prev.map((b) => (b.id === botId ? updated : b)));
      return updated;
    },
    []
  );

  const addAction = useCallback(
    async (botId: string, actionKey: string, policy: ActionPolicy, alwaysAsk?: boolean) => {
      const updated = await api.addBotAction(botId, {
        action_key: actionKey,
        policy,
        always_ask: alwaysAsk,
      });
      setBots((prev) => prev.map((b) => (b.id === botId ? updated : b)));
      return updated;
    },
    []
  );

  const removeAction = useCallback(async (botId: string, actionKey: string) => {
    const updated = await api.removeBotAction(botId, actionKey);
    setBots((prev) => prev.map((b) => (b.id === botId ? updated : b)));
    return updated;
  }, []);

  const addSkill = useCallback(async (botId: string, skillKey: string) => {
    const updated = await api.addBotSkill(botId, skillKey);
    setBots((prev) => prev.map((b) => (b.id === botId ? updated : b)));
    return updated;
  }, []);

  const removeSkill = useCallback(async (botId: string, skillKey: string) => {
    const updated = await api.removeBotSkill(botId, skillKey);
    setBots((prev) => prev.map((b) => (b.id === botId ? updated : b)));
    return updated;
  }, []);

  const upgradeSkill = useCallback(async (botId: string, skillKey: string) => {
    const updated = await api.upgradeBotSkill(botId, skillKey);
    setBots((prev) => prev.map((b) => (b.id === botId ? updated : b)));
    return updated;
  }, []);

  return {
    bots,
    templates,
    skills,
    apps,
    loading,
    refreshing,
    error,
    isOfflineCache,
    onRefresh,
    retry: () => {
      setLoading(true);
      fetchAll(false);
    },
    createBot,
    updateBot,
    toggleBot,
    deleteBot,
    runBot,
    loadBotDetails,
    resolvePending,
    updateActionPolicy,
    addAction,
    removeAction,
    addSkill,
    removeSkill,
    upgradeSkill,
  };
};
