import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MASCOT_TRACKS } from '../../features/bots/mascot/mascotTracks.generated'
import { MASCOT_PRESETS, resolveSkin } from '../../features/bots/mascot/mascotPalettes'

describe('Onda 3C — Mascote pré-compilado + presets', () => {
  it('todos os 9 estados têm trilhas derivadas do CSS', () => {
    const expectedStates = [
      'idle',
      'blink',
      'gentleman',
      'happy',
      'thinking',
      'curious',
      'surprised',
      'sleeping',
      'dance',
    ] as const

    for (const st of expectedStates) {
      const tracks = MASCOT_TRACKS[st]
      assert.ok(tracks.length > 0, `estado ${st} sem trilhas`)
      for (const t of tracks) {
        assert.ok(t.keyframe.startsWith('anim-'), `${st}.${t.part} keyframe inválido: ${t.keyframe}`)
        assert.ok(t.durationMs > 0, `${st}.${t.part} duração inválida`)
        assert.ok(Object.keys(t.stops).length > 0, `${st}.${t.part} sem stops`)
      }
    }
  })

  it('delays de fx-dot-1/2/3 (thinking) e fx-z-1/2/3 (sleeping) batem com o CSS', () => {
    const thinking = MASCOT_TRACKS.thinking
    const d1 = thinking.find((t) => t.part === 'fx-dot-1')
    const d2 = thinking.find((t) => t.part === 'fx-dot-2')
    const d3 = thinking.find((t) => t.part === 'fx-dot-3')
    assert.equal(d1?.delayMs, 0)
    assert.equal(d2?.delayMs, 250)
    assert.equal(d3?.delayMs, 500)
    assert.equal(d1?.durationMs, 1500)

    const sleeping = MASCOT_TRACKS.sleeping
    const z1 = sleeping.find((t) => t.part === 'fx-z-1')
    const z2 = sleeping.find((t) => t.part === 'fx-z-2')
    const z3 = sleeping.find((t) => t.part === 'fx-z-3')
    assert.equal(z1?.delayMs, 0)
    assert.equal(z2?.delayMs, 1000)
    assert.equal(z3?.delayMs, 2000)
    assert.equal(z1?.durationMs, 3000)
  })

  it('10 MASCOT_PRESETS e resolveSkin funcionam em claro e escuro', () => {
    assert.equal(MASCOT_PRESETS.length, 10)
    const light = resolveSkin(MASCOT_PRESETS[0], false)
    assert.equal(light.fill, '#FFFFFF')
    assert.equal(light.stroke, '#0A0A0A')

    const dark = resolveSkin(MASCOT_PRESETS[0], true)
    assert.equal(dark.fill, '#171717')
    assert.equal(dark.stroke, '#F5F5F5')

    const noir = resolveSkin(MASCOT_PRESETS[1], false)
    assert.equal(noir.fill, '#141416')
    assert.equal(noir.bowtie, '#FF3B30')
  })
})
