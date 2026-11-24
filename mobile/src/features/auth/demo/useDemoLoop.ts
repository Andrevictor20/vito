import { useState, useEffect, useRef, useCallback } from 'react'
import { AppState, AppStateStatus, AccessibilityInfo } from 'react-native'
import {
  createDemoMachine,
  initialState,
  type DemoLoopState,
  type DemoMachine,
  type DemoPhase,
  DEMO_TIMING,
} from './demoMachine'

export type { DemoPhase, DemoLoopState, DemoMachine }
export { DEMO_TIMING }

export function useDemoLoop() {
  const [state, setState] = useState<DemoLoopState>(initialState())
  const machineRef = useRef<DemoMachine | null>(null)
  const reduceMotionRef = useRef(false)
  const appStateRef = useRef<AppStateStatus>('active')

  if (!machineRef.current) {
    const m = createDemoMachine()
    m.subscribe(setState)
    machineRef.current = m
  }
  const machine = machineRef.current

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      reduceMotionRef.current = enabled
      machine.setReduceMotion(enabled)
    })
  }, [])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const wasActive = appStateRef.current === 'active'
      appStateRef.current = next
      if (next === 'background' && wasActive) {
        machine.pause()
      } else if (next === 'active' && !wasActive) {
        machine.resume()
      }
    })
    machine.resume()
    return () => {
      sub.remove()
      machine.dispose()
    }
  }, [])

  const advanceScene = useCallback(() => {
    machine.advanceScene()
  }, [machine])

  const goToScene = useCallback(
    (index: number) => {
      machine.goToScene(index)
    },
    [machine],
  )

  return {
    state,
    advanceScene,
    goToScene,
    reduceMotion: reduceMotionRef.current,
  }
}
