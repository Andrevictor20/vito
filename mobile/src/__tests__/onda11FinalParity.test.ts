import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const MOBILE_SRC = path.resolve(__dirname, '..')

function walkTs(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walkTs(full, out)
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) out.push(full)
  }
  return out
}

test('Onda 11 — Zero @expo/vector-icons em mobile/src e integridade de mascote/catálogo', () => {
  const files = walkTs(MOBILE_SRC)
  const offenders: string[] = []
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8')
    if (src.includes('@expo/vector-icons')) {
      offenders.push(path.relative(MOBILE_SRC, f))
    }
  }
  assert.deepEqual(offenders, [], `Nenhum arquivo de produção deve importar @expo/vector-icons: ${offenders.join(', ')}`)

  const builders = fs.readFileSync(path.join(MOBILE_SRC, 'features/bots/mascot/mascotAnimationBuilders.ts'), 'utf8')
  assert.equal(builders.includes('mascotSpecs'), true, 'mascotAnimationBuilders deve consumir mascotSpecs')

  const aiLogo = fs.readFileSync(path.join(MOBILE_SRC, 'features/profile/components/ai/AiProviderLogo.tsx'), 'utf8')
  assert.equal(aiLogo.includes('MascotVectorRig'), true, 'AiProviderLogo deve usar MascotVectorRig para Servidor do Vito')
  assert.equal(aiLogo.includes('useTheme'), true, 'AiProviderLogo deve adaptar o ícone do Vito ao tema')

  const catalog = fs.readFileSync(path.join(MOBILE_SRC, 'features/bots/components/BotsCatalogTab.tsx'), 'utf8')
  assert.equal(catalog.includes('tileCell'), true, 'BotsCatalogTab deve manter grid de 2 colunas via tileCell')
  assert.equal(catalog.includes('ProtoUiIcon'), true, 'BotsCatalogTab deve usar ProtoUiIcon')
})
