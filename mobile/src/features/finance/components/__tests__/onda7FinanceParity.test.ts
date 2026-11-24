import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const MOBILE_SRC = path.resolve(__dirname, '..', '..', '..', '..')

const WAVE7_FILES = [
  'features/finance/screens/FinanceScreen.tsx',
  'features/finance/screens/PluggyConnectModal.tsx',
  'features/finance/components/subscreens/FinanceSubScreenCharts.tsx',
  'features/finance/components/dashboard/BentoAccountHero.tsx',
  'features/finance/components/dashboard/BentoMetricsGrid.tsx',
  'features/finance/components/dashboard/RecentTransactionsList.tsx',
  'features/finance/components/dashboard/FinanceGoalsCard.tsx',
  'features/finance/components/subscreens/FinanceAskSheet.tsx',
  'features/finance/components/subscreens/FinanceSubScreenModal.tsx',
  'features/finance/components/dashboard/FinanceAttentionSection.tsx',
  'features/finance/components/subscreens/FinanceSubScreenViews.tsx',
  'features/finance/components/subscreens/FinanceSubScreenSecondaryViews.tsx',
]

test('Onda 7 — Finanças usa ProtoDonutChart, BrandLogo e SVGs próprios sem @expo/vector-icons', () => {
  for (const rel of WAVE7_FILES) {
    const content = fs.readFileSync(path.join(MOBILE_SRC, rel), 'utf8')
    assert.equal(content.includes('@expo/vector-icons'), false, `${rel} não deve importar @expo/vector-icons`)
    assert.equal(content.includes('MaterialIcons'), false, `${rel} não deve referenciar MaterialIcons`)
  }
  const charts = fs.readFileSync(path.join(MOBILE_SRC, 'features/finance/components/subscreens/FinanceSubScreenCharts.tsx'), 'utf8')
  assert.equal(charts.includes('ProtoDonutChart'), true, 'FinanceSubScreenCharts deve usar ProtoDonutChart')

  const pluggy = fs.readFileSync(path.join(MOBILE_SRC, 'features/finance/screens/PluggyConnectModal.tsx'), 'utf8')
  assert.equal(pluggy.includes('BrandLogo'), true, 'PluggyConnectModal deve usar BrandLogo para bancos')
})
