import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const MOBILE_SRC = path.resolve(__dirname, '..', '..', '..')

const WAVE7_FILES = [
  'screens/FinanceScreen.tsx',
  'screens/PluggyConnectModal.tsx',
  'components/finance/FinanceSubScreenCharts.tsx',
  'components/finance/BentoAccountHero.tsx',
  'components/finance/BentoMetricsGrid.tsx',
  'components/finance/RecentTransactionsList.tsx',
  'components/finance/FinanceGoalsCard.tsx',
  'components/finance/FinanceAskSheet.tsx',
  'components/finance/FinanceSubScreenModal.tsx',
  'components/finance/FinanceAttentionSection.tsx',
  'components/finance/FinanceSubScreenViews.tsx',
  'components/finance/FinanceSubScreenSecondaryViews.tsx',
]

test('Onda 7 — Finanças usa ProtoDonutChart, BrandLogo e SVGs próprios sem @expo/vector-icons', () => {
  for (const rel of WAVE7_FILES) {
    const content = fs.readFileSync(path.join(MOBILE_SRC, rel), 'utf8')
    assert.equal(content.includes('@expo/vector-icons'), false, `${rel} não deve importar @expo/vector-icons`)
    assert.equal(content.includes('MaterialIcons'), false, `${rel} não deve referenciar MaterialIcons`)
  }
  const charts = fs.readFileSync(path.join(MOBILE_SRC, 'components/finance/FinanceSubScreenCharts.tsx'), 'utf8')
  assert.equal(charts.includes('ProtoDonutChart'), true, 'FinanceSubScreenCharts deve usar ProtoDonutChart')

  const pluggy = fs.readFileSync(path.join(MOBILE_SRC, 'screens/PluggyConnectModal.tsx'), 'utf8')
  assert.equal(pluggy.includes('BrandLogo'), true, 'PluggyConnectModal deve usar BrandLogo para bancos')
})
