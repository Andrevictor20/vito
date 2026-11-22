import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import * as fs from 'fs';
import * as path from 'path';
import {
  AI_PROVIDER_ORDER,
  buildSelectableGroups,
  formatProvidersSummary,
  mergeProvidersWithCatalog,
  resolveModelRef,
  validateProviderCredentials,
} from '../aiProvidersCatalog';
import { AiProviderLogo } from '../AiProviderLogo';
import { AiProviderModal } from '../AiProviderModal';
import { ModelPickerModal } from '../ModelPickerModal';
import { ChatInputDock } from '../../chat/ChatInputDock';
import { ChatMessageActionBar } from '../../chat/ChatMessageActionBar';
import type { AiProviderInfo } from '../../../types';

describe('Validação & Catálogo de Provedores IA (Plano 03 §2)', () => {
  it('rejeita campo vazio com mensagem exata', () => {
    expect(validateProviderCredentials('anthropic', '   ')).toBe('Preencha a chave.');
    expect(validateProviderCredentials('custom', '', '')).toBe(
      'Preencha o endereço e a chave.'
    );
    expect(validateProviderCredentials('custom', 'abc', '')).toBe(
      'Preencha o endereço e a chave.'
    );
  });

  it('rejeita URL sem http:// ou https:// no endpoint customizado', () => {
    expect(validateProviderCredentials('custom', 'token', '192.168.0.20:11434/v1')).toBe(
      'O endereço precisa começar com http:// ou https://.'
    );
    expect(
      validateProviderCredentials('custom', 'token', 'http://192.168.0.20:11434/v1')
    ).toBeNull();
    expect(
      validateProviderCredentials('custom', 'token', 'https://gateway.local/v1')
    ).toBeNull();
  });

  it('AI-01: rejeita prefixo errado com mensagem exata do provedor', () => {
    expect(validateProviderCredentials('anthropic', 'gsk_123456')).toBe(
      'Esta chave não parece ser do Claude. Ela deve começar com sk-ant-.'
    );
    expect(validateProviderCredentials('google', 'sk-123456')).toBe(
      'Esta chave não parece ser do Gemini. Ela deve começar com AIza.'
    );
    expect(validateProviderCredentials('groq', 'AIza123')).toBe(
      'Esta chave não parece ser do Groq. Ela deve começar com gsk_.'
    );
    expect(validateProviderCredentials('openrouter', 'sk-1234')).toBe(
      'Esta chave não parece ser do OpenRouter. Ela deve começar com sk-or-.'
    );
  });

  it('rejeita chaves sk-ant- e sk-or- na OpenAI como chave de outro provedor', () => {
    expect(validateProviderCredentials('openai', 'sk-ant-1234')).toBe(
      'Esta chave parece ser de outro provedor.'
    );
    expect(validateProviderCredentials('openai', 'sk-or-v1-1234')).toBe(
      'Esta chave parece ser de outro provedor.'
    );
    expect(validateProviderCredentials('openai', 'sk-proj-valid')).toBeNull();
  });

  it('formata resumo Só o servidor vs Servidor + N próprio(s)', () => {
    const onlyServer = mergeProvidersWithCatalog([]);
    expect(formatProvidersSummary(onlyServer)).toBe('Só o servidor');

    const withOneOwn = mergeProvidersWithCatalog([
      {
        provider_key: 'google',
        name: 'Gemini',
        company: 'Google',
        status: 'ok',
        key_last4: '9xQ2',
      },
    ]);
    expect(formatProvidersSummary(withOneOwn)).toBe('Servidor + 1 próprio');

    const withInvalid = mergeProvidersWithCatalog([
      {
        provider_key: 'google',
        name: 'Gemini',
        company: 'Google',
        status: 'invalid',
        key_last4: '9xQ2',
      },
    ]);
    expect(formatProvidersSummary(withInvalid)).toBe('Só o servidor');
  });

  it('resolveModelRef faz fallback quando provedor é removido ou inválido', () => {
    const providers = mergeProvidersWithCatalog([
      {
        provider_key: 'anthropic',
        name: 'Claude',
        company: 'Anthropic',
        status: 'invalid',
        key_last4: '1234',
      },
    ]);
    const groups = buildSelectableGroups(providers);
    expect(groups.map((g) => g.provider_key)).toEqual(['srv']);
    expect(resolveModelRef(['anthropic:sonnet'], groups)).toBe('srv:auto');
  });
});

