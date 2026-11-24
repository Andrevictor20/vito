import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import {
  buildLimitRuleFromSuggestion,
  buildPluggyConnectUrl,
  ByokStep,
  initialStep,
  isShortcutMode,
  mergeClipboardSuggestion,
  parseItemId,
} from '../utils/byokFlow';
import {
  canValidate,
  detectSwappedKeysCandidate,
  extractUuids,
  hasIdenticalKeys,
  normalizeKey,
} from '../utils/pluggyKeys';
import {
  authenticate,
  createConnectToken,
  PluggyError,
} from '../services/pluggyService';
import { syncAllDiscoveredItems, syncPluggyItem, PluggySyncResult } from '../services/pluggySync';
import { api } from '../services/api';
import type { FinanceLimitSuggestion } from '../types/finance';
import * as store from '../services/byokStore';

export const DASHBOARD_URL = 'https://dashboard.pluggy.ai';
export const MEU_PLUGGY_URL = 'https://meu.pluggy.ai';

export type ByokAuthStatus = 'idle' | 'validating' | 'validated' | 'error' | 'offline';
export type ByokStep2Status = 'idle' | 'loading' | 'zero' | 'found' | 'error';
export type ByokSyncPhase = 'idle' | 'running' | 'waiting_auth' | 'done' | 'error';

interface Options {
  visible: boolean;
  isDark: boolean;
  onSynced?: (r: PluggySyncResult) => void;
}

