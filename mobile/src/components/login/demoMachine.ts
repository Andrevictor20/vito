import { DEMO_SCENES, DemoScene, nextSceneIndex } from './demoScenes'

export type DemoPhase =
  | 'showing-user'
  | 'typing-user'
  | 'thinking'
  | 'showing-vito'
  | 'showing-card'
  | 'pausing'

export interface DemoLoopState {
  sceneIndex: number
  scene: DemoScene
  phase: DemoPhase
  userTyped: string
  userComplete: boolean
  vitoVisible: boolean
  cardVisible: boolean
  dotsVisible: boolean
}

/** Tempos da sequência, em ms, conforme protótipo (seção 4). */
export const DEMO_TIMING = {
  userAppearMs: 350,
  typeCharMs: 36,
  thinkingDelayMs: 450,
  dotsMs: 1000,
  vitoFadeMs: 400,
  cardDelayMs: 250,
  cardFadeMs: 450,
  pauseMs: 3300,
  oldFadeOutMs: 400,
  slideUpMs: 500,
} as const

function initialStateAt(sceneIndex: number): DemoLoopState {
  const scene = DEMO_SCENES[sceneIndex]
  return {
    sceneIndex,
    scene,
    phase: 'showing-user',
    userTyped: '',
    userComplete: false,
    vitoVisible: false,
    cardVisible: false,
    dotsVisible: false,
  }
}

export function initialState(): DemoLoopState {
  return initialStateAt(0)
}

export type DemoMachine = ReturnType<typeof createDemoMachine>

/**
 * Máquina de estados pura da demonstração. Sem dependências de React Native:
 * testável com timers falsos.
 */
export function createDemoMachine() {
  let state = initialState()
  let reduceMotion = false
  let timers: NodeJS.Timeout[] = []
  const listeners = new Set<(s: DemoLoopState) => void>()

  const clearTimers = () => {
    timers.forEach((t) => clearTimeout(t))
    timers = []
  }

  const schedule = (cb: () => void, ms: number) => {
    const t = setTimeout(cb, ms)
    timers.push(t)
    return t
  }

  const emit = () => {
    listeners.forEach((fn) => fn(state))
  }

  const setPhase = (partial: Partial<DemoLoopState>) => {
    state = { ...state, ...partial }
    emit()
  }

  const goToScene = (index: number) => {
    clearTimers()
    state = initialStateAt(index)
    emit()
    if (!reduceMotion) startSceneSequence()
  }

  const advanceScene = () => {
    clearTimers()
    state = initialStateAt(nextSceneIndex(state.sceneIndex))
    emit()
    if (!reduceMotion) startSceneSequence()
  }

  const typeNextChar = () => {
    const { userText } = state.scene
    if (state.userTyped.length < userText.length) {
      setPhase({ userTyped: userText.slice(0, state.userTyped.length + 1) })
      schedule(typeNextChar, DEMO_TIMING.typeCharMs)
    } else {
      setPhase({ userComplete: true })
      schedule(startThinking, DEMO_TIMING.thinkingDelayMs)
    }
  }

  const startThinking = () => {
    setPhase({ dotsVisible: true, phase: 'thinking' })
    schedule(() => {
      setPhase({ dotsVisible: false, phase: 'showing-vito', vitoVisible: true })
      schedule(() => {
        setPhase({ phase: 'showing-card', cardVisible: true })
        schedule(advanceScene, DEMO_TIMING.pauseMs)
      }, DEMO_TIMING.cardDelayMs)
    }, DEMO_TIMING.dotsMs)
  }

  function startSceneSequence() {
    setPhase({ phase: 'showing-user' })
    schedule(() => {
      setPhase({ phase: 'typing-user' })
      typeNextChar()
    }, DEMO_TIMING.userAppearMs)
  }

  const pause = () => {
    clearTimers()
  }

  const resume = () => {
    if (reduceMotion) return
    clearTimers()
    if (state.phase === 'pausing') {
      advanceScene()
    } else {
      startSceneSequence()
    }
  }

  const dispose = () => {
    clearTimers()
    listeners.clear()
  }

  const subscribe = (fn: (s: DemoLoopState) => void) => {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  return {
    get state() {
      return state
    },
    get reduceMotion() {
      return reduceMotion
    },
    setReduceMotion(value: boolean) {
      reduceMotion = value
    },
    goToScene,
    advanceScene,
    pause,
    resume,
    dispose,
    subscribe,
  }
}
