import { GAMES, type GameId } from '../data/games.ts'
import { dailyCount, dailyDoneCount, dailyOrder } from '../state/store.ts'
import type { AppState } from '../state/types.ts'

/** Title for the game header: "Game 3 of 4 · Spot The Difference", or "Practice · ..." once played today. */
export function gameHeading(state: AppState, id: GameId) {
  const game = GAMES[id]
  if (state.todayResults[id] || !dailyOrder(state).includes(id)) {
    return { daily: false, long: `Practice · ${game.title}`, short: `Practice · ${game.name}` }
  }
  const n = dailyDoneCount(state) + 1
  const of = dailyCount(state)
  return { daily: true, long: `Game ${n} of ${of} · ${game.title}`, short: `${n} of ${of} · ${game.name}` }
}
