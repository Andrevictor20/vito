import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildReelItems, REEL_DURATION_MS, REEL_SETTLE_MS } from '../headlineReel'
import { DEMO_HEADLINES } from '../demoScenes'

describe('headlineReel — roleta do título', () => {
  it('monta [alvo, 4 fillers, anterior] sem repetir alvo nem anterior', () => {
    let i = 0
    const picks = [0, 0, 0, 0]
    const items = buildReelItems(
      'organizar a agenda',
      'cuidar do WhatsApp',
      DEMO_HEADLINES,
      () => picks[i++] ?? 0,
    )
    assert.equal(items[0], 'organizar a agenda')
    assert.equal(items[items.length - 1], 'cuidar do WhatsApp')
    assert.equal(items.length, 6)
    for (const filler of items.slice(1, 5)) {
      assert.notEqual(filler, 'organizar a agenda')
      assert.notEqual(filler, 'cuidar do WhatsApp')
      assert.ok(DEMO_HEADLINES.includes(filler as (typeof DEMO_HEADLINES)[number]))
    }
  })

  it('tempos da roleta batem com o HTML', () => {
    assert.equal(REEL_DURATION_MS, 1150)
    assert.equal(REEL_SETTLE_MS, 1250)
  })
})
