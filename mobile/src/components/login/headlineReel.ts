export function buildReelItems(
  target: string,
  previous: string,
  allWords: readonly string[],
  pick: () => number = Math.random,
): string[] {
  const pool = allWords.filter((word) => word !== target && word !== previous)
  const fillers: string[] = []
  while (fillers.length < 4 && pool.length > 0) {
    const index = Math.floor(pick() * pool.length)
    fillers.push(pool[index] ?? pool[0])
  }
  return [target, ...fillers, previous]
}

export const REEL_LINE_EM = 1.3
export const REEL_DURATION_MS = 1150
export const REEL_SETTLE_MS = 1250
