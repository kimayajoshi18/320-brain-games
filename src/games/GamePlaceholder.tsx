import { useState } from 'react'
import { useNavigate } from 'react-router'
import GameArt from '../components/GameArt.tsx'
import TaskHeader from '../components/TaskHeader.tsx'
import { GAMES, type GameId } from '../data/games.ts'
import { formatDuration, formatNumber } from '../lib/format.ts'
import { createRandom } from '../lib/random.ts'
import { useAppState } from '../state/context.ts'
import type { GameResult } from '../state/types.ts'
import ExitLink from './ExitLink.tsx'
import { gameHeading } from './heading.ts'
import './game.css'

/** A believable made-up result, so the flow after a game can be tried before the game exists. */
function sampleResult(gameId: GameId, seed: string, playedAt: string): GameResult {
  const rand = createRandom(seed)
  if (gameId === 'numbers') {
    const time = rand.int(100, 180)
    return {
      gameId,
      points: 2000 - time * 7,
      durationSec: time,
      stats: [formatDuration(time), rand.next() < 0.6 ? 'No mistakes' : `${rand.int(1, 3)} mistakes`],
      highlight: formatDuration(time),
      playedAt,
    }
  }
  const moves = rand.int(12, 20)
  const time = rand.int(40, 70)
  const points = 1500 - moves * 20 - time * 3 + rand.int(0, 300)
  return {
    gameId,
    points,
    durationSec: time,
    stats: [`${moves} moves`, formatDuration(time), `${rand.int(70, 95)}% accuracy`],
    highlight: formatNumber(points),
    playedAt,
  }
}

/** Stand-in for Memory and Numbers, which don't have wireframes yet. */
export default function GamePlaceholder({ gameId }: { gameId: GameId }) {
  const { state, actions } = useAppState()
  const navigate = useNavigate()
  const [heading] = useState(() => gameHeading(state, gameId))
  const game = GAMES[gameId]

  const finish = () => {
    actions.recordResult(sampleResult(gameId, `${gameId}:${state.today}:${state.gamesPlayed}`, state.today))
    navigate('/results')
  }

  return (
    <div className="game">
      <TaskHeader
        left={<ExitLink />}
        title={
          <>
            <span className="long">{heading.long}</span>
            <span className="short">{heading.short}</span>
          </>
        }
        right="0:00"
      />
      <main className="game-body">
        <div className="panel game-placeholder">
          <GameArt game={gameId} />
          <h2>{game.title} is coming soon</h2>
          <p className="muted">
            This game hasn't been designed yet. Finish with a sample score to try the rest of the flow.
          </p>
          <button type="button" className="btn btn-primary" onClick={finish}>
            Finish with a sample score
          </button>
        </div>
      </main>
    </div>
  )
}
