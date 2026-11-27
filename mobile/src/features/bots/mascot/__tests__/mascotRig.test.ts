import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ALL_RANDOMIZER_PALETTES,
  EXTRA_RANDOM_PALETTES,
  HERO_TAP_SEQUENCE,
  MASCOT_PRESETS,
  MascotAnimationState,
  nextHeroAnimState,
  normalizeMascotState,
  parseMascotSkin,
  pickRandomMascotPreset,
  resolveSkin,
  voiceStateToMascotAnim,
} from '../mascotPalettes';

const MASCOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.resolve(__dirname, '../../../..');

describe('Plano 07 — Unified Mascot Rig Mobile', () => {
  test('MAS-01/MAS-05: 10 presets canônicos + 5 extras de sorteio resolvem Light/Dark auto', () => {
    assert.equal(MASCOT_PRESETS.length, 10);
    assert.equal(EXTRA_RANDOM_PALETTES.length, 5);
    assert.equal(ALL_RANDOMIZER_PALETTES.length, 15);

    const light = resolveSkin(MASCOT_PRESETS[0], false);
    const dark = resolveSkin(MASCOT_PRESETS[0], true);
    assert.deepEqual(light, {
      preset: 'vito',
      fill: '#FFFFFF',
      stroke: '#0A0A0A',
      eyes: '#0A0A0A',
      bowtie: '#0A0A0A',
      hat: '#0A0A0A',
      band: '#FFFFFF',
    });
    assert.deepEqual(dark, {
      preset: 'vito',
      fill: '#171717',
      stroke: '#F5F5F5',
      eyes: '#F5F5F5',
      bowtie: '#F5F5F5',
      hat: '#F5F5F5',
      band: '#171717',
    });

    const randomPick = pickRandomMascotPreset('vito');
    assert.notEqual(randomPick.id, 'vito');
  });

  test('MAS-03: mapeamento de Modo Voz (#s-voice) e ciclo do Hero (.chero)', () => {
    assert.equal(voiceStateToMascotAnim('LISTENING'), 'curious');
    assert.equal(voiceStateToMascotAnim('THINKING'), 'thinking');
    assert.equal(voiceStateToMascotAnim('SPEAKING'), 'happy');
    assert.equal(voiceStateToMascotAnim('IDLE'), 'sleeping');
    assert.equal(voiceStateToMascotAnim('SPEAKING', true), 'sleeping');

    assert.deepEqual(HERO_TAP_SEQUENCE, ['gentleman', 'happy', 'curious', 'dance', 'idle']);
    assert.equal(nextHeroAnimState('idle'), 'gentleman');
    assert.equal(nextHeroAnimState('gentleman'), 'happy');
    assert.equal(normalizeMascotState('success'), 'happy');
  });

  test('parseMascotSkin aceita skin v5 e migra formato legado sem quebrar', () => {
    const legacy = JSON.stringify({
      preset: 'legacy',
      bodyColor: '#123456',
      bellyColor: '#ABCDEF',
      tentacleColor: '#111111',
      eyeColor: '#222222',
      cheekColor: '#333333',
      accentColor: '#444444',
    });
    const migrated = parseMascotSkin(legacy);
    assert.equal(migrated.fill, '#123456');
    assert.equal(migrated.stroke, '#111111');
    assert.equal(migrated.bowtie, '#444444');
  });

  test('MAS-06: MascotVectorRig 500x500 expõe todas as camadas, 10 estados, ReduceMotion e zero PNGs', () => {
    const rigSrc = fs.readFileSync(path.join(MASCOT_DIR, 'MascotVectorRig.tsx'), 'utf8');
    const hookSrc = fs.readFileSync(path.join(MASCOT_DIR, 'useMascotAnimation.ts'), 'utf8');
    const buildersSrc = fs.readFileSync(path.join(MASCOT_DIR, 'mascotAnimationBuilders.ts'), 'utf8');
    const vitoSrc = fs.readFileSync(path.join(SRC_DIR, 'components/common/VitoMascot.tsx'), 'utf8');
    const avatarSrc = fs.readFileSync(path.join(SRC_DIR, 'features/bots/components/BotMascotAvatar.tsx'), 'utf8');
    const studioSrc = fs.readFileSync(path.join(SRC_DIR, 'features/bots/components/MascotStudioModal.tsx'), 'utf8');

    assert.equal(vitoSrc.includes('mascot-body.png'), false);
    assert.equal(vitoSrc.includes('mascot-body-dark.png'), false);
    assert.equal(vitoSrc.includes('MascotVectorRig'), true);
    assert.equal(avatarSrc.includes('MascotVectorRig'), true);

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
      assert.equal(rigSrc.includes(layer), true, `Faltando camada ${layer}`);
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
      assert.equal(
        hookSrc.includes(`'${st}'`) || buildersSrc.includes(`'${st}'`),
        true,
        `Estado ${st} ausente em useMascotAnimation/mascotAnimationBuilders`
      );
    }

    assert.equal(hookSrc.includes('isReduceMotionEnabled'), true);
    assert.equal(rigSrc.includes('size <= 34'), true);

    const nativeGuardIdx = rigSrc.indexOf("Platform.OS !== 'web'");
    const firstAnimatedPropsIdx = rigSrc.indexOf('const wholeProps = useAnimatedProps');
    assert.ok(nativeGuardIdx > 0, 'Guarda nativo Platform.OS !== web deve existir');
    assert.ok(
      firstAnimatedPropsIdx > nativeGuardIdx,
      'MascotVectorRig deve retornar o canvas Skia nativo antes de instanciar hooks useAnimatedProps exclusivos da Web'
    );

    for (const src of [rigSrc, hookSrc, buildersSrc, vitoSrc, avatarSrc, studioSrc]) {
      assert.ok(src.split('\n').length < 500, 'Arquivo excedeu 500 linhas');
    }
  });
});
