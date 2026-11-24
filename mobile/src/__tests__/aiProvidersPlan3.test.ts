import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProviderCredentials } from '../services/ai/aiProviderValidation';
import {
  filterConnectedGroups,
  mergeProvidersWithCatalog,
  resolveEffectiveModel,
  summarizeOwnProviders,
  formatModelDisplayName,
  getProviderSheetMode,
  getPickerViewModel,
  resolveSessionModelPref,
} from '../services/ai/aiProviderCatalog';
import { buildAssistantMessage } from '../features/chat/utils/chatMessageBuilder';
import type { ModelProviderGroup } from '../types/aiProviders';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Plano 03 — Provedores de IA BYOK & Seletor de Modelo (Ondas D & E)', () => {
  it('AI-01: valida prefixos, URL custom e mensagens exatas do protótipo', () => {
    // Campo vazio
    assert.deepEqual(validateProviderCredentials('anthropic', '   '), {
      valid: false,
      error: 'Preencha a chave.',
    });
    assert.deepEqual(validateProviderCredentials('custom', '', ''), {
      valid: false,
      error: 'Preencha o endereço e a chave.',
    });

    // URL custom sem esquema
    assert.deepEqual(validateProviderCredentials('custom', 'tok', '192.168.0.20:11434/v1'), {
      valid: false,
      error: 'O endereço precisa começar com http:// ou https://.',
    });
    assert.deepEqual(validateProviderCredentials('custom', 'tok', 'http://192.168.0.20:11434/v1'), {
      valid: true,
    });

    // Chave de outro provedor em Claude (AI-01)
    assert.deepEqual(validateProviderCredentials('anthropic', 'gsk_123456'), {
      valid: false,
      error: 'Esta chave não parece ser do Claude. Ela deve começar com sk-ant-.',
    });

    // OpenAI rejeitando sk-ant- e sk-or-
    assert.deepEqual(validateProviderCredentials('openai', 'sk-ant-abc'), {
      valid: false,
      error: 'Esta chave parece ser de outro provedor.',
    });
    assert.deepEqual(validateProviderCredentials('openai', 'sk-or-abc'), {
      valid: false,
      error: 'Esta chave parece ser de outro provedor.',
    });
    assert.deepEqual(validateProviderCredentials('openai', 'sk-proj-123456'), {
      valid: true,
    });
  });

  it('Onda D: helpers da sheet e resumo do Perfil refletem estados conectado/desconectado/inválido', () => {
    const merged = mergeProvidersWithCatalog([
      {
        provider_key: 'google',
        status: 'ok',
        key_last4: '9xQ2',
        model_count: 2,
      },
      {
        provider_key: 'anthropic',
        status: 'invalid',
        key_last4: '44zz',
      },
    ]);

    assert.equal(summarizeOwnProviders(merged), 'Servidor + 1 próprio');
    assert.equal(summarizeOwnProviders(mergeProvidersWithCatalog([])), 'Só o servidor');

    const srv = merged.find((p) => p.provider_key === 'srv')!;
    const google = merged.find((p) => p.provider_key === 'google')!;
    const openai = merged.find((p) => p.provider_key === 'openai')!;
    const anthropic = merged.find((p) => p.provider_key === 'anthropic')!;

    assert.equal(getProviderSheetMode(srv), 'srv');
    assert.equal(getProviderSheetMode(google), 'connected');
    assert.equal(getProviderSheetMode(anthropic), 'connected');
    assert.equal(getProviderSheetMode(openai), 'unconnected');
  });

  it('AI-09 & AI-12: ModelPickerSheet exibe apenas provedores ok e mostra Raciocínio só quando reasoning=true', () => {
    const groups: ModelProviderGroup[] = [
      {
        provider_key: 'srv',
        name: 'Servidor do Vito',
        status: 'ok',
        models: [
          {
            id: 'auto',
            name: 'Vito Auto',
            supports_tools: true,
            supports_vision: true,
            reasoning: false,
            quality_tier: 3,
            max_context: 128000,
          },
        ],
      },
      {
        provider_key: 'anthropic',
        name: 'Claude',
        status: 'ok',
        models: [
          {
            id: 'haiku',
            name: 'Claude Haiku 5.5',
            supports_tools: true,
            supports_vision: true,
            reasoning: false,
            quality_tier: 2,
            max_context: 200000,
          },
          {
            id: 'sonnet',
            name: 'Claude Sonnet 5.5',
            supports_tools: true,
            supports_vision: true,
            reasoning: true,
            quality_tier: 3,
            max_context: 200000,
          },
        ],
      },
      {
        provider_key: 'openai',
        name: 'OpenAI',
        status: 'invalid',
        models: [
          {
            id: 'gpt-4.1',
            name: 'GPT-5.5',
            supports_tools: true,
            supports_vision: true,
            reasoning: true,
            quality_tier: 3,
            max_context: 128000,
          },
        ],
      },
    ];

    const okOnly = filterConnectedGroups(groups);
    assert.equal(okOnly.some((g) => g.provider_key === 'openai'), false);
    assert.equal(okOnly.some((g) => g.provider_key === 'anthropic'), true);

    // Modelo sem raciocínio (haiku) -> oculta bloco Raciocínio
    const vmNoReason = getPickerViewModel({
      groups,
      selectedModel: 'anthropic:haiku',
      inheritedModel: 'srv:auto',
      allowInherit: true,
    });
    assert.equal(vmNoReason.showReasoningSelector, false);

    // Modelo com raciocínio (sonnet) -> exibe bloco Raciocínio
    const vmReason = getPickerViewModel({
      groups,
      selectedModel: 'anthropic:sonnet',
      inheritedModel: 'srv:auto',
      allowInherit: true,
    });
    assert.equal(vmReason.showReasoningSelector, true);

    // Seleção apontando para provedor inválido cai para herdado/srv:auto
    const resolvedInvalid = resolveEffectiveModel(groups, 'openai:gpt-4.1', 'anthropic:sonnet');
    assert.equal(resolvedInvalid.value, 'anthropic:sonnet');
  });

  it('Onda E & Segurança: ChatMessage carrega modelUsed/byokWarning e nenhuma chave é salva em storage local', () => {
    const msg = buildAssistantMessage(
      'vito',
      {
        intent: 'general_chat',
        reply: 'Agenda confirmada.',
        telemetry: {
          model_used: 'anthropic:claude-sonnet-4-5',
          fallback_reason: 'byok_401',
        },
      },
      'Ok'
    );
    assert.equal(msg.modelUsed, 'claude-sonnet-4-5');
    assert.ok(msg.byokWarning?.includes('recusada'));
    assert.equal(formatModelDisplayName('srv:auto'), 'Vito Auto');

    const sheetSrc = fs.readFileSync(
      path.resolve(__dirname, '../features/profile/components/ai/AiProviderSheet.tsx'),
      'utf8'
    );
    assert.equal(sheetSrc.includes('SecureStore'), false);
    assert.equal(sheetSrc.includes('AsyncStorage'), false);
    assert.equal(sheetSrc.includes('Clipboard'), false);
    assert.ok(sheetSrc.includes('secureTextEntry'));
    assert.ok(sheetSrc.includes('accessibilityRole="alert"'));

    const dockSrc = fs.readFileSync(
      path.resolve(__dirname, '../features/chat/components/ChatInputDock.tsx'),
      'utf8'
    );
    assert.equal(dockSrc.includes('Foco em'), false);
    assert.ok(dockSrc.includes('onPressModel'));

    assert.deepEqual(
      resolveSessionModelPref({ model_pref: 'anthropic:claude-sonnet-4-5', effort_pref: 'high' }, 'auto'),
      { model: 'anthropic:claude-sonnet-4-5', effort: 'high' }
    );
    assert.deepEqual(resolveSessionModelPref(undefined, 'med'), {
      model: null,
      effort: 'med',
    });
  });
});
