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

describe('Polimento — Transições Direcionais, Navbar Animada, Gráficos Multicoloridos e Ícones Semânticos', () => {
  it('AdaptivePager: transição direcional (translateX + scale + fade) sem corte do enter quando leaving termina', () => {
    const pager = readSrc('components/common/AdaptivePager.tsx');
    assert.equal(pager.includes('TAB_SLIDE_X'), true, 'AdaptivePager deve ter deslocamento horizontal direcional');
    assert.equal(pager.includes('direction.value'), true, 'AdaptivePager deve acompanhar a direção da troca de aba');
    assert.equal(pager.includes('leavingRef'), true, 'AdaptivePager deve isolar leavingRef do useEffect para não cortar enter');
    assert.equal(
      pager.includes('}, [transitionId, reduceMotion, enter, leave]);'),
      true,
      'useEffect de transição não deve depender do estado leavingIndex'
    );
  });

  it('FloatingTabBar: indicador de pílula deslizante com withSpring + bounce elástico no ícone', () => {
    const dock = readSrc('components/common/FloatingTabBar.tsx');
    assert.equal(dock.includes('slidingIndicator'), true, 'FloatingTabBar deve ter pílula deslizante animada');
    assert.equal(dock.includes('withSpring'), true, 'FloatingTabBar deve animar com withSpring na UI thread');
    assert.equal(dock.includes('withSequence'), true, 'FloatingTabBar deve aplicar bounce elástico no ícone ativo');
    assert.equal(dock.includes('mass: 1'), true, 'Springs Reanimated 4 devem definir mass: 1 explicitamente');
  });

  it('Gráficos financeiros usam paleta multicolorida variada e animações Reanimated 4 (sem escala monocromática)', () => {
    const charts = readSrc('features/finance/components/subscreens/FinanceSubScreenCharts.tsx');
    assert.equal(charts.includes('buildFinScale'), false, 'FinanceSubScreenCharts não deve usar escala monocromática buildFinScale');
    assert.equal(charts.includes('resolveCategoryVisual'), true, 'FinanceDonutChart deve colorir cada categoria com cor semântica distinta');
    assert.equal(charts.includes("from 'react-native-reanimated'"), true, 'Barras diárias e fluxo mensal devem animar em Reanimated 4');

    const monthCards = readSrc('features/finance/components/dashboard/FinanceMonthAndCards.tsx');
    assert.equal(monthCards.includes('resolveCategoryVisual'), true, 'Barra segmentada do mês deve usar cores variadas por categoria');
    assert.equal(monthCards.includes('FinanceBankBadge'), true, 'Lista de cartões na Home deve usar FinanceBankBadge');
  });

  it('Sub-telas e Home de Finanças exibem ícones semânticos coloridos de marcas, categorias e bancos', () => {
    const semantic = readSrc('features/finance/components/shared/FinanceSemanticIcons.tsx');
    assert.equal(semantic.includes('@expo/vector-icons'), false, 'FinanceSemanticIcons deve usar apenas SVGs próprios e BrandLogo');

    const views = readSrc('features/finance/components/subscreens/FinanceSubScreenViews.tsx');
    assert.equal(views.includes('TransactionSemanticBadge'), true, 'ExtractSubView e Maiores Gastos devem usar TransactionSemanticBadge');
    assert.equal(views.includes('CategorySemanticBadge'), true, 'SpendingSubView deve usar CategorySemanticBadge na legenda');

    const flowCards = readSrc('features/finance/components/subscreens/FinanceSubScreenFlowCardViews.tsx');
    assert.equal(flowCards.includes('FinanceBankBadge'), true, 'CardsSubView deve usar FinanceBankBadge');
    assert.equal(flowCards.includes('CategorySemanticBadge'), true, 'CardsSubView deve usar CategorySemanticBadge');

    const secondary = readSrc('features/finance/components/subscreens/FinanceSubScreenSecondaryViews.tsx');
    assert.equal(secondary.includes('TransactionSemanticBadge'), true, 'SubscriptionsSubView deve usar TransactionSemanticBadge');
    assert.equal(secondary.includes('CategorySemanticBadge'), true, 'GoalsSubView (orçamentos) deve usar CategorySemanticBadge');
    assert.equal(secondary.includes('GoalSemanticBadge'), true, 'GoalsSubView (metas) deve usar GoalSemanticBadge');
    assert.equal(secondary.includes('FinanceBankBadge'), true, 'ConnectionsSubView deve usar FinanceBankBadge');

    const homeGoals = readSrc('features/finance/components/dashboard/FinanceGoalsCard.tsx');
    assert.equal(homeGoals.includes('CategorySemanticBadge'), true, 'FinanceGoalsCard na Home deve usar CategorySemanticBadge');

    const homeRecent = readSrc('features/finance/components/dashboard/RecentTransactionsList.tsx');
    assert.equal(homeRecent.includes('TransactionSemanticBadge'), true, 'RecentTransactionsList na Home deve usar TransactionSemanticBadge');
  });
});
