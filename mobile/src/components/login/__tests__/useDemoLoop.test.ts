import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  createDemoMachine,
  initialState,
  DEMO_TIMING,
  type DemoLoopState,
} from '../demoMachine'

describe('useDemoLoop — máquina de estados da demonstração', () => {
  it('inicia na cena 0 com fase showing-user e nada digitado', () => {
    const m = createDemoMachine()
    const s = m.state
    assert.equal(s.sceneIndex, 0)
    assert.equal(s.phase, 'showing-user')
    assert.equal(s.userTyped, '')
    assert.equal(s.userComplete, false)
    assert.equal(s.vitoVisible, false)
    assert.equal(s.cardVisible, false)
    assert.equal(s.dotsVisible, false)
    m.dispose()
  })

  it('initialState() equivale ao estado inicial da máquina', () => {
    const m = createDemoMachine()
    assert.deepEqual(m.state, initialState())
    m.dispose()
  })

  it('DEMO_TIMING respeita os valores do protótipo (ms)', () => {
    assert.equal(DEMO_TIMING.userAppearMs, 350)
    assert.equal(DEMO_TIMING.typeCharMs, 36)
    assert.equal(DEMO_TIMING.thinkingDelayMs, 450)
    assert.equal(DEMO_TIMING.dotsMs, 1000)
    assert.equal(DEMO_TIMING.vitoFadeMs, 400)
    assert.equal(DEMO_TIMING.cardDelayMs, 250)
    assert.equal(DEMO_TIMING.cardFadeMs, 450)
    assert.equal(DEMO_TIMING.pauseMs, 3300)
  })

  it('advanceScene avança a cena e reinicia a fase', () => {
    const m = createDemoMachine()
    m.advanceScene()
    let s = m.state
    assert.equal(s.sceneIndex, 1)
    assert.equal(s.phase, 'showing-user')
    assert.equal(s.userTyped, '')

    m.advanceScene()
    s = m.state
    assert.equal(s.sceneIndex, 2)

    m.advanceScene()
    s = m.state
    assert.equal(s.sceneIndex, 3)

    // volta ao zero após a última
    m.advanceScene()
    s = m.state
    assert.equal(s.sceneIndex, 0)
    m.dispose()
  })

  it('goToScene define cena específica e reinicia fase', () => {
    const m = createDemoMachine()
    m.advanceScene()
    m.goToScene(0)
    const s = m.state
    assert.equal(s.sceneIndex, 0)
    assert.equal(s.phase, 'showing-user')
    m.dispose()
  })

  it('reduceMotion desativa a sequência automática de animação', () => {
    const m = createDemoMachine()
    m.setReduceMotion(true)
    // Em reduzir movimento não há timers criados; o estado inicial persiste.
    assert.equal(m.state.sceneIndex, 0)
    assert.equal(m.state.phase, 'showing-user')
    m.dispose()
  })

  it('todas as cenas têm estado inicial válido', () => {
    for (let i = 0; i < 4; i += 1) {
      const m = createDemoMachine()
      for (let j = 0; j < i; j += 1) m.advanceScene()
      const s: DemoLoopState = m.state
      assert.ok(s.scene, `cena ${i}`)
      assert.equal(s.sceneIndex, i)
      assert.equal(s.phase, 'showing-user')
      m.dispose()
    }
  })
})
