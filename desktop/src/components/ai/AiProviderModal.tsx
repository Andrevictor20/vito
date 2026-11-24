import React, { useState, useEffect } from 'react';
import { X, KeyRound, Cpu, RefreshCw, CheckCircle2, Trash2, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { AiModelItem, AiProviderInfo, AiProviderKey } from '../../types';
import { TestAiProviderResponse } from '../../services/api/bots/aiProvidersApi';
import { Button } from '../ui/Button';
import { AiProviderLogo } from './AiProviderLogo';
import {
  AI_PROVIDERS_CATALOG,
  formatKeyMask,
  validateProviderCredentials,
} from './aiProvidersCatalog';

interface AiProviderModalProps {
  provider: AiProviderInfo | null;
  onClose: () => void;
  onConnect: (
    providerKey: AiProviderKey,
    input: { api_key: string; base_url?: string }
  ) => Promise<AiProviderInfo>;
  onTest: (providerKey: AiProviderKey) => Promise<TestAiProviderResponse>;
  onRemove: (providerKey: AiProviderKey) => Promise<void>;
  onRefreshModels: (providerKey: AiProviderKey) => Promise<AiModelItem[]>;
}

export const AiProviderModal: React.FC<AiProviderModalProps> = ({
  provider,
  onClose,
  onConnect,
  onTest,
  onRemove,
  onRefreshModels,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [removing, setRemoving] = useState(false);
  const [refreshingModels, setRefreshingModels] = useState(false);

  useEffect(() => {
    setApiKey('');
    setBaseUrl(provider?.base_url || '');
    setShowKey(false);
    setErrorMsg('');
    setSaving(false);
    setTesting(false);
    setTestResult('idle');
    setRemoving(false);
    setRefreshingModels(false);
  }, [provider?.provider_key]);

  if (!provider) return null;

  const meta = AI_PROVIDERS_CATALOG[provider.provider_key];
  const isFixed = Boolean(provider.fixed || provider.provider_key === 'srv');
  const isOk = provider.status === 'ok' && !isFixed;
  const isInvalid = provider.status === 'invalid' && !isFixed;
  const isConnected = isOk || isInvalid;
  const models = provider.models && provider.models.length > 0 ? provider.models : meta.defaultModels;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateProviderCredentials(
      provider.provider_key,
      apiKey,
      baseUrl
    );
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setErrorMsg('');
    setSaving(true);
    try {
      await onConnect(provider.provider_key, {
        api_key: apiKey.trim(),
        ...(meta.requiresUrl ? { base_url: baseUrl.trim() } : {}),
      });
      setApiKey('');
      setBaseUrl('');
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : '';
      if (raw.includes('401') || raw.includes('403') || raw.toLowerCase().includes('recusou')) {
        setErrorMsg(`O ${meta.name} recusou esta chave. Confira se ela está ativa.`);
      } else {
        setErrorMsg(raw || `Não foi possível verificar a chave do ${meta.name}.`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult('idle');
    setErrorMsg('');
    try {
      const res = await onTest(provider.provider_key);
      if (res.status === 'invalid' || res.valid === false) {
        setTestResult('invalid');
        setErrorMsg(
          res.message || `O ${meta.name} recusou esta chave. Confira se ela está ativa.`
        );
      } else {
        setTestResult('valid');
      }
    } catch (err: unknown) {
      setTestResult('invalid');
      setErrorMsg(
        err instanceof Error ? err.message : `Falha ao testar a chave do ${meta.name}.`
      );
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    setErrorMsg('');
    try {
      await onRemove(provider.provider_key);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao remover chave.');
    } finally {
      setRemoving(false);
    }
  };

  const handleRefreshModels = async () => {
    setRefreshingModels(true);
    try {
      await onRefreshModels(provider.provider_key);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao atualizar lista de modelos.');
    } finally {
      setRefreshingModels(false);
    }
  };

  const subtitle = isFixed
    ? `${meta.company} · sem chave`
    : isOk
    ? `Conectado · chave ${formatKeyMask(provider.key_last4)}`
    : isInvalid
    ? `Chave inválida · ${formatKeyMask(provider.key_last4)}`
    : meta.company;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--bg)] text-[var(--ink)] rounded-[24px] border border-[var(--line)] shadow-2xl flex flex-col max-h-[88vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={meta.name}
      >
        <div className="p-5 border-b border-[var(--line)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <AiProviderLogo providerKey={provider.provider_key} size={44} />
            <div className="min-w-0">
              <h3 className="text-base font-bold text-[var(--ink)] truncate">{meta.name}</h3>
              <p className="text-xs text-[var(--muted)] truncate">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-full text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surf)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {isFixed && (
            <div className="p-4 rounded-2xl bg-[var(--surf)] border border-[var(--line)] text-sm text-[var(--ink)] leading-relaxed">
              O Vito Auto usa a cota do servidor e escolhe o modelo certo para cada tarefa. Não precisa de chave.
            </div>
          )}

          {!isFixed && isConnected && (
            <>
              <div
                className={`p-3.5 rounded-2xl border flex items-center gap-3 ${
                  isInvalid
                    ? 'bg-[var(--red-bg)] border-[var(--red)]/30 text-[var(--red)]'
                    : 'bg-[var(--surf)] border-[var(--line)] text-[var(--ink)]'
                }`}
              >
                {isInvalid ? <AlertTriangle size={18} /> : <KeyRound size={18} className="text-[var(--acc)]" />}
                <div className="min-w-0 flex-1">
                  <b className="text-sm block">Chave {formatKeyMask(provider.key_last4)}</b>
                  <span className="text-xs opacity-80 block">
                    {isInvalid
                      ? 'Esta chave foi recusada pelo provedor. Atualize ou remova.'
                      : 'Verificada agora · criptografada no servidor'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                    Modelos disponíveis
                  </span>
                  <button
                    type="button"
                    onClick={handleRefreshModels}
                    disabled={refreshingModels}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
                  >
                    <RefreshCw size={12} className={refreshingModels ? 'animate-spin' : ''} />
                    <span>Atualizar</span>
                  </button>
                </div>

                <div className="rounded-2xl border border-[var(--line)] bg-[var(--surf)] divide-y divide-[var(--line)]">
                  {models.map((model) => (
                    <div key={model.id} className="px-3.5 py-2.5 flex items-center gap-3">
                      <Cpu size={15} className="text-[var(--muted)] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <b className="text-sm text-[var(--ink)] block truncate">{model.name}</b>
                        <span className="text-xs text-[var(--muted)] block truncate">
                          {model.note || 'Modelo disponível'}
                          {model.reasoning ? ' · raciocínio' : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {!isFixed && (!isConnected || isInvalid) && (
            <form onSubmit={handleSave} className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] block">
                {meta.requiresUrl ? 'Endereço e chave' : 'Chave de API'}
              </label>

              {meta.requiresUrl && (
                <input
                  type="url"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://seu-endpoint.com/v1"
                  autoComplete="off"
                  aria-label="Endereço do endpoint"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surf)] border border-[var(--line)] text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--ink)]"
                />
              )}

              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={meta.placeholder}
                  autoComplete="off"
                  aria-label="Chave de API"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-[var(--surf)] border border-[var(--line)] text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--ink)] font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((prev) => !prev)}
                  aria-label={showKey ? 'Ocultar chave' : 'Mostrar chave'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--muted)] hover:text-[var(--ink)]"
                >
                  {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {errorMsg && (
                <p role="alert" className="text-xs font-medium text-[var(--red)]">
                  {errorMsg}
                </p>
              )}

              <p className="text-xs text-[var(--muted)] leading-relaxed">{meta.help}</p>

              <div className="pt-1 flex items-center gap-2">
                <Button type="submit" variant="pri" size="md" loading={saving} className="flex-1">
                  {saving ? 'Verificando…' : 'Salvar e verificar'}
                </Button>
              </div>
            </form>
          )}

          {!isFixed && isConnected && (
            <>
              {errorMsg && !isInvalid && (
                <p role="alert" className="text-xs font-medium text-[var(--red)]">
                  {errorMsg}
                </p>
              )}
              <div className="flex items-center gap-2.5 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={handleTest}
                  disabled={testing || removing}
                  className="flex-1"
                  leftIcon={testResult === 'valid' ? <CheckCircle2 size={15} className="text-[var(--acc)]" /> : undefined}
                >
                  {testing ? 'Testando…' : testResult === 'valid' ? 'Chave válida ✓' : 'Testar chave'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={handleRemove}
                  disabled={removing || testing}
                  className="text-[var(--red)] border-[var(--red)]/40 hover:bg-[var(--red-bg)]"
                  leftIcon={<Trash2 size={14} />}
                >
                  {removing ? 'Removendo…' : 'Remover chave'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
