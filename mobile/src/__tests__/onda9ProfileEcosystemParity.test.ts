import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const MOBILE_SRC = path.resolve(__dirname, '..')

const WAVE9_FILES = [
  'screens/IntegrationsScreen.tsx',
  'screens/AiProvidersScreen.tsx',
  'screens/ProfileScreen.tsx',
  'screens/VoiceSettingsScreen.tsx',
  'screens/BehaviorScreen.tsx',
  'screens/MemoryScreen.tsx',
  'screens/StoreScreen.tsx',
  'components/ai/AiProviderLogo.tsx',
]

test('Onda 9 — Perfil e ecossistema usam BrandLogo e SVGs próprios sem @expo/vector-icons', () => {
  for (const rel of WAVE9_FILES) {
    const content = fs.readFileSync(path.join(MOBILE_SRC, rel), 'utf8')
    assert.equal(content.includes('@expo/vector-icons'), false, `${rel} não deve importar @expo/vector-icons`)
    assert.equal(content.includes('MaterialIcons'), false, `${rel} não deve referenciar MaterialIcons`)
  }
  const integrations = fs.readFileSync(path.join(MOBILE_SRC, 'screens/IntegrationsScreen.tsx'), 'utf8')
  assert.equal(integrations.includes('BrandLogo'), true, 'IntegrationsScreen deve usar BrandLogo')

  const aiLogo = fs.readFileSync(path.join(MOBILE_SRC, 'components/ai/AiProviderLogo.tsx'), 'utf8')
  assert.equal(aiLogo.includes('BrandLogo'), true, 'AiProviderLogo deve delegar para BrandLogo')
})
