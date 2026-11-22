import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { CreateBotInput, PendingDecision } from '../services/api/botsApi';
import {
  ActionPolicy,
  Bot,
  BotActivityItem,
  BotAppStatus,
  BotChatMessage,
  BotMemory,
  BotTemplate,
  SkillPackage,
} from '../types/bot';

const BOTS_CACHE_KEY = 'vito_bots_cache_v1';

export interface UndoToastState {
  message: string;
  onUndo: () => Promise<void>;
}

export function useBots() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [templates, setTemplates] = useState<BotTemplate[]>([]);
  const [skills, setSkills] = useState<SkillPackage[]>([]);
  const [apps, setApps] = useState<BotAppStatus[]>([]);
  const [activity, setActivity] = useState<BotActivityItem[]>([]);

  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
  const [chatMessages, setChatMessages] = useState<BotChatMessage[]>([]);
  const [memories, setMemories] = useState<BotMemory[]>([]);

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const [busyBotIds, setBusyBotIds] = useState<Record<string, boolean>>({});
  const [happyBotIds, setHappyBotIds] = useState<Record<string, boolean>>({});
  const [undoToast, setUndoToast] = useState<UndoToastState | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showUndoToast = useCallback((message: string, onUndo: () => Promise<void>) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast({ message, onUndo });
    undoTimerRef.current = setTimeout(() => {
      setUndoToast(null);
    }, 5000);
  }, []);

  const dismissUndoToast = useCallback(() => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast(null);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [botsData, tplData, skillsData, appsData, activityData] = await Promise.all([
        api.botsApi.getBots(),
        api.botsApi.getCatalogTemplates().catch(() => [] as BotTemplate[]),
        api.botsApi.getCatalogSkills().catch(() => [] as SkillPackage[]),
        api.botsApi.getApps().catch(() => [] as BotAppStatus[]),
        api.botsApi.getActivity(20).catch(() => [] as BotActivityItem[]),
      ]);
      setBots(botsData);
      setTemplates(tplData);
      setSkills(skillsData);
      setApps(appsData);
      setActivity(activityData);
      setIsOffline(false);
      try {
        localStorage.setItem(BOTS_CACHE_KEY, JSON.stringify({ bots: botsData, templates: tplData, skills: skillsData, apps: appsData }));
      } catch {
        // Ignora erro de quota no storage
      }
    } catch (e) {
      const cached = localStorage.getItem(BOTS_CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setBots(parsed.bots || []);
          setTemplates(parsed.templates || []);
          setSkills(parsed.skills || []);
          setApps(parsed.apps || []);
          setIsOffline(true);
          setError(null);
        } catch {
          setError(e instanceof Error ? e.message : 'Não foi possível carregar seus bots.');
        }
      } else {
        setError(e instanceof Error ? e.message : 'Não foi possível carregar seus bots.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshBotDetail = useCallback(async (botId: string) => {
    if (!botId) return;
    setDetailLoading(true);
    try {
      const [botData, chatData, memData] = await Promise.all([
        api.botsApi.getBot(botId),
        api.botsApi.getBotChat(botId).catch(() => [] as BotChatMessage[]),
        api.botsApi.getBotMemories(botId).catch(() => [] as BotMemory[]),
      ]);
      setSelectedBot(botData);
      setChatMessages(chatData);
      setMemories(memData);
      setBots((prev) => prev.map((b) => (b.id === botId ? { ...b, ...botData } : b)));
    } catch (e) {
      console.warn('[useBots] Falha ao carregar detalhe do bot:', e);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (selectedBotId) {
      refreshBotDetail(selectedBotId);
    } else {
      setSelectedBot(null);
      setChatMessages([]);
      setMemories([]);
    }
  }, [selectedBotId, refreshBotDetail]);

  const createBot = useCallback(async (input: CreateBotInput) => {
    const created = await api.botsApi.createBot(input);
    setBots((prev) => [created, ...prev]);
    setSelectedBotId(created.id);
    return created;
  }, []);

  const updateBot = useCallback(async (id: string, updates: Partial<Bot>) => {
    const updated = await api.botsApi.updateBot(id, updates);
    setBots((prev) => prev.map((b) => (b.id === id ? { ...b, ...updated } : b)));
    if (selectedBotId === id) {
      setSelectedBot((prev) => (prev ? { ...prev, ...updated } : updated));
    }
    return updated;
  }, [selectedBotId]);

  const toggleBot = useCallback(async (id: string, active: boolean) => {
    const updated = await api.botsApi.toggleBot(id, active);
    setBots((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updated, status: active ? 'active' : 'paused' } : b))
    );
    if (selectedBotId === id) {
      setSelectedBot((prev) =>
        prev ? { ...prev, ...updated, status: active ? 'active' : 'paused' } : null
      );
    }
  }, [selectedBotId]);

  const deleteBot = useCallback(async (id: string) => {
    await api.botsApi.deleteBot(id);
    setBots((prev) => prev.filter((b) => b.id !== id));
    if (selectedBotId === id) {
      setSelectedBotId(null);
    }
  }, [selectedBotId]);

  const runBot = useCallback(async (id: string) => {
    setBusyBotIds((prev) => ({ ...prev, [id]: true }));
    try {
      const log = await api.botsApi.runBot(id);
      setHappyBotIds((prev) => ({ ...prev, [id]: true }));
      setTimeout(() => {
        setHappyBotIds((prev) => ({ ...prev, [id]: false }));
      }, 2400);
      await fetchAll();
      if (selectedBotId === id) {
        await refreshBotDetail(id);
      }
      return log;
    } finally {
      setBusyBotIds((prev) => ({ ...prev, [id]: false }));
    }
  }, [fetchAll, refreshBotDetail, selectedBotId]);

  const sendBotChat = useCallback(async (id: string, message: string) => {
    const tempUserMsg: BotChatMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, tempUserMsg]);
    setBusyBotIds((prev) => ({ ...prev, [id]: true }));
    try {
      const reply = await api.botsApi.sendBotChat(id, message);
      setChatMessages((prev) => [...prev, reply]);
      await refreshBotDetail(id);
      return reply;
    } finally {
      setBusyBotIds((prev) => ({ ...prev, [id]: false }));
    }
  }, [refreshBotDetail]);

  const addAction = useCallback(async (id: string, actionKey: string, policy?: ActionPolicy) => {
    await api.botsApi.addBotAction(id, actionKey, policy);
    await refreshBotDetail(id);
    await fetchAll();
  }, [fetchAll, refreshBotDetail]);

  const updateActionPolicy = useCallback(async (
    id: string,
    actionKey: string,
    policy: ActionPolicy,
    alwaysAsk?: boolean
  ) => {
    await api.botsApi.updateBotAction(id, actionKey, policy, alwaysAsk);
    await refreshBotDetail(id);
  }, [refreshBotDetail]);

  const removeAction = useCallback(async (id: string, actionKey: string) => {
    await api.botsApi.removeBotAction(id, actionKey);
    await refreshBotDetail(id);
    await fetchAll();
  }, [fetchAll, refreshBotDetail]);

  const addSkill = useCallback(async (id: string, skillKey: string) => {
    await api.botsApi.addBotSkill(id, skillKey);
    await refreshBotDetail(id);
    await fetchAll();
  }, [fetchAll, refreshBotDetail]);

  const removeSkill = useCallback(async (id: string, skillKey: string, skillName?: string) => {
    await api.botsApi.removeBotSkill(id, skillKey);
    await refreshBotDetail(id);
    await fetchAll();
    showUndoToast(
      `Habilidade "${skillName || skillKey}" removida. As ações continuam ativas.`,
      async () => {
        await api.botsApi.addBotSkill(id, skillKey);
        await refreshBotDetail(id);
        await fetchAll();
      }
    );
  }, [fetchAll, refreshBotDetail, showUndoToast]);

  const upgradeSkill = useCallback(async (id: string, skillKey: string) => {
    await api.botsApi.upgradeBotSkill(id, skillKey);
    await refreshBotDetail(id);
    await fetchAll();
  }, [fetchAll, refreshBotDetail]);

  const addMemory = useCallback(async (id: string, content: string) => {
    const created = await api.botsApi.addBotMemory(id, content);
    setMemories((prev) => [created, ...prev]);
    return created;
  }, []);

  const deleteMemory = useCallback(async (id: string, memId: string) => {
    await api.botsApi.deleteBotMemory(id, memId);
    setMemories((prev) => prev.filter((m) => m.id !== memId));
  }, []);

  const resolvePending = useCallback(async (
    botId: string,
    confirmationId: string,
    decision: PendingDecision,
    actionKey?: string,
    alwaysAsk?: boolean
  ) => {
    await api.botsApi.resolvePending(botId, confirmationId, decision, actionKey, alwaysAsk);
    await fetchAll();
    if (selectedBotId === botId) {
      await refreshBotDetail(botId);
    }
  }, [fetchAll, refreshBotDetail, selectedBotId]);

  const updateModel = useCallback(async (id: string, modelPref: string, effortPref?: string) => {
    await api.botsApi.updateBotModel(id, modelPref, effortPref);
    await refreshBotDetail(id);
    await fetchAll();
  }, [fetchAll, refreshBotDetail]);

  const suggestApp = useCallback(async (name: string, reason: string) => {
    await api.botsApi.suggestApp(name, reason);
  }, []);

  return {
    bots,
    templates,
    skills,
    apps,
    activity,
    selectedBotId,
    setSelectedBotId,
    selectedBot,
    chatMessages,
    memories,
    loading,
    detailLoading,
    error,
    isOffline,
    busyBotIds,
    happyBotIds,
    undoToast,
    dismissUndoToast,
    refresh: fetchAll,
    refreshBotDetail,
    createBot,
    updateBot,
    toggleBot,
    deleteBot,
    runBot,
    sendBotChat,
    addAction,
    updateActionPolicy,
    removeAction,
    addSkill,
    removeSkill,
    upgradeSkill,
    addMemory,
    deleteMemory,
    resolvePending,
    updateModel,
    suggestApp,
  };
}
