import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseBoxShadow,
  parseColor,
  parseCssDeclarations,
  parseCubicBezier,
  parseFontShorthand,
  parseLength,
  parseLetterSpacing,
  parseLineHeight,
  resolveVars,
} from '../cssToRn'

const TOKENS = {
  '--bg': '#ffffff',
  '--ink': '#0a0a0a',
  '--blue': '#0a7cff',
  '--purple': '#7a4fe0',
  '--shadow': '0 4px 14px rgba(0, 0, 0, .08)',
  '--ease-q': 'cubic-bezier(.22, 1, .36, 1)',
}

describe('cssToRn — tradutor CSS -> React Native', () => {
  it('resolveVars resolve recursivamente com fallback', () => {
    assert.equal(resolveVars('var(--blue)', TOKENS), '#0a7cff')
    assert.equal(resolveVars('var(--missing, #123456)', TOKENS), '#123456')
  })

  it('parseColor resolve hex, rgba e color-mix(in srgb, ...)', () => {
    assert.equal(parseColor('#fff', TOKENS), '#ffffff')
    assert.equal(parseColor('color-mix(in srgb, var(--blue) 10%, var(--bg))', TOKENS), '#e7f2ff')
    assert.equal(parseColor('color-mix(in srgb, var(--blue) 38%, transparent)', TOKENS), 'rgba(10, 124, 255, 0.38)')
  })

  it('parseLength, parseLetterSpacing e parseLineHeight convertem unidades', () => {
    assert.equal(parseLength('28px'), 28)
    assert.equal(parseLength('1.25em', 27), 33.75)
    assert.equal(parseLetterSpacing('-.045em', 46), -2.07)
    assert.equal(parseLineHeight('1.35', 20), 27)
  })

  it('parseFontShorthand extrai weight, size, lineHeight e family', () => {
    assert.deepEqual(parseFontShorthand('500 46px/1 Geist,system-ui,sans-serif'), {
      fontWeight: '500',
      fontSize: 46,
      lineHeight: 46,
      fontFamily: 'Geist',
    })
    assert.deepEqual(parseFontShorthand('700 20px Geist,system-ui'), {
      fontWeight: '700',
      fontSize: 20,
      fontFamily: 'Geist',
    })
  })

  it('parseBoxShadow distingue sombra normal de inset lateral', () => {
    const drop = parseBoxShadow('var(--shadow)', TOKENS)
    assert.equal(drop.shadow?.shadowOffset.height, 4)
    assert.equal(drop.shadow?.shadowOpacity, 0.08)

    const inset = parseBoxShadow('inset 4px 0 0 var(--blue)', TOKENS)
    assert.deepEqual(inset.insetBorder, {
      borderLeftWidth: 4,
      borderLeftColor: '#0a7cff',
    })
  })

  it('parseCubicBezier extrai os 4 pontos', () => {
    assert.deepEqual(parseCubicBezier(TOKENS['--ease-q']), [0.22, 1, 0.36, 1])
  })

  it('parseCssDeclarations traduz uma regra completa do protótipo', () => {
    const res = parseCssDeclarations(
      {
        padding: '10px 14px',
        'border-radius': '18px 18px 4px 18px',
        background: 'var(--ink)',
        color: 'var(--bg)',
        'font-variant-numeric': 'tabular-nums',
      },
      TOKENS,
    )
    assert.deepEqual(res.style, {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderBottomRightRadius: 4,
      borderBottomLeftRadius: 18,
      backgroundColor: '#0a0a0a',
      color: '#ffffff',
      fontVariant: ['tabular-nums'],
    })
  })
})
