import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import iconsJson from '../../prototype/icons.json'
import { darkColors, lightColors } from '../tokens'
import { MOTION_CURVES, SCREEN_TRANSITIONS } from '../motion'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.resolve(__dirname, '../..')

describe('Onda 3 — Design System unificado + ícones + transições', () => {
  it('tokens claro/escuro mantêm paleta canônica v5', () => {
    assert.equal(lightColors.bg, '#ffffff')
    assert.equal(lightColors.ink, '#0a0a0a')
    assert.equal(lightColors.blue, '#0a7cff')
    assert.equal(darkColors.bg, '#0a0a0a')
    assert.equal(darkColors.ink, '#f5f5f5')
    assert.equal(darkColors.surf, '#171717')
  })

  it('SCREEN_TRANSITIONS e MOTION_CURVES preservam especificações 1:1', () => {
    assert.deepEqual(MOTION_CURVES.q, [0.22, 1, 0.36, 1])
    assert.deepEqual(MOTION_CURVES.std, [0.2, 0.8, 0.2, 1])

    assert.equal(SCREEN_TRANSITIONS.tab.enterMs, 360)
    assert.equal(SCREEN_TRANSITIONS.tab.enterDelayMs, 50)
    assert.equal(SCREEN_TRANSITIONS.tab.enterOffset.y, 6)
    assert.equal(SCREEN_TRANSITIONS.tab.leaveMs, 170)

    assert.equal(SCREEN_TRANSITIONS.push.enterMs, 440)
    assert.equal(SCREEN_TRANSITIONS.push.enterOffset.x, 30)
    assert.equal(SCREEN_TRANSITIONS.push.leaveMs, 300)
    assert.equal(SCREEN_TRANSITIONS.push.leaveOffset.x, -24)

    assert.equal(SCREEN_TRANSITIONS.pop.enterMs, 400)
    assert.equal(SCREEN_TRANSITIONS.pop.enterOffset.x, -22)
    assert.equal(SCREEN_TRANSITIONS.pop.leaveMs, 300)
    assert.equal(SCREEN_TRANSITIONS.pop.leaveOffset.x, 30)
  })

  it('icons.json preserva logos de marca e remove inlineIcons/symbols/SPARK/SPK mortos', () => {
    assert.equal(Object.keys(iconsJson.LOGO).length, 10)
    assert.equal(Object.keys(iconsJson.AILOGO).length, 7)
    assert.equal(Object.keys(iconsJson.BANK_ICON).length, 8)
    assert.equal('inlineIcons' in iconsJson, false)
    assert.equal('symbols' in iconsJson, false)
    assert.equal('SPARK' in iconsJson, false)
    assert.equal('SPK' in iconsJson, false)
  })

  it('AppRoot registra Geist e Geist Mono reais (sem alias para Inter)', () => {
    const appRoot = fs.readFileSync(path.join(srcDir, 'AppRoot.tsx'), 'utf8')
    assert.ok(appRoot.includes('@expo-google-fonts/geist'))
    assert.ok(appRoot.includes('@expo-google-fonts/geist-mono'))
    assert.ok(!appRoot.includes('Geist: Inter_400Regular'))
    assert.ok(!appRoot.includes("'Geist Mono': Inter_500Medium"))
  })
})