describe('Renderização dos Componentes Desktop AI (Onda D & E)', () => {
  it('renderiza todos os 7 logos SVG de provedores', () => {
    for (const key of AI_PROVIDER_ORDER) {
      const html = renderToStaticMarkup(React.createElement(AiProviderLogo, { providerKey: key }));
      expect(html).toContain('<svg');
    }
  });

  it('renderiza estados do AiProviderModal (srv, não conectado, conectado)', () => {
    const noop = async () => ({} as AiProviderInfo);
    const noopTest = async () => ({ status: 'ok' });
    const noopVoid = async () => {};
    const noopModels = async () => [];

    const srvHtml = renderToStaticMarkup(
      React.createElement(AiProviderModal, {
        provider: {
          provider_key: 'srv',
          name: 'Servidor do Vito',
          company: 'Cota do servidor',
          status: 'ok',
          fixed: true,
        },
        onClose: () => {},
        onConnect: noop,
        onTest: noopTest,
        onRemove: noopVoid,
        onRefreshModels: noopModels,
      })
    );
    expect(srvHtml).toContain('O Vito Auto usa a cota do servidor');

    const unconnHtml = renderToStaticMarkup(
      React.createElement(AiProviderModal, {
        provider: {
          provider_key: 'anthropic',
          name: 'Claude',
          company: 'Anthropic',
          status: 'disconnected',
        },
        onClose: () => {},
        onConnect: noop,
        onTest: noopTest,
        onRemove: noopVoid,
        onRefreshModels: noopModels,
      })
    );
    expect(unconnHtml).toContain('Salvar e verificar');
    expect(unconnHtml).toContain('type="password"');

    const connHtml = renderToStaticMarkup(
      React.createElement(AiProviderModal, {
        provider: {
          provider_key: 'google',
          name: 'Gemini',
          company: 'Google',
          status: 'ok',
          key_last4: '9xQ2',
          models: [{ id: 'g36f', name: 'Gemini 3.6 Flash', note: 'Rápido', reasoning: true }],
        },
        onClose: () => {},
        onConnect: noop,
        onTest: noopTest,
        onRemove: noopVoid,
        onRefreshModels: noopModels,
      })
    );
    expect(connHtml).toContain('••••9xQ2');
    expect(connHtml).toContain('· raciocínio');
    expect(connHtml).toContain('Testar chave');
    expect(connHtml).toContain('Remover chave');
  });

  it('AI-09 & AI-12: ModelPickerModal filtra só provedores ok e exibe Raciocínio só quando reasoning=true', () => {
    const groups = [
      {
        provider_key: 'srv' as const,
        provider_name: 'Servidor do Vito',
        status: 'ok' as const,
        models: [{ id: 'auto', name: 'Vito Auto', note: 'Automático', reasoning: false }],
      },
      {
        provider_key: 'google' as const,
        provider_name: 'Gemini',
        status: 'ok' as const,
        models: [{ id: 'g36f', name: 'Gemini 3.6 Flash', note: 'Rápido', reasoning: true }],
      },
      {
        provider_key: 'anthropic' as const,
        provider_name: 'Claude',
        status: 'invalid' as const,
        models: [{ id: 'sonnet', name: 'Claude Sonnet 5.5', note: 'Equilibrado', reasoning: true }],
      },
    ];

    const withoutReasoningHtml = renderToStaticMarkup(
      React.createElement(ModelPickerModal, {
        isOpen: true,
        onClose: () => {},
        scope: 'Esta conversa',
        allowInherit: true,
        selectedModel: null,
        selectedEffort: 'auto',
        inheritedModel: 'srv:auto',
        groups,
        onSelectModel: () => {},
        onSelectEffort: () => {},
        onManageProviders: () => {},
      })
    );
    expect(withoutReasoningHtml).toContain('Padrão (Vito Auto)');
    expect(withoutReasoningHtml).toContain('Gemini 3.6 Flash');
    expect(withoutReasoningHtml).not.toContain('Claude Sonnet 5.5');
    expect(withoutReasoningHtml).not.toContain('Raciocínio');
    expect(withoutReasoningHtml).toContain('Gerenciar provedores');

    const withReasoningHtml = renderToStaticMarkup(
      React.createElement(ModelPickerModal, {
        isOpen: true,
        onClose: () => {},
        scope: 'Esta conversa',
        allowInherit: true,
        selectedModel: 'google:g36f',
        selectedEffort: 'high',
        inheritedModel: 'srv:auto',
        groups,
        onSelectModel: () => {},
        onSelectEffort: () => {},
        onManageProviders: () => {},
      })
    );
    expect(withReasoningHtml).toContain('Raciocínio');
    expect(withReasoningHtml).toContain('Alto');
  });

  it('ChatInputDock exibe pill #c-model e ChatMessageActionBar exibe via <modelo>', () => {
    const dockHtml = renderToStaticMarkup(
      React.createElement(ChatInputDock, {
        onSendMessage: () => {},
        loading: false,
        modelName: 'Gemini 3.6 Flash',
        modelColor: 'var(--blue)',
      })
    );
    expect(dockHtml).toContain('id="c-model"');
    expect(dockHtml).toContain('Gemini 3.6 Flash');
    expect(dockHtml).not.toContain('Foco em');

    const barHtml = renderToStaticMarkup(
      React.createElement(ChatMessageActionBar, {
        messageText: 'Olá',
        modelUsed: 'Claude Sonnet 5.5',
      })
    );
    expect(barHtml).toContain('via Claude Sonnet 5.5');
  });

  it('segurança: componentes AI nunca persistem chave em storage nem leem clipboard', () => {
    const aiDir = path.resolve(__dirname, '..');
    const files = fs.readdirSync(aiDir).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(aiDir, file), 'utf8');
      expect(content).not.toContain('localStorage');
      expect(content).not.toContain('sessionStorage');
      expect(content).not.toContain('clipboard.readText');
    }
  });
});
