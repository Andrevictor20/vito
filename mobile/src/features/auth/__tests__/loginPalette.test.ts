import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { loginPalette } from '../utils/loginPalette'

describe('loginPalette — tokens v5 Light e Dark', () => {
  it('tema claro usa os tokens canônicos v5', () => {
    const p = loginPalette(false)
    assert.equal(p.page, '#efefef')
    assert.equal(p.bg, '#ffffff')
    assert.equal(p.surf, '#f4f4f4')
    assert.equal(p.btn, '#ececec')
    assert.equal(p.ink, '#0a0a0a')
    assert.equal(p.muted, '#595959')
    assert.equal(p.line, '#e6e6e6')
    assert.equal(p.acc, '#0aa55c')
    assert.equal(p.blue, '#0a7cff')
    assert.equal(p.red, '#ff2d46')
    assert.equal(p.purple, '#ff2fa0')
    assert.equal(p.orange, '#f08300')
    assert.equal(p.fin, '#d98a00')
    assert.equal(p.finBarBg, '#c2deff')
    assert.equal(p.wa, '#25d366')
  })

  it('tema escuro usa os tokens canônicos v5', () => {
    const p = loginPalette(true)
    assert.equal(p.page, '#000000')
    assert.equal(p.bg, '#0a0a0a')
    assert.equal(p.surf, '#171717')
    assert.equal(p.btn, '#262626')
    assert.equal(p.ink, '#f5f5f5')
    assert.equal(p.muted, '#8c8c8c')
    assert.equal(p.line, '#262626')
    assert.equal(p.acc, '#2dd17f')
    assert.equal(p.blue, '#3b93ff')
    assert.equal(p.red, '#ff5468')
    assert.equal(p.purple, '#ff55b0')
    assert.equal(p.orange, '#ffa733')
    assert.equal(p.fin, '#ffb938')
    assert.equal(p.finBarBg, '#162c47')
  })
})
