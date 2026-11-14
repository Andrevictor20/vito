import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import {
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
import { syncPluggyItem, PluggySyncResult } from '../services/pluggySync';
import type { PluggyPortalMode } from '../components/finance/byok/PluggyPortalWebView';
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
  const [validated, setValidated] = useState(false);
  const [authStatus, setAuthStatus] = useState<ByokAuthStatus>('idle');
  const [validationNote, setValidationNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [clipboardUuids, setClipboardUuids] = useState<string[]>([]);
  const [webViewOpen, setWebViewOpen] = useState(false);
  const [webSessionKey, setWebSessionKey] = useState(0);
  const [portalMode, setPortalMode] = useState<PluggyPortalMode | null>(null);
  const [portalUrl, setPortalUrl] = useState('');
  const [step2Status, setStep2Status] = useState<ByokStep2Status>('idle');
  const [foundBanks, setFoundBanks] = useState<string[]>([]);
  const [syncPhase, setSyncPhase] = useState<ByokSyncPhase>('idle');
  const [syncCompletedCount, setSyncCompletedCount] = useState(0);
  const [syncedBanks, setSyncedBanks] = useState<string[]>([]);

  const stepRef = useRef<ByokStep>('tutorial');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingApiKeyRef = useRef('');
  const pendingConnectUrlRef = useRef('');

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
      setWebViewOpen(false);
      setPortalMode(null);
      setPortalUrl('');
      pendingApiKeyRef.current = '';
      pendingConnectUrlRef.current = '';
      setSyncPhase('idle');
      setClientId('');
      setClientSecret('');
      setClipboardUuids([]);
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
      if (stepRef.current !== '1') return;
      try {
        const raw = await Clipboard.getStringAsync();
        const found = extractUuids(raw).filter(
          (u) => u.toLowerCase() !== clientId.toLowerCase() && u.toLowerCase() !== clientSecret.toLowerCase(),
        );
        setClipboardUuids(found.slice(0, 2));
      } catch {
        setClipboardUuids([]);
      }
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

      if (canValidate(nextId, nextSec)) {
        void validateKeys(nextId, nextSec);
      }
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

  const handleWebViewCapture = useCallback(() => {}, []);
  const clearDraftKeys = useCallback(() => {
    setClientId('');
    setClientSecret('');
    setValidated(false);
    setAuthStatus('idle');
    setError('');
  }, []);
  const confirmWebViewKeys = useCallback(async () => {}, []);

  const apiKeyFromStore = useCallback(async (): Promise<string> => {
    let keys = await store.getKeys();
    if (!keys && canValidate(clientId, clientSecret)) {
      keys = { clientId: normalizeKey(clientId), clientSecret: normalizeKey(clientSecret) };
      await store.saveKeys(keys);
    }
    if (!keys) throw new PluggyError('invalid_keys', 'Chaves não encontradas. Refaça a Etapa 1.');
    return authenticate(keys.clientId, keys.clientSecret);
  }, [clientId, clientSecret]);

  // Abre o plugin oficial Pluggy Connect (connect.pluggy.ai/?connect_token=...) na WebView in-app.
  const syncNow = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const apiKey = await apiKeyFromStore();
      pendingApiKeyRef.current = apiKey;

      const token = await createConnectToken(apiKey, await store.getClientUserId());
      const url = buildPluggyConnectUrl(token, isDark);
      pendingConnectUrlRef.current = url;
      setPortalUrl(url);
      setPortalMode('connect');
    } catch (e) {
      setError(e instanceof PluggyError ? e.message : e instanceof Error ? e.message : 'Falha ao abrir Pluggy Connect.');
    } finally {
      setBusy(false);
    }
  }, [apiKeyFromStore, isDark]);

  // Etapa 2: abre direto o plugin oficial Pluggy Connect para associar Meu Pluggy / bancos ao connect_token.
  const confirmBanks = useCallback(async () => {
    await syncNow();
  }, [syncNow]);

  const completeConnectSync = useCallback(
    async (itemId: string) => {
      setPortalMode(null);
      setBusy(true);
      setError('');
      setStep2Status('found');
      goTo('3');
      setSyncPhase('running');
      setSyncCompletedCount(2);
      try {
        const apiKey = pendingApiKeyRef.current || (await apiKeyFromStore());
        const result = await syncPluggyItem(apiKey, itemId || undefined, (completed) => {
          setSyncCompletedCount(completed);
        });

        if (result.accountsCount === 0) {
          setSyncPhase('waiting_auth');
          setSyncCompletedCount(2);
          setError('Nenhuma conta encontrada. Conclua a autorização no Pluggy Connect para continuar.');
          return;
        }

        setSyncCompletedCount(6);
        const banks = Array.from(
          new Set([result.institutionName, ...foundBanks].filter((n) => !!n && n.trim().length > 0)),
        );
        setSyncedBanks(banks.length > 0 ? banks : ['Meu Pluggy']);
        setSyncPhase('done');
        setShortcut(true);
        goTo('done');
        onSynced?.(result);
      } catch (e) {
        setSyncPhase('error');
        setError(e instanceof PluggyError ? e.message : e instanceof Error ? e.message : 'Falha ao sincronizar.');
      } finally {
        setBusy(false);
      }
    },
    [apiKeyFromStore, foundBanks, goTo, onSynced],
  );

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

  const openConnectExternal = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const apiKey = await apiKeyFromStore();
      pendingApiKeyRef.current = apiKey;

      const clientUserId = await store.getClientUserId();
      const token = await createConnectToken(apiKey, clientUserId);
      const url = buildPluggyConnectUrl(token, isDark);
      pendingConnectUrlRef.current = url;
      setPortalUrl(url);

      const authRes = await WebBrowser.openAuthSessionAsync(url, 'vito://pluggy-success');
      if (authRes.type === 'success' && authRes.url) {
        const callbackItemId = parseItemId(authRes.url);
        if (callbackItemId) {
          await completeConnectSync(callbackItemId);
          return;
        }
      }
      // Se fechar ou voltar sem redirect, deixa pronto para sincronização manual com 1 toque
      setStep2Status('found');
    } catch (e) {
      setError(e instanceof PluggyError ? e.message : e instanceof Error ? e.message : 'Falha ao abrir Pluggy Connect.');
    } finally {
      setBusy(false);
    }
  }, [apiKeyFromStore, completeConnectSync, isDark]);

  const openDashboard = openDashboardExternal;
  const closeDashboard = useCallback(() => setWebViewOpen(false), []);
  const openMeuPluggy = openConnectExternal;
  const fallbackConnectExternal = openConnectExternal;
  const closePortal = useCallback(() => setBusy(false), []);
  const finishMeuPluggyPortal = useCallback(() => {
    void completeConnectSync('');
  }, [completeConnectSync]);

  const resetLocalFlow = useCallback(
    (targetStep: ByokStep) => {
      clearPendingTimer();
      pendingApiKeyRef.current = '';
      pendingConnectUrlRef.current = '';
      setWebViewOpen(false);
      setPortalMode(null);
      setWebSessionKey((k) => k + 1);
      setClientId('');
      setClientSecret('');
      setClipboardUuids([]);
      setValidated(false);
      setAuthStatus('idle');
      setValidationNote('');
      setStep2Status('idle');
      setFoundBanks([]);
      setSyncPhase('idle');
      setShortcut(false);
      goTo(targetStep);
    },
    [clearPendingTimer, goTo],
  );

  const changeKeys = useCallback(async () => {
    await store.clearKeys();
    resetLocalFlow('1');
  }, [resetLocalFlow]);

  const resetFromScratch = useCallback(async () => {
    await store.resetAllFromScratch();
    resetLocalFlow('tutorial');
  }, [resetLocalFlow]);

  const showTutorial = useCallback(() => {
    setShortcut(false);
    goTo('tutorial');
  }, [goTo]);
  const resetSyncView = useCallback(() => {
    setSyncPhase('idle');
    setError('');
  }, []);

  return {
    ready, step, shortcut, clientId, clientSecret, validated, authStatus, validationNote, busy, error,
    clipboardUuids, clipboardSuggestion: clipboardUuids[0] ?? '', webViewOpen, webSessionKey,
    portalMode, portalUrl, step2Status, foundBanks, syncPhase, syncCompletedCount, syncedBanks,
    finishTutorial, paste, applySuggestion, updateField, validateKeys, handleWebViewCapture,
    clearDraftKeys, confirmWebViewKeys, confirmBanks, syncNow, completeConnectSync, fallbackConnectExternal,
    openDashboard, closeDashboard, openMeuPluggy, closePortal, finishMeuPluggyPortal, changeKeys,
    openDashboardExternal, openConnectExternal,
    resetFromScratch, showTutorial, resetSyncView,
  };
}
