import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { darkColors, lightColors, tabularNumbers, tokens, v5Radii } from '../tokens';
import {
  MOTION_CURVES,
  MOTION_DURATIONS,
  PRESS_SCALE,
  SCREEN_TRANSITIONS,
  VFX_COLORS,
  computeCountUpValue,
  formatCountUpValue,
  getStaggerDelayMs,
} from '../motion';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MOBILE_SRC = path.resolve(__dirname, '../..');

describe('Design System v5 & Global vito-motion (Mobile)', () => {
  test('Onda V1: paletas Light e Dark seguem exatamente o protótipo v5', () => {
    assert.equal(lightColors.page, '#efefef');
    assert.equal(lightColors.bg, '#ffffff');
    assert.equal(lightColors.surf, '#f4f4f4');
    assert.equal(lightColors.btn, '#ececec');
    assert.equal(lightColors.ink, '#0a0a0a');
    assert.equal(lightColors.muted, '#595959');
    assert.equal(lightColors.line, '#e6e6e6');

    assert.equal(darkColors.page, '#000000');
    assert.equal(darkColors.bg, '#0a0a0a');
    assert.equal(darkColors.surf, '#171717');
    assert.equal(darkColors.btn, '#262626');
    assert.equal(darkColors.ink, '#f5f5f5');
    assert.equal(darkColors.muted, '#8c8c8c');
    assert.equal(darkColors.line, '#262626');

    assert.equal(lightColors.blue, '#0a7cff');
    assert.equal(darkColors.blue, '#3b93ff');
    assert.equal(lightColors.red, '#ff2d46');
    assert.equal(darkColors.red, '#ff5468');
    assert.equal(lightColors.purple, '#ff2fa0');
    assert.equal(darkColors.purple, '#ff55b0');
    assert.equal(lightColors.acc, '#0aa55c');
    assert.equal(darkColors.acc, '#2dd17f');
    assert.equal(lightColors.orange, '#f08300');
    assert.equal(darkColors.orange, '#ffa733');
    assert.equal(lightColors.teal, '#0aa5b5');
    assert.equal(darkColors.teal, '#3cc4d0');
    assert.equal(lightColors.fin, '#d98a00');
    assert.equal(darkColors.fin, '#ffb938');
  });

  test('Onda V1: Geist + Geist Mono + tabular-nums + raios v5 configurados', () => {
    assert.equal(tokens.typography.family.sans, 'Geist');
    assert.equal(tokens.typography.family.mono, 'Geist Mono');
    assert.deepEqual(tabularNumbers.fontVariant, ['tabular-nums']);
    assert.equal(v5Radii.card, 22);
    assert.equal(v5Radii.sheet, 28);
    assert.equal(v5Radii.dock, 40);
    assert.equal(v5Radii.pill, 999);
  });

  test('vito-motion: curvas, stagger 45ms, count-up 950ms, press 0.965, transições e .vfx', () => {
    assert.deepEqual(MOTION_CURVES.std, [0.2, 0.8, 0.2, 1]);
    assert.deepEqual(MOTION_CURVES.q, [0.22, 1, 0.36, 1]);
    assert.equal(MOTION_DURATIONS.staggerStep, 45);
    assert.equal(MOTION_DURATIONS.countUp, 950);
    assert.equal(MOTION_DURATIONS.themeReveal, 720);
    assert.equal(PRESS_SCALE, 0.965);
    assert.equal(VFX_COLORS.length, 5);

    assert.equal(SCREEN_TRANSITIONS.tab.enterMs, 360);
    assert.equal(SCREEN_TRANSITIONS.tab.leaveMs, 170);
    assert.equal(SCREEN_TRANSITIONS.push.enterMs, 440);
    assert.equal(SCREEN_TRANSITIONS.push.leaveMs, 300);
    assert.equal(SCREEN_TRANSITIONS.pop.enterMs, 400);
    assert.equal(SCREEN_TRANSITIONS.pop.leaveMs, 300);

    assert.equal(getStaggerDelayMs(0), 70);
    assert.equal(getStaggerDelayMs(1), 115);
    assert.equal(getStaggerDelayMs(2), 160);

    assert.equal(computeCountUpValue(1000, 0), 0);
    assert.ok(computeCountUpValue(1000, 0.5) > 900);
    assert.equal(computeCountUpValue(1000, 1), 1000);
    assert.equal(formatCountUpValue(3420, 2, 'pt-BR'), '3.420,00');
  });

  test('Onda V2: FloatingTabBar tem exatamente 5 abas e Header/Chat v5 estão limpos', () => {
    const dockSrc = fs.readFileSync(
      path.join(MOBILE_SRC, 'components/common/FloatingTabBar.tsx'),
      'utf8'
    );
    const headerSrc = fs.readFileSync(
      path.join(MOBILE_SRC, 'components/common/Header.tsx'),
      'utf8'
    );
    const inputDockSrc = fs.readFileSync(
      path.join(MOBILE_SRC, 'features/chat/components/ChatInputDock.tsx'),
      'utf8'
    );
    const chatScreenSrc = fs.readFileSync(
      path.join(MOBILE_SRC, 'features/chat/screens/ChatScreen.tsx'),
      'utf8'
    );

    assert.ok(dockSrc.includes("'Vito'") && dockSrc.includes("'Agenda'") && dockSrc.includes("'Tarefas'") && dockSrc.includes("'Finanças'") && dockSrc.includes("'Bots'"));
    assert.equal(dockSrc.includes('Booking'), false);
    assert.equal(dockSrc.includes('Perfil'), false);

    assert.ok(headerSrc.includes('open-book'));
    assert.ok(headerSrc.includes('c-notifs'));
    assert.ok(headerSrc.includes('c-new'));
    assert.ok(headerSrc.includes('go-perfil'));

    assert.equal(inputDockSrc.includes('Foco em'), false);
    assert.ok(inputDockSrc.includes('c-attach'));
    assert.ok(inputDockSrc.includes('c-model'));
    assert.ok(inputDockSrc.includes('c-mic'));
    assert.ok(inputDockSrc.includes('c-send'));
    assert.ok(inputDockSrc.includes('c-voice'));

    assert.equal(chatScreenSrc.includes('ChatQuickChips'), false);
    assert.ok(chatScreenSrc.includes('ChatAttachmentSheet'));
  });
});
