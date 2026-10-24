import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  createDemoMachine,
  initialState,
  DEMO_TIMING,
  type DemoLoopState,
} from '../demoMachine'

describe('demoMachine — máquina de estados da demonstração', () => {
  it('inicia na cena 0 com fase showing-user e nada digitado', () => {
    const m = createDemoMachine()
    try {
      const s = m.state
      assert.equal(s.sceneIndex, 0)
      assert.equal(s.phase, 'showing-user')
      assert.equal(s.userTyped, '')
      assert.equal(s.userComplete, false)
      assert.equal(s.vitoVisible, false)
      assert.equal(s.cardVisible, false)
      assert.equal(s.dotsVisible, false)
    } finally {
      m.dispose()
    }
  })

  it('initialState() equivale ao estado inicial da máquina', () => {
    const m = createDemoMachine()
    try {
      assert.deepEqual(m.state, initialState())
    } finally {
      m.dispose()
    }
  })

  it('DEMO_TIMING respeita os valores do HTML (ms)', () => {
    assert.equal(DEMO_TIMING.userAppearMs, 350)
    assert.equal(DEMO_TIMING.typeCharMs, 36)
    assert.equal(DEMO_TIMING.thinkingDelayMs, 450)
    assert.equal(DEMO_TIMING.dotsMs, 1000)
    assert.equal(DEMO_TIMING.vitoFadeMs, 400)
    assert.equal(DEMO_TIMING.cardDelayMs, 250)
    assert.equal(DEMO_TIMING.cardFadeMs, 450)
    assert.equal(DEMO_TIMING.pauseMs, 3300)
  })

  it('advanceScene cicla as seis cenas e reinicia a fase', () => {
    const m = createDemoMachine()
    try {
      for (let i = 1; i <= 5; i += 1) {
        m.advanceScene()
        assert.equal(m.state.sceneIndex, i)
        assert.equal(m.state.phase, 'showing-user')
        assert.equal(m.state.userTyped, '')
      }
      m.advanceScene()
      assert.equal(m.state.sceneIndex, 0)
    } finally {
      m.dispose()
    }
  })

  it('goToScene define cena específica e reinicia fase', () => {
    const m = createDemoMachine()
    try {
      m.advanceScene()
      m.goToScene(0)
      const s = m.state
      assert.equal(s.sceneIndex, 0)
      assert.equal(s.phase, 'showing-user')
    } finally {
      m.dispose()
    }
  })

  it('reduceMotion desativa a sequência automática de animação', () => {
    const m = createDemoMachine()
    try {
      m.setReduceMotion(true)
      assert.equal(m.state.sceneIndex, 0)
      assert.equal(m.state.phase, 'showing-user')
    } finally {
      m.dispose()
    }
  })

  it('todas as cenas têm estado inicial válido', () => {
    for (let i = 0; i < 6; i += 1) {
      const m = createDemoMachine()
      try {
        for (let j = 0; j < i; j += 1) m.advanceScene()
        const s: DemoLoopState = m.state
        assert.ok(s.scene, `cena ${i}`)
        assert.equal(s.sceneIndex, i)
        assert.equal(s.phase, 'showing-user')
      } finally {
        m.dispose()
      }
    }
  })
})
