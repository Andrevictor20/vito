import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { ByokStep, initialStep, isShortcutMode, parseItemId, step2Outcome } from '../utils/byokFlow';
import {
  canValidate,
  detectSwappedKeysCandidate,
  extractUuids,
  hasIdenticalKeys,
  normalizeKey,
} from '../utils/pluggyKeys';
import { authenticate, createConnectToken, listItems, PluggyError } from '../services/pluggyService';
import { syncPluggyItem, PluggySyncResult } from '../services/pluggySync';
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
  const [step2Status, setStep2Status] = useState<ByokStep2Status>('idle');
  const [foundBanks, setFoundBanks] = useState<string[]>([]);
  const [syncPhase, setSyncPhase] = useState<ByokSyncPhase>('idle');
  const [syncCompletedCount, setSyncCompletedCount] = useState(0);
  const [syncedBanks, setSyncedBanks] = useState<string[]>([]);

  const stepRef = useRef<ByokStep>('tutorial');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setSyncPhase('idle');
      setClientId('');
      setClientSecret('');
      setClipboardUuids([]);
      setReady(false);
      return;
    }
    let alive = true;
    (async () => {
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
    async (overrideId?: string, overrideSecret?: string, opts?: { fromWebView?: boolean }) => {
      const id = normalizeKey(overrideId ?? clientId);
      const sec = normalizeKey(overrideSecret ?? clientSecret);

      if (hasIdenticalKeys(id, sec)) {
        setAuthStatus('error');
        setError('O Client ID e o Client Secret estão iguais. Copie cada um no seu campo.');
        return;
      }
      if (!canValidate(id, sec)) {
        setAuthStatus('error');
        setError('Informe o Client ID (UUID) e o Client Secret.');
        return;
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
      } catch (e) {
        setValidated(false);
        const isNet = e instanceof PluggyError && e.kind === 'network';
        setAuthStatus(isNet ? 'offline' : 'error');
        setError(e instanceof PluggyError ? e.message : 'Falha ao validar as chaves.');
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
      let nextId = clientId;
      let nextSec = clientSecret;

      if (clipboardUuids.length >= 2) {
        nextId = clipboardUuids[0];
        nextSec = clipboardUuids[1];
      } else {
        const dest = target ?? (!clientId ? 'id' : 'secret');
        if (dest === 'id') nextId = clipboardUuids[0];
        else nextSec = clipboardUuids[0];
      }

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

  const handleWebViewCapture = useCallback(
    (payload: { clientId?: string; clientSecret?: string }) => {
      const nextId = payload.clientId ? normalizeKey(payload.clientId) : clientId;
      const nextSec = payload.clientSecret ? normalizeKey(payload.clientSecret) : clientSecret;
      if (payload.clientId) setClientId(nextId);
      if (payload.clientSecret) {
        setClientSecret(nextSec);
        void Clipboard.setStringAsync('').catch(() => {});
      }
      setValidated(false);
      setAuthStatus('idle');
      setError('');

      if (canValidate(nextId, nextSec)) {
        setWebViewOpen(false);
        void validateKeys(nextId, nextSec, { fromWebView: true });
      }
    },
    [clientId, clientSecret, validateKeys],
  );

  const apiKeyFromStore = useCallback(async (): Promise<string> => {
    const keys = await store.getKeys();
    if (!keys) throw new PluggyError('invalid_keys', 'Chaves não encontradas. Refaça a Etapa 1.');
    return authenticate(keys.clientId, keys.clientSecret);
  }, []);

  // Etapa 2: confirma a conexão consultando GET /items (Q-3).
  const confirmBanks = useCallback(async () => {
    setBusy(true);
    setStep2Status('loading');
    setError('');
    try {
      const items = await listItems(await apiKeyFromStore());
      const out = step2Outcome(items.length);
      if (out.advance) {
        const names = Array.from(
          new Set(items.map((item) => item.connector?.name?.trim()).filter((n): n is string => !!n)),
        );
        setFoundBanks(names.length > 0 ? names : ['Meu Pluggy']);
        setStep2Status('found');
        clearPendingTimer();
        timerRef.current = setTimeout(() => {
          goTo('3');
        }, 900);
      } else {
        setStep2Status('zero');
        setError(out.message);
      }
    } catch (e) {
      setStep2Status('error');
      setError(e instanceof PluggyError ? e.message : 'Falha ao consultar a Pluggy.');
    } finally {
      setBusy(false);
    }
  }, [apiKeyFromStore, goTo, clearPendingTimer]);

  // Etapa 3: connectToken local + widget externo conector 200 + Edge-Sync em 6 checkpoints.
  const syncNow = useCallback(async () => {
    setBusy(true);
    setError('');
    setSyncPhase('running');
    setSyncCompletedCount(0);
    try {
      const apiKey = await apiKeyFromStore();
      setSyncCompletedCount(1);

      const token = await createConnectToken(apiKey, await store.getClientUserId());
      setSyncCompletedCount(2);

      const url =
        `https://connect.pluggy.ai/?connect_token=${encodeURIComponent(token)}` +
        `&connectToken=${encodeURIComponent(token)}&includeSandbox=false&selectedConnectorId=200` +
        `&theme=${isDark ? 'dark' : 'light'}`;
      const res = await WebBrowser.openAuthSessionAsync(url, 'vito://pluggy-success');
      const itemId = res.type === 'success' ? parseItemId(res.url) : '';

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
  }, [apiKeyFromStore, foundBanks, goTo, isDark, onSynced]);

  const openDashboard = useCallback(() => {
    setError('');
    setWebViewOpen(true);
  }, []);

  const closeDashboard = useCallback(() => {
    setWebViewOpen(false);
  }, []);

  const openMeuPluggy = useCallback(() => void Linking.openURL(MEU_PLUGGY_URL), []);

  const changeKeys = useCallback(async () => {
    clearPendingTimer();
    await store.clearKeys();
    setClientId('');
    setClientSecret('');
    setValidated(false);
    setAuthStatus('idle');
    setValidationNote('');
    setStep2Status('idle');
    setFoundBanks([]);
    setSyncPhase('idle');
    setShortcut(false);
    goTo('1');
  }, [clearPendingTimer, goTo]);

  const showTutorial = useCallback(() => {
    setShortcut(false);
    goTo('tutorial');
  }, [goTo]);

  const resetSyncView = useCallback(() => {
    setSyncPhase('idle');
    setError('');
  }, []);

  return {
    ready,
    step,
    shortcut,
    clientId,
    clientSecret,
    validated,
    authStatus,
    validationNote,
    busy,
    error,
    clipboardUuids,
    clipboardSuggestion: clipboardUuids[0] ?? '',
    webViewOpen,
    step2Status,
    foundBanks,
    syncPhase,
    syncCompletedCount,
    syncedBanks,
    finishTutorial,
    paste,
    applySuggestion,
    updateField,
    validateKeys,
    handleWebViewCapture,
    confirmBanks,
    syncNow,
    openDashboard,
    closeDashboard,
    openMeuPluggy,
    changeKeys,
    showTutorial,
    resetSyncView,
  };
}
