import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { getBotsHeaderSubtitle, getAllowedPolicyOptions } from '../botHelpers';
import { MASCOT_PRESETS, getBotAnimState, resolveSkin } from '../mascotPalettes';
import { BotsApi } from '../../../services/api/bots/botsApi';
import { ApiClient } from '../../../services/api/client';
import { Bot } from '../../../types/bot';

function makeBot(overrides: Partial<Bot> = {}): Bot {
  return {
    id: 'bot-1',
    title: 'Teste',
    goal: 'Testar',
    category: 'Geral',
    status: 'active',
    quiet_only_on_change: true,
    ...overrides,
  };
}

describe('Bots Desktop UI (Plano 04)', () => {
  it('AC-13: nenhuma string visível em desktop/src/components/ deve conter "radar" ou "radares"', () => {
    const componentsDir = path.resolve(__dirname, '../..');
    const violations: Array<{ file: string; line: number; text: string }> = [];

    function scan(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== '__tests__') scan(full);
        } else if (entry.name.endsWith('.tsx')) {
          const lines = fs.readFileSync(full, 'utf8').split('\n');
          lines.forEach((line, idx) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('import ')) {
              return;
            }
            // Remove symbol identifiers like RadarIcon / radarAlerts / buildRadarChatPrompt
            const cleaned = line
              .replace(/RadarIcon/g, '')
              .replace(/radarReportUtils/g, '')
              .replace(/buildRadarChatPrompt/g, '')
              .replace(/radarAlerts/g, '')
              .replace(/setRadarAlerts/g, '');
            if (/\bradares?\b/i.test(cleaned)) {
              violations.push({
                file: path.relative(componentsDir, full),
                line: idx + 1,
                text: trimmed,
              });
            }
          });
        }
      }
    }

    scan(componentsDir);
    expect(violations).toEqual([]);
  });

  it('AC-14: subtítulo dinâmico reflete quantidade de ações aguardando aprovação', () => {
    expect(getBotsHeaderSubtitle([])).toBe('Mini assistentes, cada um com uma função só');
    expect(getBotsHeaderSubtitle([makeBot()])).toBe('Mini assistentes, cada um com uma função só');

    const withOne = [
      makeBot({
        pending: [{ confirmation_id: 'c1', action_key: 'evt', label: 'Criar evento', summary: 'Hoje' }],
      }),
    ];
    expect(getBotsHeaderSubtitle(withOne)).toBe('1 ação aguarda sua aprovação');

    const withTwo = [
      makeBot({
        id: 'b1',
        pending: [{ confirmation_id: 'c1', action_key: 'evt', label: 'Criar evento', summary: 'Hoje' }],
      }),
      makeBot({
        id: 'b2',
        pending: [{ confirmation_id: 'c2', action_key: 'wasend', label: 'Enviar mensagem', summary: 'Oi' }],
      }),
    ];
    expect(getBotsHeaderSubtitle(withTwo)).toBe('2 ações aguardam sua aprovação');
  });

  it('AC-03: ações ALWAYS (wasend) nunca permitem política auto nem always_allow', async () => {
    const wasendOpts = getAllowedPolicyOptions('wasend');
    expect(wasendOpts.map((o) => o.value)).toEqual(['ask', 'off']);

    const searchOpts = getAllowedPolicyOptions('search');
    expect(searchOpts.map((o) => o.value)).toEqual(['auto', 'ask', 'off']);

    const api = new BotsApi(new ApiClient());
    await expect(api.updateBotAction('b1', 'wasend', 'auto')).rejects.toThrow();
    await expect(api.resolvePending('b1', 'c1', 'always_allow', 'wasend')).rejects.toThrow();
  });

  it('Mascote: 10 presets resolvem cores e getBotAnimState reflete estado do bot', () => {
    expect(MASCOT_PRESETS).toHaveLength(10);
    for (const preset of MASCOT_PRESETS) {
      const light = resolveSkin(preset, false);
      const dark = resolveSkin(preset, true);
      expect(light.fill).toMatch(/^#[0-9a-f]{6}$/i);
      expect(dark.stroke).toMatch(/^#[0-9a-f]{6}$/i);
    }

    expect(getBotAnimState(makeBot({ status: 'paused' }))).toBe('sleeping');
    expect(getBotAnimState(makeBot(), { busy: true })).toBe('thinking');
    expect(getBotAnimState(makeBot(), { happy: true })).toBe('happy');
    expect(
      getBotAnimState(
        makeBot({
          pending: [{ confirmation_id: 'c1', action_key: 'evt', label: 'Evento', summary: 'Novo' }],
        })
      )
    ).toBe('surprised');
    expect(getBotAnimState(makeBot())).toBe('idle');
  });
});
