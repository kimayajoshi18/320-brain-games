import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import TaskHeader from '../components/TaskHeader.tsx'
import { GAMES } from '../data/games.ts'
import { formatNumber, plural } from '../lib/format.ts'
import { useAppState } from '../state/context.ts'
import { currentStreak, dailyDoneCount, nextDailyGame } from '../state/store.ts'
import type { GameResult } from '../state/types.ts'
import './Results.css'

const isSameResult = (a: GameResult, b: GameResult) =>
  a.playedAt === b.playedAt && a.points === b.points && a.durationSec === b.durationSec

export default function Results() {
  const { state, actions } = useAppState()
  const navigate = useNavigate()
  const [shareStatus, setShareStatus] = useState<string | null>(null)

  const last = state.lastResult
  if (!last) return <Navigate to="/home" replace />

  const { result, newBest, daily } = last
  const game = GAMES[result.gameId]
  const done = dailyDoneCount(state)
  const next = nextDailyGame(state)
  const finishedToday = daily && done === 3 && state.completedDays.includes(state.today)
  const top = state.topScores[result.gameId]
  const signedIn = state.account.kind === 'google'

  const share = async () => {
    const text = `I scored ${formatNumber(result.points)} points in ${game.title} on Puzzlr today.`
    const url = window.location.origin
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Puzzlr', text, url })
        return
      }
      await navigator.clipboard.writeText(`${text} ${url}`)
      setShareStatus('Copied to clipboard')
    } catch {
      // Closing the share sheet rejects; that's fine.
    }
  }

  return (
    <div className="results">
      <TaskHeader
        left={
          <Link to="/home" className="task-header-close" aria-label="Close results">
            ✕<span className="long"> Close</span>
          </Link>
        }
        title={`${game.name} · done`}
        right={<span className="long">{daily ? `${done} of 3 today` : 'Practice'}</span>}
      />

      <main className="results-body">
        <section className="results-main" aria-label="Your score">
          <h2 className="results-points">{formatNumber(result.points)} points</h2>
          {newBest && <span className="badge results-badge">New personal best</span>}

          <div className="results-stats">
            {result.stats.map((stat) => (
              <span key={stat} className="chip">
                {stat}
              </span>
            ))}
          </div>
          <p className="results-stats-inline">{result.stats.slice(0, 2).join(' · ')}</p>

          {finishedToday && (
            <div className="panel panel-accent results-streak" role="status">
              <strong>+1</strong>
              <span>
                All three done. Your streak is now <b>{plural(currentStreak(state), 'day')}</b>.
              </span>
            </div>
          )}

          <div className="panel panel-dark results-why">
            <b className="eyebrow">Why this helps</b>
            <p>{game.why}</p>
          </div>

          <div className="results-actions">
            {next ? (
              <button type="button" className="btn btn-primary" onClick={() => navigate(`/play/${next}`)}>
                Next game
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => navigate('/home')}>
                Back to today
              </button>
            )}
            <button type="button" className="btn btn-outline" onClick={() => navigate(`/play/${result.gameId}`)}>
              Play again
            </button>
            <button type="button" className="btn btn-outline results-share" onClick={share}>
              Share
            </button>
          </div>
          {shareStatus && (
            <p className="muted" role="status">
              {shareStatus}
            </p>
          )}
        </section>

        {signedIn ? (
          <aside className="panel results-side is-signed-in" aria-label="Your top 3">
            <b>Your top 3</b>
            <ol>
              {top.map((r, i) => (
                <li key={i} className={isSameResult(r, result) ? 'is-current' : undefined}>
                  {formatNumber(r.points)}
                </li>
              ))}
            </ol>
          </aside>
        ) : (
          <aside className="panel results-side" aria-label="Save your score">
            <b>Sign in to keep this score</b>
            <p>Guests' scores disappear when they close the tab.</p>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => actions.signIn()}>
              Continue with Google
            </button>
          </aside>
        )}
      </main>
    </div>
  )
}
