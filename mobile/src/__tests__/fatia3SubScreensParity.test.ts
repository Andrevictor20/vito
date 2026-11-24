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

describe('Fatia 3 — Paridade Visual de Perfil, Sub-telas de Finanças e Sub-telas de Bots', () => {
  it('Perfil: sbar sem borda inferior, avatar 38px, AiSection em sentence case e themeSeg pílula à direita', () => {
    const profileStyles = readSrc('screens/ProfileScreen.styles.ts');
    assert.equal(profileStyles.includes('borderBottomWidth'), false, 'Profile sbar não deve ter borderBottomWidth');
    assert.equal(profileStyles.includes("marginLeft: 'auto'"), true, 'themeSeg deve ser alinhado à direita');
    assert.equal(profileStyles.includes('fontSize: 26'), true, 'sbarTitle do Perfil deve usar 26px');

    const userCard = readSrc('components/profile/ProfileUserCard.tsx');
    assert.equal(userCard.includes('width: 38'), true, 'Avatar .pf .av deve ter 38px');
    assert.equal(userCard.includes("fontWeight: '800'"), false, 'ProfileUserCard não deve usar peso 800');

    const aiSection = readSrc('components/profile/AiSection.tsx');
    assert.equal(aiSection.includes('Inteligência artificial'), true, 'AiSection label deve usar sentence case');
    assert.equal(aiSection.includes("textTransform: 'uppercase'"), false, 'AiSection label não deve usar uppercase');
    assert.equal(aiSection.includes('borderRadius: 22'), true, 'AiSection .lst deve usar borderRadius 22');
  });

  it('Sub-telas do Perfil: sbar canônico (26px Geist 500, sem linha dura) e AiProviders em sentence case', () => {
    const aiProv = readSrc('screens/AiProvidersScreen.tsx');
    assert.equal(aiProv.includes('>Ativos<'), true, 'AiProvidersScreen deve usar Ativos em sentence case');
    assert.equal(aiProv.includes('>Com chave própria<'), true, 'AiProvidersScreen deve usar Com chave própria em sentence case');
    assert.equal(aiProv.includes('fontSize: 26'), true, 'AiProvidersScreen h1 deve usar 26px');

    const intStyles = readSrc('screens/IntegrationsScreen.styles.ts');
    assert.equal(intStyles.includes('borderBottomWidth'), false, 'Integrations sbar não deve ter borderBottomWidth');
    assert.equal(intStyles.includes('fontSize: 26'), true, 'Integrations h1 deve usar 26px');
    assert.equal(intStyles.includes('borderRadius: 22'), true, 'Integrations cards devem usar borderRadius 22');

    for (const rel of ['screens/BehaviorScreen.tsx', 'screens/VoiceSettingsScreen.tsx', 'screens/MemoryScreen.tsx', 'screens/NotificationsScreen.tsx']) {
      const src = readSrc(rel);
      assert.equal(src.includes('borderBottomColor: colors.line'), false, `${rel} sbar não deve ter borda inferior`);
    }
  });

  it('Sub-telas de Finanças: cards .card2 em superfície --surf com hairline, raio 22 e Geist 500', () => {
    const modal = readSrc('components/finance/FinanceSubScreenModal.tsx');
    assert.equal(modal.includes('fontSize: 26'), true, 'FinanceSubScreenModal sbar title deve usar 26px');
    assert.equal(modal.includes("fontWeight: '800'"), false, 'FinanceSubScreenModal title não deve usar 800');

    const subStyles = readSrc('components/finance/financeSubScreenStyles.ts');
    assert.equal(subStyles.includes('borderRadius: 22'), true, 'card2 deve usar borderRadius 22');
    assert.equal(subStyles.includes("fontWeight: '800'"), false, 'financeSubScreenStyles não deve usar peso 800');
    assert.equal(subStyles.includes("textTransform: 'uppercase'"), false, 'eyebrow/dayHeader não devem forçar uppercase');

    for (const rel of [
      'components/finance/FinanceSubScreenViews.tsx',
      'components/finance/FinanceSubScreenFlowCardViews.tsx',
      'components/finance/FinanceSubScreenSecondaryViews.tsx',
    ]) {
      const src = readSrc(rel);
      assert.equal(
        src.includes('styles.card2, { backgroundColor: colors.bg'),
        false,
        `${rel} deve usar colors.surf em styles.card2`
      );
      assert.equal(
        src.includes('styles.card2Flush, { backgroundColor: colors.bg'),
        false,
        `${rel} deve usar colors.surf em styles.card2Flush`
      );
    }
  });

  it('Sub-telas de Bots: BotDetailView 21px + Reanimated 4, BotDetailsTab em --surf e MascotStudio 152px + Geist Mono', () => {
    const detail = readSrc('components/bots/BotDetailView.tsx');
    assert.equal(detail.includes('fontSize: 21'), true, '#s-rdd h1 deve usar 21px');
    assert.equal(detail.includes('borderBottomWidth'), false, 'BotDetailView sbar não deve ter borderBottomWidth');
    assert.equal(detail.includes("from 'react-native-reanimated'"), true, 'BotDetailView deve animar troca de aba em Reanimated 4');

    const detailsTab = readSrc('components/bots/BotDetailsTab.tsx');
    assert.equal(detailsTab.includes('Função do bot'), true, 'BotDetailsTab label deve usar sentence case');
    assert.equal(detailsTab.includes('backgroundColor: colors.surf, borderColor: colors.hairline'), true, 'BotDetailsTab cards devem usar --surf + hairline');

    const studio = readSrc('components/bots/MascotStudioModal.tsx');
    assert.equal(studio.includes('size={152}'), true, 'MascotStudio palco deve usar mascote 152px (.mc-rig)');
    assert.equal(studio.includes("fontFamily: 'Geist Mono'"), true, 'MascotStudio hex codes devem usar Geist Mono');
    assert.equal(studio.includes('borderRadius: 26'), true, 'MascotStudio .mc-stage deve usar borderRadius 26');
  });

  it('Animações e transições: zero useNativeDriver: false no app e Reanimated 4 em gráficos, switches, onboarding e sub-telas financeiras', () => {
    const reanimatedTargets = [
      'components/ui/VitoSwitch.tsx',
      'components/ui/M3Switch.tsx',
      'components/booking/MeetingPollSlotItem.tsx',
      'components/summaries/SummaryRingSvg.tsx',
      'charts/ProtoDonutChart.tsx',
      'charts/ProtoAreaChart.tsx',
      'charts/ProtoBarsChart.tsx',
      'charts/ProtoRingChart.tsx',
      'screens/OnboardingScreen.tsx',
      'components/login/onboardingArtParts.tsx',
    ];
    for (const rel of reanimatedTargets) {
      const src = readSrc(rel);
      assert.equal(src.includes("from 'react-native-reanimated'"), true, `${rel} deve usar react-native-reanimated`);
      assert.equal(src.includes('useNativeDriver: false'), false, `${rel} não deve usar useNativeDriver: false`);
    }

    const loginRig = readSrc('components/login/LoginMascotRig.tsx');
    assert.equal(loginRig.includes('MascotVectorRig'), true, 'LoginMascotRig deve delegar para MascotVectorRig (Skia/Reanimated 4)');
    assert.equal(loginRig.includes('addListener'), false, 'LoginMascotRig não deve fazer setState por frame via addListener');

    const finModal = readSrc('components/finance/FinanceSubScreenModal.tsx');
    assert.equal(finModal.includes('SectionTransition'), true, 'FinanceSubScreenModal deve usar SectionTransition (push)');
    assert.equal(finModal.includes('animationType="slide"'), false, 'FinanceSubScreenModal não deve usar animationType="slide"');

    const finAsk = readSrc('components/finance/FinanceAskSheet.tsx');
    assert.equal(finAsk.includes('VitoSheet'), true, 'FinanceAskSheet deve usar VitoSheet (Reanimated 4 + Gesture Handler)');

    // Varredura global em mobile/src/ garantindo ZERO useNativeDriver: false fora de __tests__
    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === '__tests__') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) out.push(full);
      }
      return out;
    };
    const offenders = walk(SRC).filter((f) => fs.readFileSync(f, 'utf8').includes('useNativeDriver: false'));
    assert.deepEqual(offenders, [], 'Nenhum arquivo de produção em mobile/src/ deve usar useNativeDriver: false');
  });
});
