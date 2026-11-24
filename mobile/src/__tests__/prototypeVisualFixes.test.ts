import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const MOBILE_SRC = path.resolve(__dirname, '..');

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(MOBILE_SRC, rel), 'utf8');
}

describe('Regressões visuais vs Vito-telas-atualizadas.html', () => {
  it('1. Login: DemoStage sem GradientOverlay opaco e cards/CTA sem elevation branca no Android', () => {
    const demoStage = readSrc('components/login/DemoStage.tsx');
    assert.equal(demoStage.includes('<GradientOverlay'), false, 'DemoStage não deve renderizar GradientOverlay opaco sobre o glow');

    const demoCard = readSrc('components/login/DemoActionCard.tsx');
    assert.equal(/\belevation\s*:/.test(demoCard), false, 'DemoActionCard não deve usar elevation no Android');

    const footer = readSrc('components/login/AuthActionsFooter.tsx');
    assert.equal(/\belevation\s*:/.test(footer), false, 'AuthActionsFooter não deve usar elevation no Android');
  });

  it('2. Mascote: MascotVectorRig anima piscar direto em height/y sem Animated.multiply', () => {
    const rig = readSrc('components/mascot/MascotVectorRig.tsx');
    assert.equal(rig.includes('Animated.multiply'), false, 'MascotVectorRig não deve usar Animated.multiply nos olhos');
    assert.equal(rig.includes('AnimatedRect'), true, 'MascotVectorRig deve animar olhos via AnimatedRect (y/height)');
  });

  it('3. Finanças: FinanceScreen segue os 9 blocos de finRender() do protótipo', () => {
    const fin = readSrc('screens/FinanceScreen.tsx');
    assert.equal(fin.includes('FinanceHeroAndRail'), true, 'FinanceScreen deve usar FinanceHeroAndRail');
    assert.equal(fin.includes('FinanceMonthAndCards'), true, 'FinanceScreen deve usar FinanceMonthAndCards');
    assert.equal(fin.includes('BentoAccountHero'), false, 'FinanceScreen não deve usar o antigo BentoAccountHero');
    assert.equal(fin.includes('BentoMetricsGrid'), false, 'FinanceScreen não deve usar o antigo BentoMetricsGrid');

    const monthCards = readSrc('components/finance/FinanceMonthAndCards.tsx');
    assert.equal(monthCards.includes('ProtoRingChart'), true, 'FinanceMonthAndCards deve usar ProtoRingChart para Cartões');
    assert.equal(monthCards.includes('Sobra no mês'), true);
    assert.equal(monthCards.includes('Pode gastar hoje'), true);

    const recent = readSrc('components/finance/RecentTransactionsList.tsx');
    assert.equal(recent.includes('groupTransactionsByDay') || recent.includes('fxDay'), true, 'RecentTransactionsList deve agrupar movimentações por dia');
  });

  it('4. Resumos: Daily, Weekly e Monthly seguem .card2 sem fundo azul #EFF5FF', () => {
    for (const file of [
      'components/summaries/DailySummarySection.tsx',
      'components/summaries/WeeklySummarySection.tsx',
      'components/summaries/MonthlySummarySection.tsx',
    ]) {
      const content = readSrc(file);
      assert.equal(content.includes('#EFF5FF'), false, `${file} não deve usar fundo azul #EFF5FF`);
      assert.equal(content.includes('#141925'), false, `${file} não deve usar fundo azul escuro #141925`);
    }
    const daily = readSrc('components/summaries/DailySummarySection.tsx');
    assert.equal(daily.includes('SummaryRingSvg'), false, 'DailySummarySection não deve usar SummaryRingSvg');
    assert.equal(daily.includes('Reservar foco'), true);

    const monthly = readSrc('components/summaries/MonthlySummarySection.tsx');
    assert.equal(monthly.includes('ProtoRingChart'), true, 'MonthlySummarySection deve usar ProtoRingChart');
  });

  it('5. Booking: BookingLinksTab sem banner promocional e BookingStackHeader com botão +', () => {
    const linksTab = readSrc('components/booking/BookingLinksTab.tsx');
    assert.equal(linksTab.includes('showVitoSuggestion'), false, 'BookingLinksTab não deve renderizar banner promocional');

    const stackHeader = readSrc('components/booking/BookingStackHeader.tsx');
    assert.equal(stackHeader.includes('onPressNew'), true, 'BookingStackHeader deve suportar botão + (onPressNew)');
  });

  it('6. Transições: AgendaTabScreen usa SectionTransition e RootNavigator/AdaptivePager têm movimento claro', () => {
    const agendaTab = readSrc('navigation/AgendaTabScreen.tsx');
    assert.equal(agendaTab.includes('SectionTransition'), true, 'AgendaTabScreen deve envolver Resumos e Calendário em SectionTransition');

    const rootNav = readSrc('navigation/RootNavigator.tsx');
    assert.equal(rootNav.includes('[64, 0]'), true, 'RootNavigator deve usar slide horizontal visível [64, 0]');

    const pager = readSrc('components/common/AdaptivePager.tsx');
    assert.equal(pager.includes('TAB_SLIDE_Y'), true, 'AdaptivePager deve usar deslocamento vertical visível nas trocas de aba');
  });

  it('7. Logos Google: BrandLogo usa GmailOfficialLogo e GoogleDriveOfficialLogo sem transform quebrado', () => {
    const googleLogos = readSrc('icons/GoogleBrandLogos.tsx');
    assert.equal(googleLogos.includes('GmailOfficialLogo'), true);
    assert.equal(googleLogos.includes('GoogleDriveOfficialLogo'), true);
    assert.equal(googleLogos.includes('transform='), false, 'GoogleBrandLogos não deve usar transform string');

    const registry = readSrc('icons/IconRegistry.tsx');
    assert.equal(registry.includes("id === 'gmail'"), true);
    assert.equal(registry.includes("id === 'gdrive'"), true);
  });

  it('8. Troca de tema: ThemeContext dispara triggerThemeReveal e RootNavigator monta CircularThemeRevealOverlay globalmente', () => {
    const themeCtx = readSrc('context/ThemeContext.tsx');
    assert.equal(themeCtx.includes('triggerThemeReveal'), true, 'ThemeContext deve disparar triggerThemeReveal');

    const rootNav = readSrc('navigation/RootNavigator.tsx');
    assert.equal(rootNav.includes('CircularThemeRevealOverlay'), true, 'RootNavigator deve montar CircularThemeRevealOverlay');
  });
});
