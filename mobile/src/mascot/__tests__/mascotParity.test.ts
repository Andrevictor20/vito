import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import keyframesJson from '../../prototype/keyframes.json'
import { MASCOT_PRESETS, MASCOT_TRACKS, resolveMascotSkin } from '../mascotSpecs'

describe('Onda 3C — Mascote derivado de keyframes.json + presets', () => {
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
        assert.ok(t.keyframe in keyframesJson, `${t.keyframe} ausente em keyframes.json`)
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

  it('10 MASCOT_PRESETS e resolveMascotSkin funcionam em claro e escuro', () => {
    assert.equal(MASCOT_PRESETS.length, 10)
    const light = resolveMascotSkin(MASCOT_PRESETS[0], false)
    assert.equal(light.fill, '#FFFFFF')
    assert.equal(light.stroke, '#0A0A0A')

    const dark = resolveMascotSkin(MASCOT_PRESETS[0], true)
    assert.equal(dark.fill, '#171717')
    assert.equal(dark.stroke, '#F5F5F5')

    const noir = resolveMascotSkin(MASCOT_PRESETS[1], false)
    assert.equal(noir.fill, '#141416')
    assert.equal(noir.bowtie, '#FF3B30')
  })
})
