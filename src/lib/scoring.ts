// Points for all three games on one scale: a finished round is worth 750, plus up to 540 for speed,
// so a perfect fast round is about 1,290 whichever game it was. Mistakes and hints cost seconds.

export const HINT_PENALTY_SECONDS = 5
export const MISTAKE_PENALTY_SECONDS = 3

const FINISHED_POINTS = 750
const PAR_SECONDS = 90
const POINTS_PER_SECOND = 6

interface Round {
  /** Time on the clock, before penalties. */
  seconds: number
  hints?: number
}

/** The seconds that mistakes and hints add to a round. */
export function penaltySeconds({ mistakes = 0, hints = 0 }: { mistakes?: number; hints?: number }): number {
  return mistakes * MISTAKE_PENALTY_SECONDS + hints * HINT_PENALTY_SECONDS
}

function points(round: Round & { mistakes?: number }): number {
  const total = round.seconds + penaltySeconds(round)
  return FINISHED_POINTS + Math.max(0, Math.round((PAR_SECONDS - total) * POINTS_PER_SECOND))
}

/** Spot the difference: every difference found, wrong taps are the mistakes. */
export function colorsPoints({ seconds, wrongTaps = 0, hints = 0 }: Round & { wrongTaps?: number }): number {
  return points({ seconds, mistakes: wrongTaps, hints })
}

/** Memory match: every pair matched, pairs that did not match are the mistakes. */
export function memoryPoints({ seconds, wrongPairs = 0, hints = 0 }: Round & { wrongPairs?: number }): number {
  return points({ seconds, mistakes: wrongPairs, hints })
}

/** Number grid: every cell filled, wrong entries are the mistakes. */
export function numbersPoints({ seconds, wrongEntries = 0, hints = 0 }: Round & { wrongEntries?: number }): number {
  return points({ seconds, mistakes: wrongEntries, hints })
}
