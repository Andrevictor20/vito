import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  AREA_DRAW_MS,
  AREA_FILL_DELAY_MS,
  AREA_FILL_MS,
  BAR_RISE_MS,
  computeAreaPath,
  computeBarRects,
  computeDonutSegments,
  DONUT_GAP,
  DONUT_R,
  DONUT_SEG_MS,
  DONUT_SIZE,
  DONUT_STAGGER_BASE_MS,
  DONUT_STAGGER_STEP_MS,
  DONUT_STROKE,
  DOT_POP_DELAY_MS,
  DOT_POP_MS,
  SUMMARY_LINE_DELAY_MS,
  SUMMARY_LINE_FADE_MS,
  TK_RING_R,
  TK_RING_SIZE,
} from '../chartSpecs'

describe('Onda 3C — Gráficos copiados do protótipo (dinâmicos)', () => {
  it('constantes de tamanho e animação batem com o HTML/CSS', () => {
    assert.equal(DONUT_R, 44)
    assert.equal(DONUT_GAP, 2)
    assert.equal(DONUT_SIZE, 176)
    assert.equal(DONUT_STROKE, 14)
    assert.equal(DONUT_SEG_MS, 720)
    assert.equal(DONUT_STAGGER_BASE_MS, 35)
    assert.equal(DONUT_STAGGER_STEP_MS, 60)
    assert.equal(BAR_RISE_MS, 560)
    assert.equal(AREA_DRAW_MS, 780)
    assert.equal(AREA_FILL_MS, 500)
    assert.equal(AREA_FILL_DELAY_MS, 220)
    assert.equal(DOT_POP_MS, 360)
    assert.equal(DOT_POP_DELAY_MS, 540)
    assert.equal(TK_RING_SIZE, 56)
    assert.equal(TK_RING_R, 22)
    assert.equal(SUMMARY_LINE_FADE_MS, 1000)
    assert.equal(SUMMARY_LINE_DELAY_MS, 600)
  })

  it('computeDonutSegments trata vazio, 1 fatia e múltiplas fatias', () => {
    assert.deepEqual(computeDonutSegments([]), [])
    assert.deepEqual(computeDonutSegments([{ label: 'Zero', value: 0 }]), [])

    const segs = computeDonutSegments([
      { label: 'Moradia', value: 1500 },
      { label: 'Mercado', value: 500 },
    ])
    assert.equal(segs.length, 2)
    assert.equal(segs[0].dashOffset, 0)
    assert.ok(segs[1].dashOffset < 0)
  })

  it('computeAreaPath trata vazio, 1 ponto e série completa', () => {
    const empty = computeAreaPath([])
    assert.equal(empty.linePath, '')
    assert.equal(empty.lastPoint, null)

    const one = computeAreaPath([100])
    assert.equal(one.points.length, 1)
    assert.ok(one.linePath.startsWith('M'))

    const many = computeAreaPath([10, 20, 30, 50])
    assert.equal(many.points.length, 4)
    assert.ok(many.fillPath.endsWith('Z'))
    assert.ok(many.approxLength > 0)
  })

  it('computeBarRects trata vazio, highlight e step dinâmico (>10 barras)', () => {
    assert.equal(computeBarRects([]).rects.length, 0)

    const short = computeBarRects([10, 20, 30], 320, 110, 1)
    assert.equal(short.rects.length, 3)
    assert.equal(short.rects[1].highlighted, true)
    assert.equal(short.rects[1].delayMs, 50)

    const long = computeBarRects(Array.from({ length: 12 }, (_, i) => i + 1))
    assert.equal(long.rects[1].delayMs, 16)
  })
})
