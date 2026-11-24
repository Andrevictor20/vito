import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const MOBILE_SRC = path.resolve(__dirname, '..');

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(MOBILE_SRC, rel), 'utf8');
}

describe('Animações de entrada global, Resumos v5 e barras/contadores em Finanças', () => {
  it('1. ScreenFocusContext existe e AdaptivePager + SectionTransition propagam foco para re-disparar stagger/charts', () => {
    assert.equal(
      fs.existsSync(path.join(MOBILE_SRC, 'theme/screenFocusContext.tsx')),
      true,
      'theme/screenFocusContext.tsx deve existir'
    );
    const pager = readSrc('components/common/AdaptivePager.tsx');
    assert.equal(pager.includes('ScreenFocusProvider'), true, 'AdaptivePager deve prover ScreenFocusProvider por aba');

    const section = readSrc('ds/SectionTransition.tsx');
    assert.equal(section.includes('ScreenFocusProvider'), true, 'SectionTransition deve prover ScreenFocusProvider');

    const motion = readSrc('theme/vitoMotion.tsx');
    assert.equal(motion.includes('useScreenEnterKey'), true, 'vitoMotion deve assinar useScreenEnterKey');
    assert.equal(motion.includes('AnimatedProgressBar'), true, 'vitoMotion deve exportar AnimatedProgressBar');
    assert.equal(motion.includes('AnimatedSegmentedBar'), true, 'vitoMotion deve exportar AnimatedSegmentedBar');
  });

  it('2. Perfil, Agenda, Tarefas, Bots e Finanças usam StaggerItem para entrada suave de toda a tela', () => {
    for (const file of [
      'screens/ProfileScreen.tsx',
      'components/home/AgendaView.tsx',
      'screens/TasksScreen.tsx',
      'screens/BotsScreen.tsx',
      'screens/FinanceScreen.tsx',
    ]) {
      const content = readSrc(file);
      assert.equal(content.includes('StaggerItem'), true, `${file} deve usar StaggerItem para entrada em cascata`);
    }
  });

  it('3. Tela de Resumos (Diário, Semanal e Mensal) segue o redesign .rs-* do protótipo', () => {
    assert.equal(
      fs.existsSync(path.join(MOBILE_SRC, 'components/summaries/SummaryPrimitives.tsx')),
      true,
      'components/summaries/SummaryPrimitives.tsx deve existir'
    );

    const primitives = readSrc('components/summaries/SummaryPrimitives.tsx');
    assert.equal(primitives.includes('expo-linear-gradient'), true, 'SummaryHeroCard deve usar expo-linear-gradient para preencher 100% no Android');
    assert.equal(primitives.includes('SummaryVitoNote'), false, 'Mensagens de sugestão do Vito devem ser removidas dos Resumos');

    const daily = readSrc('components/summaries/DailySummarySection.tsx');
    assert.equal(daily.includes('SummaryHeroCard'), true, 'Daily deve usar SummaryHeroCard com gradiente .rs-hero');
    assert.equal(daily.includes('ProtoRingChart'), true, 'Daily deve renderizar anéis ProtoRingChart (104px livre + 64px tarefas)');
    assert.equal(daily.includes('CountUpText'), true, 'Daily deve animar números com CountUpText');
    assert.equal(daily.includes('AnimatedSegmentedBar'), true, 'Daily deve animar linha do dia');
    assert.equal(daily.includes('StaggerItem'), true, 'Daily deve animar blocos com StaggerItem');
    assert.equal(daily.includes('SummaryVitoNote'), false, 'Daily não deve renderizar SummaryVitoNote');

    const weekly = readSrc('components/summaries/WeeklySummarySection.tsx');
    assert.equal(weekly.includes('SummaryHeroCard'), true, 'Weekly deve usar SummaryHeroCard');
    assert.equal(weekly.includes('SummaryInteractiveBars'), true, 'Weekly deve ter gráfico de barras interativo com média e carga diária');
    assert.equal(weekly.includes('SummaryCategoryBreakdown'), true, 'Weekly deve mostrar distribuição de categorias animada');
    assert.equal(weekly.includes('CountUpText'), true, 'Weekly deve animar KPIs com CountUpText');
    assert.equal(weekly.includes('StaggerItem'), true, 'Weekly deve animar blocos com StaggerItem');
    assert.equal(weekly.includes('SummaryVitoNote'), false, 'Weekly não deve renderizar SummaryVitoNote');

    const monthly = readSrc('components/summaries/MonthlySummarySection.tsx');
    assert.equal(monthly.includes('SummaryHeroCard'), true, 'Monthly deve usar SummaryHeroCard');
    assert.equal(monthly.includes('SummaryTrendLineChart'), true, 'Monthly deve ter gráfico de curva Bézier Tendência semanal');
    assert.equal(monthly.includes('SummaryBalanceDonut'), true, 'Monthly deve ter donut circular Equilíbrio de vida');
    assert.equal(monthly.includes('SummaryCategoryBreakdown'), true, 'Monthly deve ter seção Onde o tempo foi');
    assert.equal(monthly.includes('CountUpText'), true, 'Monthly deve animar números com CountUpText');
    assert.equal(monthly.includes('StaggerItem'), true, 'Monthly deve animar blocos com StaggerItem');
    assert.equal(monthly.includes('SummaryVitoNote'), false, 'Monthly não deve renderizar SummaryVitoNote');

    const agenda = readSrc('components/home/AgendaView.tsx');
    assert.equal(agenda.includes('vsugCard'), false, 'AgendaView não deve renderizar card de sugestão do Vito');
  });

  it('4. Finanças (Home e Sub-telas) animam barras carregando e números contando/aumentando', () => {
    const hero = readSrc('components/finance/FinanceHeroAndRail.tsx');
    assert.equal(hero.includes('CountUpText'), true, 'FinanceHeroAndRail deve usar CountUpText no saldo');

    const monthCards = readSrc('components/finance/FinanceMonthAndCards.tsx');
    assert.equal(monthCards.includes('CountUpText'), true, 'FinanceMonthAndCards deve usar CountUpText nos valores');
    assert.equal(monthCards.includes('AnimatedSegmentedBar'), true, 'FinanceMonthAndCards deve animar barra segmentada');

    const goals = readSrc('components/finance/FinanceGoalsCard.tsx');
    assert.equal(goals.includes('AnimatedProgressBar'), true, 'FinanceGoalsCard deve animar barras de progresso');
    assert.equal(goals.includes('CountUpText'), true, 'FinanceGoalsCard deve usar CountUpText nos percentuais');

    const subViews = readSrc('components/finance/FinanceSubScreenViews.tsx');
    assert.equal(subViews.includes('CountUpText'), true, 'SpendingSubView deve usar CountUpText');
    assert.equal(subViews.includes('StaggerItem'), true, 'FinanceSubScreenViews deve usar StaggerItem');

    const flowCard = readSrc('components/finance/FinanceSubScreenFlowCardViews.tsx');
    assert.equal(flowCard.includes('CountUpText'), true, 'CashFlow/Cards subviews devem usar CountUpText');
    assert.equal(flowCard.includes('AnimatedProgressBar'), true, 'CardsSubView deve usar AnimatedProgressBar');
    assert.equal(flowCard.includes('AnimatedSegmentedBar'), true, 'CardsSubView deve usar AnimatedSegmentedBar');

    const secViews = readSrc('components/finance/FinanceSubScreenSecondaryViews.tsx');
    assert.equal(secViews.includes('CountUpText'), true, 'Subscriptions/Goals subviews devem usar CountUpText');
    assert.equal(secViews.includes('AnimatedProgressBar'), true, 'GoalsSubView deve usar AnimatedProgressBar');
  });

  it('5. Nenhum arquivo alterado excede 500 linhas nem usa useNativeDriver: false', () => {
    const files = [
      'theme/screenFocusContext.tsx',
      'theme/vitoMotion.tsx',
      'components/summaries/SummaryPrimitives.tsx',
      'components/summaries/DailySummarySection.tsx',
      'components/summaries/WeeklySummarySection.tsx',
      'components/summaries/MonthlySummarySection.tsx',
    ];
    for (const rel of files) {
      const full = path.join(MOBILE_SRC, rel);
      if (!fs.existsSync(full)) continue;
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n').length;
      assert.ok(lines <= 500, `${rel} tem ${lines} linhas (máx 500)`);
      assert.equal(content.includes('useNativeDriver: false'), false, `${rel} não deve usar useNativeDriver: false`);
    }
  });
});
