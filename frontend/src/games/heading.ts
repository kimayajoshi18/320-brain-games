import { GAMES, type GameId } from '../data/games.ts'
import { dailyDoneCount } from '../state/store.ts'
import type { AppState } from '../state/types.ts'

/** Title for the game header: "Game 3 of 3 · Spot The Difference", or "Practice · ..." once played today. */
export function gameHeading(state: AppState, id: GameId) {
  const game = GAMES[id]
  if (state.todayResults[id]) {
    return { daily: false, long: `Practice · ${game.title}`, short: `Practice · ${game.name}` }
  }
  const n = dailyDoneCount(state) + 1
  return { daily: true, long: `Game ${n} of 3 · ${game.title}`, short: `${n} of 3 · ${game.name}` }
}
