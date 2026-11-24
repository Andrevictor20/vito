import keyframesData from '../prototype/keyframes.json'

export type SectionTransitionMode = 'tab' | 'push' | 'pop'

export const SECTION_TRANSITION_SPECS = {
  tab: {
    enter: { duration: 360, delay: 50, keyframe: keyframesData.trTab, fromX: 0, fromY: 6 },
    leave: { duration: 170, delay: 0, keyframe: keyframesData.lvTab, toX: 0, toY: 0 },
  },
  push: {
    enter: { duration: 440, delay: 0, keyframe: keyframesData.trPush, fromX: 30, fromY: 0 },
    leave: {
      duration: 300,
      delay: 0,
      keyframe: keyframesData.lvPush,
      toX: -24,
      toY: 0,
      bezier: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
  },
  pop: {
    enter: { duration: 400, delay: 0, keyframe: keyframesData.trPop, fromX: -22, fromY: 0 },
    leave: {
      duration: 300,
      delay: 0,
      keyframe: keyframesData.lvPop,
      toX: 30,
      toY: 0,
      bezier: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
  },
} as const
