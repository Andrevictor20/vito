export function buildReelItems(
  target: string,
  previous: string,
  allWords: readonly string[],
  pick: () => number = Math.random,
): string[] {
  const pool = allWords.filter((word) => word !== target && word !== previous)
  const fillers: string[] = []
  while (fillers.length < 3 && pool.length > 0) {
    const index = Math.floor(pick() * pool.length)
    fillers.push(pool[index] ?? pool[0])
  }
  return previous ? [target, ...fillers, previous] : [target, ...fillers]
}

export const REEL_LINE_EM = 1.25
export const REEL_DURATION_MS = 950
export const REEL_SETTLE_MS = 1020