/** Orquestra o onboarding BYOK (Plano 26 v2.0): tutorial → WebView/Etapa 1 → 2 → 3 → syncV/doneV → atalho. */
export function useByokSetup({ visible, isDark, onSynced }: Options) {
  const [ready, setReady] = useState(false);
  const [step, setStepState] = useState<ByokStep>('tutorial');
  const [shortcut, setShortcut] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [connectionItemId, setConnectionItemId] = useState('');
  const [validated, setValidated] = useState(false);
  const [authStatus, setAuthStatus] = useState<ByokAuthStatus>('idle');
  const [validationNote, setValidationNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [clipboardUuids, setClipboardUuids] = useState<string[]>([]);
  const [step2Status, setStep2Status] = useState<ByokStep2Status>('idle');
  const [foundBanks, setFoundBanks] = useState<string[]>([]);
  const [syncPhase, setSyncPhase] = useState<ByokSyncPhase>('idle');
  const [syncCompletedCount, setSyncCompletedCount] = useState(0);
  const [syncedBanks, setSyncedBanks] = useState<string[]>([]);
  const [limitSuggestions, setLimitSuggestions] = useState<FinanceLimitSuggestion[]>([]);

  const stepRef = useRef<ByokStep>('tutorial');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingApiKeyRef = useRef('');

  const clearPendingTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearPendingTimer(), [clearPendingTimer]);

  const goTo = useCallback((s: ByokStep) => {
    stepRef.current = s;
    setStepState(s);
    setError('');
    void store.setStep(s);
  }, []);

  useEffect(() => {
    if (!visible) {
      clearPendingTimer();
      pendingApiKeyRef.current = '';
      setSyncPhase('idle');
      setClientId('');
      setClientSecret('');
      setConnectionItemId('');
      setClipboardUuids([]);
      setLimitSuggestions([]);
      setReady(false);
      return;
    }
    let alive = true;
    (async () => {
      await store.ensureCleanStartReset0129();
      let keys = await store.getKeys();
      if (!keys) keys = await store.restoreBackupKeys();
      const [saved, seen] = await Promise.all([store.getStep(), store.isTutorialSeen()]);
      if (!alive) return;
      const p = { hasKeys: !!keys, tutorialSeen: seen, step: saved };
      setValidated(!!keys);
      setAuthStatus(keys ? 'validated' : 'idle');
      setClientId(keys?.clientId ?? '');
      setClientSecret(keys?.clientSecret ?? '');
      setShortcut(isShortcutMode(p));
      const s = initialStep(p);
      stepRef.current = s;
      setStepState(s);
      setStep2Status('idle');
      setSyncPhase('idle');
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [visible, clearPendingTimer]);

  // Fallback clipboard: sugere UUIDs detectados ao voltar ao app (nunca preenche sem toque — BYOK-09).
  useEffect(() => {
    if (!visible) return;
    const check = async () => {
      const raw = await Clipboard.getStringAsync().catch(() => '');
      const found = extractUuids(raw).filter(
        (u) => u.toLowerCase() !== clientId.toLowerCase() && u.toLowerCase() !== clientSecret.toLowerCase(),
      );
      setClipboardUuids(found.slice(0, 2));
    };
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') void check();
    });
    return () => sub.remove();
  }, [visible, clientId, clientSecret]);

  const finishTutorial = useCallback(async () => {
    await store.markTutorialSeen();
    const keys = await store.getKeys();
    if (keys && stepRef.current === 'done') {
      setShortcut(true);
      goTo('done');
      return;
    }
    goTo(keys ? '2' : '1');
  }, [goTo]);

  // Etapa 1: valida via POST /auth; tenta par invertido em caso de 401 com 2 UUIDs distintos.
  const validateKeys = useCallback(
    async (overrideId?: string, overrideSecret?: string, opts?: { fromWebView?: boolean }): Promise<boolean> => {
      const id = normalizeKey(overrideId ?? clientId);
      const sec = normalizeKey(overrideSecret ?? clientSecret);

      if (hasIdenticalKeys(id, sec)) {
        setAuthStatus('error');
        setError('O Client ID e o Client Secret estão iguais. Copie cada um no seu campo.');
        return false;
      }
      if (!canValidate(id, sec)) {
        setAuthStatus('error');
        setError('Informe o Client ID (UUID) e o Client Secret.');
        return false;
      }

      setBusy(true);
      setAuthStatus('validating');
      setError('');
      setValidationNote('');

      let finalId = id;
      let finalSec = sec;
      let note = opts?.fromWebView ? 'Capturadas direto do Dashboard. ' : '';

      try {
        try {
          await authenticate(finalId, finalSec);
        } catch (err) {
          const swapped = detectSwappedKeysCandidate(finalId, finalSec);
          if (err instanceof PluggyError && err.kind === 'invalid_keys' && swapped) {
            await authenticate(swapped.clientId, swapped.clientSecret);
            finalId = swapped.clientId;
            finalSec = swapped.clientSecret;
            note = 'Ordem corrigida: o Vito inverteu o Client ID e o Client Secret. ';
          } else {
            throw err;
          }
        }

        await store.saveKeys({ clientId: finalId, clientSecret: finalSec });
        setClientId(finalId);
        setClientSecret(finalSec);
        setValidated(true);
        setAuthStatus('validated');
        setValidationNote(note);

        clearPendingTimer();
        timerRef.current = setTimeout(() => {
          goTo('2');
        }, 950);
        return true;
      } catch (e) {
        setValidated(false);
        const isNet = e instanceof PluggyError && e.kind === 'network';
        setAuthStatus(isNet ? 'offline' : 'error');
        setError(e instanceof PluggyError ? e.message : 'Falha ao validar as chaves.');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [clientId, clientSecret, goTo, clearPendingTimer],
  );

  const paste = useCallback(
    async (field: 'id' | 'secret') => {
      const raw = await Clipboard.getStringAsync().catch(() => '');
      const uuids = extractUuids(raw);
      const text = uuids[0] ?? normalizeKey(raw);
      if (!text) return;

      if (uuids.length >= 2 && !clientId && !clientSecret) {
        setClientId(uuids[0]);
        setClientSecret(uuids[1]);
        setClipboardUuids([]);
        await Clipboard.setStringAsync('').catch(() => {});
        void validateKeys(uuids[0], uuids[1]);
        return;
      }

      if (field === 'id') {
        setClientId(text);
      } else {
        setClientSecret(text);
        await Clipboard.setStringAsync('').catch(() => {});
      }
      setValidated(false);
      setAuthStatus('idle');
      setError('');
    },
    [clientId, clientSecret, validateKeys],
  );

  const applySuggestion = useCallback(
    (target?: 'id' | 'secret') => {
      if (clipboardUuids.length === 0) return;
      const { nextId, nextSec } = mergeClipboardSuggestion(clipboardUuids, clientId, clientSecret, target);
      setClientId(nextId);
      setClientSecret(nextSec);
      setClipboardUuids([]);
      setValidated(false);
      setAuthStatus('idle');
      void Clipboard.setStringAsync('').catch(() => {});
      if (canValidate(nextId, nextSec)) void validateKeys(nextId, nextSec);
    },
    [clipboardUuids, clientId, clientSecret, validateKeys],
  );

  const updateField = useCallback((field: 'id' | 'secret', v: string) => {
    if (field === 'id') setClientId(v);
    else setClientSecret(v);
    setValidated(false);
    setAuthStatus('idle');
    setError('');
  }, []);

  const updateConnectionItemId = useCallback((v: string) => { setConnectionItemId(v); setError(''); }, []);

  const pasteConnectionItemId = useCallback(async () => {
    const raw = await Clipboard.getStringAsync().catch(() => '');
    const text = extractUuids(raw)[0] ?? normalizeKey(raw);
    if (text) { setConnectionItemId(text); setError(''); }
  }, []);

  const clearDraftKeys = () => { setClientId(''); setClientSecret(''); setValidated(false); setAuthStatus('idle'); setError(''); };

  const apiKeyFromStore = useCallback(async (): Promise<string> => {
    let keys = await store.getKeys();
    if (!keys && canValidate(clientId, clientSecret)) {
      keys = { clientId: normalizeKey(clientId), clientSecret: normalizeKey(clientSecret) };
      await store.saveKeys(keys);
    }
    if (!keys) throw new PluggyError('invalid_keys', 'Chaves não encontradas. Refaça a Etapa 1.');
    return authenticate(keys.clientId, keys.clientSecret);
  }, [clientId, clientSecret]);

  const loadPostSyncSuggestions = useCallback(async () => {
    const suggestions = await api.finance.getLimitSuggestions().catch(() => []);
    setLimitSuggestions(Array.isArray(suggestions) ? suggestions : []);
  }, []);

  const activateLimitSuggestion = useCallback(async (s: FinanceLimitSuggestion) => {
    await api.finance.createLimit(buildLimitRuleFromSuggestion(s));
  }, []);

  const completeConnectSync = useCallback(
    async (overrideItemId?: string) => {
      const targetItemId = normalizeKey(overrideItemId || connectionItemId);
      setBusy(true);
      setError('');
      setStep2Status('found');
      goTo('3');
      setSyncPhase('running');
      setSyncCompletedCount(2);
      try {
        const apiKey = pendingApiKeyRef.current || (await apiKeyFromStore());
        const resultsList: PluggySyncResult[] = targetItemId
          ? [await syncPluggyItem(apiKey, targetItemId, (c) => setSyncCompletedCount(c), { mode: 'manual', onRefreshApiKey: apiKeyFromStore })]
          : await syncAllDiscoveredItems(apiKey, (c) => setSyncCompletedCount(c), { mode: 'manual', onRefreshApiKey: apiKeyFromStore });

        const totalAccounts = resultsList.reduce((acc, r) => acc + r.accountsCount, 0);
        if (totalAccounts === 0) {
          setSyncPhase('waiting_auth');
          setSyncCompletedCount(2);
          setError(
            targetItemId
              ? 'Nenhuma conta encontrada para o ID informado. Verifique se a conexão concluiu com sucesso no Pluggy Dashboard.'
              : 'Nenhuma conta encontrada. Conclua a autorização no Pluggy Connect ou informe o ID da Conexão para continuar.',
          );
          return;
        }

        setSyncCompletedCount(6);
        const banks = Array.from(
          new Set([...resultsList.map((r) => r.institutionName), ...foundBanks].filter((n) => !!n && n.trim().length > 0)),
        );
        setSyncedBanks(banks.length > 0 ? banks : ['Meu Pluggy']);
        setSyncPhase('done');
        setShortcut(true);
        goTo('done');
        void loadPostSyncSuggestions();
        onSynced?.(resultsList[0]);
      } catch (e) {
        setSyncPhase('error');
        setError(e instanceof PluggyError ? e.message : e instanceof Error ? e.message : 'Falha ao sincronizar.');
      } finally {
        setBusy(false);
      }
    },
    [apiKeyFromStore, connectionItemId, foundBanks, goTo, loadPostSyncSuggestions, onSynced],
  );

  // Sincroniza todas as conexões existentes em 1 toque (Atalho Etapa 3) ou abre Pluggy Connect se não houver nenhuma.
  const syncNow = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const connections = await api.finance.getConnections().catch(() => []);
      if (connections.length === 0) {
        await completeConnectSync('');
        return;
      }
      setSyncPhase('running');
      setSyncCompletedCount(2);
      const apiKey = await apiKeyFromStore();
      const resultsList: PluggySyncResult[] = [];
      for (const conn of connections) {
        const res = await syncPluggyItem(apiKey, conn.pluggy_item_id, (c) => setSyncCompletedCount(c), {
          mode: 'manual',
          connectionId: conn.id,
          lastSyncAt: conn.last_sync_at,
          lastBankRefreshAt: conn.last_bank_refresh_at,
          onRefreshApiKey: apiKeyFromStore,
        });
        resultsList.push(res);
      }
      setSyncCompletedCount(6);
      const banks = Array.from(
        new Set(resultsList.map((r) => r.institutionName).filter((n) => !!n && n.trim().length > 0)),
      );
      setSyncedBanks(banks.length > 0 ? banks : ['Meu Pluggy']);
      setSyncPhase('done');
      setShortcut(true);
      goTo('done');
      void loadPostSyncSuggestions();
      if (resultsList[0]) onSynced?.(resultsList[0]);
    } catch (e) {
      setSyncPhase('error');
      setError(e instanceof PluggyError ? e.message : e instanceof Error ? e.message : 'Falha ao sincronizar.');
    } finally {
      setBusy(false);
    }
  }, [apiKeyFromStore, completeConnectSync, goTo, loadPostSyncSuggestions, onSynced]);

  const confirmBanks = useCallback(async () => {
    await syncNow();
  }, [syncNow]);

  // Escuta deep links (ex.: vito://pluggy-success?itemId=...) quando o navegador externo redireciona de volta.
  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      const itemId = parseItemId(event.url);
      if (itemId) {
        void completeConnectSync(itemId);
      }
    };
    const sub = Linking.addEventListener('url', handleUrl);
    void Linking.getInitialURL().then((url) => {
      if (url) {
        const itemId = parseItemId(url);
        if (itemId) void completeConnectSync(itemId);
      }
    });
    return () => sub.remove();
  }, [completeConnectSync]);

  const openDashboardExternal = useCallback(async () => {
    setError('');
    try {
      await WebBrowser.openBrowserAsync(DASHBOARD_URL);
    } catch {
      await Linking.openURL(DASHBOARD_URL).catch(() => {});
    }
  }, []);

  const launchConnectSession = useCallback(
    async (reconnectItemId?: string) => {
      setBusy(true);
      setError('');
      try {
        const apiKey = await apiKeyFromStore();
        pendingApiKeyRef.current = apiKey;
        const clientUserId = await store.getClientUserId();
        const token = await createConnectToken(apiKey, clientUserId, fetch, reconnectItemId);
        const url = buildPluggyConnectUrl(token, isDark);

        const authRes = await WebBrowser.openAuthSessionAsync(url, 'vito://pluggy-success');
        if (authRes.type === 'success' && authRes.url) {
          const callbackItemId = parseItemId(authRes.url);
          if (callbackItemId || reconnectItemId) {
            await completeConnectSync(callbackItemId || reconnectItemId);
            return;
          }
        }
        try {
          const raw = await Clipboard.getStringAsync();
          const found = extractUuids(raw).filter(
            (u) => u.toLowerCase() !== clientId.toLowerCase() && u.toLowerCase() !== clientSecret.toLowerCase(),
          );
          if (found.length > 0) setClipboardUuids(found.slice(0, 2));
        } catch {}
        setStep2Status('found');
      } catch (e) {
        setError(e instanceof PluggyError ? e.message : e instanceof Error ? e.message : 'Falha ao abrir Pluggy Connect.');
      } finally {
        setBusy(false);
      }
    },
    [apiKeyFromStore, completeConnectSync, isDark, clientId, clientSecret],
  );

  const openConnectExternal = useCallback(() => launchConnectSession(), [launchConnectSession]);
  const openReconnectExternal = useCallback((itemId: string) => launchConnectSession(itemId), [launchConnectSession]);

  const resetLocalFlow = useCallback(
    (targetStep: ByokStep) => {
      clearPendingTimer();
      pendingApiKeyRef.current = '';
      setClientId('');
      setClientSecret('');
      setConnectionItemId('');
      setClipboardUuids([]);
      setValidated(false);
      setAuthStatus('idle');
      setValidationNote('');
      setStep2Status('idle');
      setFoundBanks([]);
      setLimitSuggestions([]);
      setSyncPhase('idle');
      setShortcut(false);
      goTo(targetStep);
    },
    [clearPendingTimer, goTo],
  );

  const changeKeys = useCallback(async () => { await store.clearKeys(); resetLocalFlow('1'); }, [resetLocalFlow]);
  const resetFromScratch = useCallback(async () => { await store.resetAllFromScratch(); resetLocalFlow('tutorial'); }, [resetLocalFlow]);
  const showTutorial = useCallback(() => { setShortcut(false); goTo('tutorial'); }, [goTo]);
  const resetSyncView = useCallback(() => { setSyncPhase('idle'); setError(''); goTo('2'); }, [goTo]);

  return {
    ready, step, shortcut, clientId, clientSecret, validated, authStatus, validationNote, busy, error,
    connectionItemId, updateConnectionItemId, pasteConnectionItemId,
    clipboardUuids, clipboardSuggestion: clipboardUuids[0] ?? '',
    step2Status, foundBanks, syncPhase, syncCompletedCount, syncedBanks, limitSuggestions,
    finishTutorial, paste, applySuggestion, updateField, validateKeys, activateLimitSuggestion,
    clearDraftKeys, confirmBanks, syncNow, completeConnectSync,
    fallbackConnectExternal: openConnectExternal, openDashboard: openDashboardExternal,
    openMeuPluggy: openConnectExternal, openReconnectExternal,
    changeKeys, openDashboardExternal, openConnectExternal, resetFromScratch, showTutorial, resetSyncView,
  };
}
