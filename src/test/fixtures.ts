// Shared test data for screen tests.
import type { GameId } from '../data/games.ts'
import { createGuestState } from '../state/store.ts'
import type { AppState, GameResult } from '../state/types.ts'

export const TODAY = '2026-11-02'

export const makeResult = (gameId: GameId, points = 930, overrides: Partial<GameResult> = {}): GameResult => ({
  gameId,
  points,
  durationSec: 60,
  stats: ['5/5 found', '1:00'],
  highlight: String(points),
  playedAt: TODAY,
  ...overrides,
})

/** A fresh player signed in with Google, with no games played yet. */
export function signedInState(): AppState {
  return {
    ...createGuestState(TODAY),
    account: { kind: 'google', profile: { name: 'Ada Lovelace', reminder: '8:00am' } },
    onboarding: { complete: true, focus: [], when: 'morning' },
  }
}