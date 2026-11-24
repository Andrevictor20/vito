import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC = path.resolve(__dirname, '..');

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(SRC, rel), 'utf8');
}

describe('Fatia 1 (Base Global) — Paleta Light/Dark, Mascote Skia+Reanimated 4 e Transições UI Thread', () => {
  it('Auditoria Light & Dark: ThemeContext, ProtoDock, FloatingTabBar e VitoSheet alinham 1:1 com o protótipo', () => {
    const themeCtx = readSrc('context/ThemeContext.tsx');
    assert.equal(themeCtx.includes('#0e0e10'), false, 'ThemeContext não deve usar #0e0e10 (dark bg canônico é #0a0a0a)');
    assert.equal(themeCtx.includes('#0a0a0a'), true, 'ThemeContext deve usar #0a0a0a no reveal dark');

    const protoDock = readSrc('ds/ProtoDock.tsx');
    assert.equal(protoDock.includes('rgba(24, 24, 26, 0.78)'), true, 'ProtoDock dark deve usar glass rgba(24, 24, 26, 0.78)');
    assert.equal(protoDock.includes('rgba(244, 244, 244, 0.80)'), true, 'ProtoDock light deve usar glass rgba(244, 244, 244, 0.80)');
    assert.equal(protoDock.includes('../theme'), false, 'ProtoDock deve permanecer isolado de ../theme/');

    const dock = readSrc('components/common/FloatingTabBar.tsx');
    assert.equal(dock.includes('paddingTop: 18'), true, 'FloatingTabBar .dock deve usar paddingTop: 18');
    assert.equal(dock.includes('fillOpacity={active ? 0.14 : 0}'), false, 'Ícone chat do dock não deve ter fillOpacity extra');

    const sheet = readSrc('components/ui/VitoSheet.tsx');
    assert.equal(sheet.includes('rgba(0, 0, 0, 0.4)'), true, 'VitoSheet scrim deve usar rgba(0, 0, 0, 0.4)');
    assert.equal(sheet.includes('rgba(0, 0, 0, 0.6)'), false, 'VitoSheet não deve escurecer scrim para 0.6');
  });

  it('Mascote (MascotVectorRig): 100% UI thread via Reanimated 4 + GPU Skia nativo', () => {
    const builders = readSrc('features/bots/mascot/mascotAnimationBuilders.ts');
    const hook = readSrc('features/bots/mascot/useMascotAnimation.ts');
    const rig = readSrc('features/bots/mascot/MascotVectorRig.tsx');
    const skiaNative = readSrc('features/bots/mascot/MascotSkiaCanvas.native.tsx');
    const geom = readSrc('features/bots/mascot/mascotGeometry.ts');

    assert.equal(builders.includes("from 'react-native-reanimated'"), true);
    assert.equal(builders.includes('useNativeDriver: false'), false);
    assert.equal(builders.includes('mascotSpecs'), true);

    assert.equal(hook.includes("from 'react-native-reanimated'"), true);
    assert.equal(hook.includes('useSharedValue'), true);
    assert.equal(hook.includes('cancelAnimation'), true);
    assert.equal(hook.includes('useNativeDriver: false'), false);
    assert.equal(hook.includes('new Animated.Value'), false);
    assert.equal(hook.includes('isReduceMotionEnabled'), true);

    assert.equal(skiaNative.includes('@shopify/react-native-skia'), true);
    assert.equal(skiaNative.includes('MakeFromSVGString'), true);
    assert.equal(skiaNative.includes('useDerivedValue'), true);

    assert.equal(rig.includes('MascotSkiaCanvas'), true);
    assert.equal(rig.includes("from 'react-native-reanimated'"), true);
    assert.equal(rig.includes('new Animated.Value'), false);
    assert.equal(geom.includes('M 88 354'), true);
  });

  it('Transições entre seções, dock, sheets e overlays migrados para Reanimated 4 (UI thread)', () => {
    const migrated = [
      'ds/SectionTransition.tsx',
      'ds/ProtoDock.tsx',
      'ds/ProtoSheet.tsx',
      'components/common/AdaptivePager.tsx',
      'components/common/FloatingTabBar.tsx',
      'components/ui/VitoSheet.tsx',
      'theme/vitoMotion.tsx',
      'theme/vitoOverlays.tsx',
    ];

    for (const rel of migrated) {
      const src = readSrc(rel);
      assert.equal(src.includes("from 'react-native-reanimated'"), true, `${rel} deve importar react-native-reanimated`);
      assert.equal(src.includes('new Animated.Value'), false, `${rel} não deve usar RN Animated.Value`);
      assert.equal(src.includes('useNativeDriver'), false, `${rel} não deve usar useNativeDriver legado`);
      assert.ok(src.split('\n').length < 500, `${rel} excedeu 500 linhas`);
    }

    const vitoSheet = readSrc('components/ui/VitoSheet.tsx');
    assert.equal(vitoSheet.includes('Gesture.Pan'), true, 'VitoSheet deve suportar arrastar para fechar via Gesture.Pan');
    assert.equal(vitoSheet.includes('scheduleOnRN'), true, 'VitoSheet deve usar scheduleOnRN (react-native-worklets)');

    const sectionTr = readSrc('ds/SectionTransition.tsx');
    assert.equal(sectionTr.includes('scheduleOnRN'), true, 'SectionTransition deve usar scheduleOnRN');
    assert.equal(sectionTr.includes('../theme'), false, 'SectionTransition deve permanecer isolado de ../theme/');

    const protoSheet = readSrc('ds/ProtoSheet.tsx');
    assert.equal(protoSheet.includes('../theme'), false, 'ProtoSheet deve permanecer isolado de ../theme/');
  });
});
