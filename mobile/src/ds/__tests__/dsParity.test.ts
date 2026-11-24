import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tokensJson from '../../prototype/tokens.json'
import keyframesJson from '../../prototype/keyframes.json'
import iconsJson from '../../prototype/icons.json'
import { resolveRule, token } from '../tokens'
import { SECTION_TRANSITION_SPECS } from '../transitionSpecs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.resolve(__dirname, '../..')

describe('Onda 3B — Design System literal + ícones + transições', () => {
  it('tokens claro/escuro batem com tokens.json', () => {
    assert.equal(token('--bg', false), '#ffffff')
    assert.equal(token('--ink', false), '#0a0a0a')
    assert.equal(token('--blue', false), tokensJson.light['--blue'])
    assert.equal(token('--bg', true), tokensJson.dark['--bg'])
    assert.equal(token('--ink', true), tokensJson.dark['--ink'])
    assert.equal(token('--surf', true), tokensJson.dark['--surf'])
  })

  it('resolveRule aplica cascata CSS fiel para primitivos do protótipo', () => {
    const card2 = resolveRule('.card2', false).style
    assert.equal(card2.borderRadius, 20)
    assert.equal(card2.padding, 16)
    assert.equal(card2.borderWidth, 1)

    const big = resolveRule('.big', false).style
    assert.equal(big.fontSize, 34)
    assert.equal(big.fontFamily, 'Geist')
    assert.equal(big.letterSpacing, -1.02)

    const input = resolveRule('.ai-key', false).style
    assert.equal(input.height, 46)
    assert.equal(input.borderRadius, 14)
    assert.equal(input.fontFamily, 'Geist')
  })

  it('SECTION_TRANSITION_SPECS bate 1:1 com keyframes.json', () => {
    assert.equal(SECTION_TRANSITION_SPECS.tab.enter.duration, 360)
    assert.equal(SECTION_TRANSITION_SPECS.tab.enter.delay, 50)
    assert.equal(SECTION_TRANSITION_SPECS.tab.enter.fromY, 6)
    assert.equal(SECTION_TRANSITION_SPECS.tab.leave.duration, 170)
    assert.deepEqual(SECTION_TRANSITION_SPECS.tab.enter.keyframe, keyframesJson.trTab)

    assert.equal(SECTION_TRANSITION_SPECS.push.enter.duration, 440)
    assert.equal(SECTION_TRANSITION_SPECS.push.enter.fromX, 30)
    assert.equal(SECTION_TRANSITION_SPECS.push.leave.duration, 300)
    assert.equal(SECTION_TRANSITION_SPECS.push.leave.toX, -24)

    assert.equal(SECTION_TRANSITION_SPECS.pop.enter.duration, 400)
    assert.equal(SECTION_TRANSITION_SPECS.pop.enter.fromX, -22)
    assert.equal(SECTION_TRANSITION_SPECS.pop.leave.duration, 300)
    assert.equal(SECTION_TRANSITION_SPECS.pop.leave.toX, 30)
  })

  it('ds/ e icons/ são 100% isolados do theme/ legado', () => {
    for (const dir of ['ds', 'icons']) {
      const files = fs
        .readdirSync(path.join(srcDir, dir))
        .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
      for (const f of files) {
        const content = fs.readFileSync(path.join(srcDir, dir, f), 'utf8')
        assert.ok(!content.includes('../theme/'), `${dir}/${f} não pode importar ../theme/`)
      }
    }
  })

  it('icons.json preserva logos reais e ícones SVG completos', () => {
    assert.equal(Object.keys(iconsJson.LOGO).length, 10)
    assert.equal(Object.keys(iconsJson.AILOGO).length, 7)
    assert.equal(Object.keys(iconsJson.BANK_ICON).length, 8)
    assert.equal(iconsJson.inlineIcons.length, 72)
    assert.equal(iconsJson.symbols.vito.tree.tag, 'symbol')
    assert.equal(iconsJson.SPARK.tag, 'svg')
    assert.equal(iconsJson.SPK.tag, 'svg')
  })

  it('AppRoot registra Geist e Geist Mono reais (sem alias para Inter)', () => {
    const appRoot = fs.readFileSync(path.join(srcDir, 'AppRoot.tsx'), 'utf8')
    assert.ok(appRoot.includes('@expo-google-fonts/geist'))
    assert.ok(appRoot.includes('@expo-google-fonts/geist-mono'))
    assert.ok(!appRoot.includes('Geist: Inter_400Regular'))
    assert.ok(!appRoot.includes("'Geist Mono': Inter_500Medium"))
  })
})
