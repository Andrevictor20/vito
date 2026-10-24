import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { loginPalette } from '../loginPalette'

describe('loginPalette — cores do protótipo vito-login-v2.html', () => {
  it('tema claro usa os tokens do HTML', () => {
    const p = loginPalette(false)
    assert.equal(p.acc, '#0b9a5f')
    assert.equal(p.bg, '#ffffff')
    assert.equal(p.surf, '#f2f4f3')
    assert.equal(p.ink, '#17191b')
    assert.equal(p.muted, '#69706d')
    assert.equal(p.line, '#d2d7d4')
    assert.equal(p.accent, '#1fb97a')
    assert.equal(p.blue, '#2b7fd4')
    assert.equal(p.blueBg, '#e4effb')
    assert.equal(p.red, '#d6355a')
    assert.equal(p.redBg, '#fde6ec')
    assert.equal(p.orange, '#d9681a')
    assert.equal(p.orangeBg, '#fbebdb')
    assert.equal(p.purple, '#7a4fe0')
    assert.equal(p.purpleBg, '#eee8fd')
    assert.equal(p.wa, '#25d366')
  })

  it('tema escuro usa os tokens data-theme=dark do HTML', () => {
    const p = loginPalette(true)
    assert.equal(p.acc, '#34d399')
    assert.equal(p.page, '#050606')
    assert.equal(p.bg, '#0d0f10')
    assert.equal(p.surf, '#191c1e')
    assert.equal(p.ink, '#f1f3f2')
    assert.equal(p.muted, '#98a19d')
    assert.equal(p.line, '#2c3134')
    assert.equal(p.blue, '#5aa2ee')
    assert.equal(p.red, '#ff6b8a')
    assert.equal(p.orange, '#ff9a52')
    assert.equal(p.purple, '#a58bff')
  })
})
