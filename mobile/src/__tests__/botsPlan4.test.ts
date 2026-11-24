import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BotsApi } from '../features/bots/services/botsApi';
import type { ApiClient } from '../services/api/client';
import {
  ASK_VITO_CHIPS,
  DEFAULT_BOT_TEMPLATES,
  DEFAULT_SKILL_PACKAGES,
  MASCOT_PRESETS,
} from '../features/bots/data/botsCatalogFallback';
import {
  BOTS_DEFAULT_SUBTITLE,
  findRadarCopyViolations,
  getAvailablePoliciesForAction,
  getBotsHeaderSubtitle,
  isAlwaysAskAction,
  parseBotSkin,
  resolveBotAnimState,
} from '../features/bots/utils/botsHelpers';

const MOBILE_SRC = path.resolve(__dirname, '..');

describe('Plano 04 — Bots UI Mobile (AC-03, AC-13, AC-14 & §7)', () => {
  test('AC-13: zero ocorrências de "radar" ou "radares" nas telas e componentes de Bots', () => {
    const filesToCheck = [
      'features/bots/screens/BotsScreen.tsx',
      'components/common/FloatingTabBar.tsx',
      'components/common/Header.tsx',
      'features/bots/data/botsCatalogFallback.ts',
      'features/bots/data/botsSkillsFallback.ts',
      'features/bots/components/BotCard.tsx',
      'features/bots/components/BotsMyTab.tsx',
      'features/bots/components/BotsCatalogTab.tsx',
      'features/bots/components/BotDetailView.tsx',
      'features/bots/components/BotChatTab.tsx',
      'features/bots/components/BotDetailsTab.tsx',
      'features/bots/components/MascotStudioModal.tsx',
      'features/bots/components/TemplateSheet.tsx',
      'features/bots/components/BotCatalogSheets.tsx',
    ];

    for (const rel of filesToCheck) {
      const content = fs.readFileSync(path.join(MOBILE_SRC, rel), 'utf8');
      const violations = findRadarCopyViolations([content]);
      assert.equal(
        violations.length,
        0,
        `Arquivo ${rel} contém referência proibida a radar/radares`
      );
    }
  });

  test('AC-14: subtítulo dinâmico reflete pendências ou texto padrão', () => {
    assert.equal(getBotsHeaderSubtitle([]), BOTS_DEFAULT_SUBTITLE);
    assert.equal(
      getBotsHeaderSubtitle([
        {
          pending: [
            {
              confirmation_id: 'c1',
              action_key: 'evt',
              title: 'Criar evento',
              summary: 'Jogo amanhã',
              always_ask: false,
              created_at: '',
            },
          ],
        },
      ]),
      '1 ação aguarda sua aprovação'
    );
    assert.equal(
      getBotsHeaderSubtitle([
        {
          pending: [
            {
              confirmation_id: 'c1',
              action_key: 'evt',
              title: 'Criar evento',
              summary: 'Jogo',
              always_ask: false,
              created_at: '',
            },
          ],
        },
        {
          pending: [
            {
              confirmation_id: 'c2',
              action_key: 'wasend',
              title: 'Enviar WhatsApp',
              summary: 'Oi',
              always_ask: true,
              created_at: '',
            },
          ],
        },
      ]),
      '2 ações aguardam sua aprovação'
    );
  });

  test('AC-03: ações ALWAYS (wasend, share, publish, delete, pay) recusam auto e Sempre permitir', async () => {
    assert.equal(isAlwaysAskAction('wasend'), true);
    assert.equal(isAlwaysAskAction('evt', false), false);
    assert.deepEqual(getAvailablePoliciesForAction('wasend'), ['ask', 'off']);
    assert.deepEqual(getAvailablePoliciesForAction('evt'), ['auto', 'ask', 'off']);

    const client = {
      request: async () => ({}),
    } as unknown as ApiClient;
    const api = new BotsApi(client);

    await assert.rejects(() => api.updateBotAction('bot-1', 'wasend', 'auto'));
    await assert.rejects(() => api.resolvePending('bot-1', 'conf-1', 'always_allow', true));
  });

  test('Catálogo v5: 12 bots prontos, 9 habilidades, 10 presets de mascote e 4 chips Peça ao Vito', () => {
    assert.equal(DEFAULT_BOT_TEMPLATES.length, 12);
    assert.equal(DEFAULT_SKILL_PACKAGES.length, 9);
    assert.equal(MASCOT_PRESETS.length, 10);
    assert.equal(ASK_VITO_CHIPS.length, 4);
  });

  test('Skin e botAnimState resolvem corretamente para cards e studio', () => {
    const parsed = parseBotSkin(JSON.stringify(MASCOT_PRESETS[2].skin));
    assert.equal(parsed.fill, MASCOT_PRESETS[2].skin.fill);
    assert.equal(resolveBotAnimState({ status: 'paused', pending: [] }), 'sleeping');
    assert.equal(
      resolveBotAnimState({
        status: 'active',
        pending: [
          {
            confirmation_id: 'c1',
            action_key: 'evt',
            title: 'T',
            summary: 'S',
            always_ask: false,
            created_at: '',
          },
        ],
      }),
      'surprised'
    );
  });

  test('BotsApi cobre os endpoints REST de /api/v1/bots (§7)', async () => {
    const calls: { ep: string; method?: string }[] = [];
    const client = {
      request: async (ep: string, opt?: { method?: string }) => {
        calls.push({ ep, method: opt?.method });
        if (ep.includes('/catalog/templates')) return { templates: DEFAULT_BOT_TEMPLATES };
        if (ep.includes('/catalog/skills')) return { skills: DEFAULT_SKILL_PACKAGES };
        if (ep.includes('/bots/activity')) return { activity: [] };
        if (ep.includes('/bots/apps')) return { apps: [] };
        return [];
      },
    } as unknown as ApiClient;

    const api = new BotsApi(client);
    await api.listBots();
    await api.createBot({ template_key: 'flight_hunter' });
    await api.runBot('b1');
    await api.addBotSkill('b1', 'cmp');
    await api.removeBotSkill('b1', 'cmp');
    await api.upgradeBotSkill('b1', 'cmp');
    await api.resolvePending('b1', 'c1', 'allow_once', false);
    await api.updateBotModel('b1', { model_pref: 'srv:auto', effort_pref: 'auto' });
    await api.getActivity(20);
    await api.getCatalogTemplates();
    await api.getCatalogSkills();
    await api.suggestApp('Notion', 'Notas');

    assert.equal(calls[0].ep, '/api/v1/bots');
    assert.equal(calls[1].ep, '/api/v1/bots');
    assert.equal(calls[1].method, 'POST');
    assert.equal(calls[2].ep, '/api/v1/bots/b1/run');
    assert.equal(calls[3].ep, '/api/v1/bots/b1/skills');
    assert.equal(calls[4].ep, '/api/v1/bots/b1/skills/cmp');
    assert.equal(calls[5].ep, '/api/v1/bots/b1/skills/cmp/upgrade');
    assert.equal(calls[6].ep, '/api/v1/bots/b1/pending/c1/resolve');
    assert.equal(calls[7].ep, '/api/v1/bots/b1/model');
    assert.equal(calls[8].ep, '/api/v1/bots/activity?limit=20');
    assert.equal(calls[9].ep, '/api/v1/bots/catalog/templates');
    assert.equal(calls[10].ep, '/api/v1/bots/catalog/skills');
    assert.equal(calls[11].ep, '/api/v1/bots/apps/suggest');
  });
});
