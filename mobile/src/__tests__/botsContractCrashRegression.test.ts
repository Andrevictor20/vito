import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BotsApi } from '../features/bots/services/botsApi';
import type { ApiClient } from '../services/api/client';
import { extractAppKey, normalizeBot, normalizeBotApps } from '../features/bots/utils/botsNormalizers';

const MOBILE_SRC = path.resolve(__dirname, '..');

describe('Regressão de Contrato e Crash em Bots (BotCard / AddActionSheet / MainTabs)', () => {
  test('BotsApi.listBots normaliza payload real do backend sem quebrar BotCard', async () => {
    const backendBotPayload = {
      id: 'bot-real-1',
      title: 'Monitor Dólar',
      goal: 'Avisar quando dólar cair',
      category: 'Finanças',
      status: 'active',
      frequency: 'daily_morning',
      scheduled_time: '08:30',
      quiet_only_on_change: true,
      apps: [{ app_key: 'vito', name: 'Vito', connected: true }],
      actions: [
        {
          action_key: 'notify',
          app_key: 'vito',
          label: 'Avisar você',
          is_write: false,
          always_ask: false,
          policy: 'auto',
          app_connected: true,
        },
      ],
      skills: [],
      pending: [
        {
          confirmation_id: 'conf-1',
          action_key: 'evt',
          app_key: 'gcal',
          label: 'Criar evento',
          summary: 'Reunião amanhã',
          always_ask: false,
          created_at: '2026-11-26T10:00:00Z',
        },
      ],
      last: {
        summary: 'Tudo certo hoje',
        at: '2026-11-26T10:00:00Z',
        status: 'ok',
      },
      logs: [
        {
          id: 'log-1',
          bot_id: 'bot-real-1',
          triggered_at: '2026-11-26T10:00:00Z',
          message: 'Execução ok',
          status: 'ok',
          report: {
            summary: 'Verificado sem mudanças',
            verified: ['Dólar em R$ 5,40'],
            did: [],
            waiting: [],
            cant: [],
          },
        },
      ],
    };

    const client = {
      request: async () => ({ bots: [backendBotPayload] }),
    } as unknown as ApiClient;

    const api = new BotsApi(client);
    const list = await api.listBots();
    assert.equal(list.length, 1);
    const bot = list[0];

    assert.deepEqual(bot.apps, ['vito']);
    assert.equal(extractAppKey({ app_key: 'vito' }), 'vito');
    assert.equal(extractAppKey('web'), 'web');
    assert.equal(bot.quiet, true);
    assert.equal(bot.last_line, 'Tudo certo hoje');
    assert.equal(bot.last_run_at, '2026-11-26T10:00:00Z');
    assert.equal(bot.pending[0].title, 'Criar evento');
    assert.equal(bot.runs?.length, 1);
    assert.deepEqual(bot.runs?.[0].verified, ['Dólar em R$ 5,40']);

    const normalizedDirect = normalizeBot({
      id: 'b2',
      title: 'Minimal',
      goal: 'G',
      category: 'Geral',
      status: 'active',
      apps: [{ app_key: 'web' }, null, 'fin'],
    });
    assert.deepEqual(normalizedDirect.apps, ['web', 'fin']);
    assert.deepEqual(normalizedDirect.actions, []);
    assert.deepEqual(normalizedDirect.skills, []);
  });

  test('BotsApi.getApps garante array actions válido mesmo quando backend omite o campo', async () => {
    const client = {
      request: async () => ({
        apps: [
          { app_key: 'vito', name: 'Vito', connected: true },
          { app_key: 'custom_app', name: 'Custom', connected: false },
        ],
      }),
    } as unknown as ApiClient;

    const api = new BotsApi(client);
    const apps = await api.getApps();
    assert.equal(apps.length, 2);
    assert.equal(Array.isArray(apps[0].actions), true);
    assert.ok(apps[0].actions.length > 0, 'vito deve receber fallback de actions');
    assert.equal(Array.isArray(apps[1].actions), true);
    assert.deepEqual(apps[1].actions, []);

    const normalized = normalizeBotApps([{ app_key: 'web', name: 'Web', connected: true }]);
    assert.equal(Array.isArray(normalized[0].actions), true);
    assert.ok(normalized[0].actions.length > 0);
  });

  test('MainTabs isola abas do AdaptivePager com ErrorBoundary', () => {
    const mainTabs = fs.readFileSync(path.join(MOBILE_SRC, 'navigation/MainTabs.tsx'), 'utf8');
    assert.equal(mainTabs.includes("ErrorBoundary"), true, 'MainTabs deve importar ErrorBoundary');
    const matches = mainTabs.match(/<ErrorBoundary\b/g) ?? [];
    assert.ok(matches.length >= 5, `MainTabs deve isolar todas as 5 abas com ErrorBoundary (encontrados: ${matches.length})`);
  });
});
