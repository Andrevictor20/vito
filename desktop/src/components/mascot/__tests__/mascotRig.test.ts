import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  ALL_RANDOMIZER_PALETTES,
  EXTRA_RANDOM_PALETTES,
  HERO_TAP_SEQUENCE,
  MASCOT_PRESETS,
  MascotAnimationState,
  getBotAnimState,
  nextHeroAnimState,
  normalizeMascotState,
  parseBotSkin,
  pickRandomMascotPreset,
  resolveSkin,
  voiceStateToMascotAnim,
} from '../mascotPalettes';

const MASCOT_DIR = path.resolve(__dirname, '..');
const DESKTOP_COMPONENTS = path.resolve(__dirname, '../..');

describe('Plano 07 — Unified Mascot Rig Desktop', () => {
  it('MAS-01/MAS-05: 10 presets canônicos + 5 extras de sorteio resolvem Light/Dark auto corretamente', () => {
    expect(MASCOT_PRESETS).toHaveLength(10);
    expect(EXTRA_RANDOM_PALETTES).toHaveLength(5);
    expect(ALL_RANDOMIZER_PALETTES).toHaveLength(15);

    const vitoLight = resolveSkin(MASCOT_PRESETS[0], false);
    const vitoDark = resolveSkin(MASCOT_PRESETS[0], true);
    expect(vitoLight).toEqual({
      preset: 'vito',
      fill: '#FFFFFF',
      stroke: '#0A0A0A',
      eyes: '#0A0A0A',
      bowtie: '#0A0A0A',
      hat: '#0A0A0A',
      band: '#FFFFFF',
    });
    expect(vitoDark).toEqual({
      preset: 'vito',
      fill: '#171717',
      stroke: '#F5F5F5',
      eyes: '#F5F5F5',
      bowtie: '#F5F5F5',
      hat: '#F5F5F5',
      band: '#171717',
    });

    const randomPick = pickRandomMascotPreset('vito');
    expect(randomPick.id).not.toBe('vito');
  });

  it('MAS-02/MAS-03: mapeamento de botAnimState, voiceState e ciclo do Hero', () => {
    expect(getBotAnimState({ status: 'paused', pending: [] })).toBe('sleeping');
    expect(getBotAnimState({ status: 'active', pending: [] }, { busy: true })).toBe('thinking');
    expect(getBotAnimState({ status: 'active', pending: [] }, { happy: true })).toBe('happy');
    expect(
      getBotAnimState({
        status: 'active',
        pending: [{ confirmation_id: 'c1', action_key: 'evt', label: 'A', summary: 'B' }],
      })
    ).toBe('surprised');
    expect(getBotAnimState({ status: 'active', pending: [] })).toBe('idle');

    expect(voiceStateToMascotAnim('listen')).toBe('curious');
    expect(voiceStateToMascotAnim('think')).toBe('thinking');
    expect(voiceStateToMascotAnim('speak')).toBe('happy');
    expect(voiceStateToMascotAnim('mute')).toBe('sleeping');
    expect(voiceStateToMascotAnim('speak', true)).toBe('sleeping');

    expect(HERO_TAP_SEQUENCE).toEqual(['gentleman', 'happy', 'curious', 'dance', 'idle']);
    expect(nextHeroAnimState('idle')).toBe('gentleman');
    expect(nextHeroAnimState('gentleman')).toBe('happy');
    expect(normalizeMascotState('success')).toBe('happy');
  });

  it('parseBotSkin aceita formato canônico e migra formato legado sem perder dados', () => {
    const cyberJson = JSON.stringify(MASCOT_PRESETS[2]);
    expect(parseBotSkin({ skin_json: cyberJson }).fill).toBe('#0D1322');

    const legacyJson = JSON.stringify({
      preset: 'legacy_test',
      bodyColor: '#112233',
      bellyColor: '#AABBCC',
      tentacleColor: '#445566',
      eyeColor: '#FFFFFF',
      cheekColor: '#FF0000',
      accentColor: '#00FF00',
    });
    const migrated = parseBotSkin({ skin_json: legacyJson });
    expect(migrated.fill).toBe('#112233');
    expect(migrated.stroke).toBe('#445566');
    expect(migrated.bowtie).toBe('#00FF00');
  });

  it('MAS-06: Rig 500x500 expõe todas as camadas, 10 animações CSS, ReduceMotion e zero PNGs em VitoMascot', () => {
    const rigSrc = fs.readFileSync(path.join(MASCOT_DIR, 'MascotVectorRig.tsx'), 'utf8');
    const cssSrc = fs.readFileSync(path.join(MASCOT_DIR, 'mascotAnimations.css'), 'utf8');
    const vitoSrc = fs.readFileSync(path.join(DESKTOP_COMPONENTS, 'common/VitoMascot.tsx'), 'utf8');
    const studioSrc = fs.readFileSync(path.join(DESKTOP_COMPONENTS, 'bots/BotMascotStudio.tsx'), 'utf8');

    expect(vitoSrc).not.toContain('mascot-body.png');
    expect(vitoSrc).not.toContain('mascot-body-dark.png');
    expect(vitoSrc).toContain('MascotVectorRig');

    const layers = [
      'rig-whole',
      'rig-body',
      'rig-bowtie',
      'rig-eyes-group',
      'eyes-default',
      'eyes-happy',
      'eyes-sleeping',
      'rig-eye-left',
      'rig-eye-right',
      'rig-hat',
      'fx-sparkles',
      'fx-alert',
      'fx-thinking',
      'fx-zzz',
    ];
    for (const layer of layers) {
      expect(rigSrc).toContain(layer);
    }

    const states: MascotAnimationState[] = [
      'blink',
      'idle',
      'gentleman',
      'happy',
      'thinking',
      'curious',
      'surprised',
      'sleeping',
      'dance',
      'interactive',
    ];
    for (const st of states) {
      expect(cssSrc).toContain(`.state-${st}`);
    }
    expect(cssSrc).toContain('prefers-reduced-motion: reduce');
    expect(cssSrc).toContain('.mascot-paused');
    expect(cssSrc).toContain('.mascot-compact');

    for (const f of [rigSrc, cssSrc, vitoSrc, studioSrc]) {
      expect(f.split('\n').length).toBeLessThan(500);
    }
  });
});
