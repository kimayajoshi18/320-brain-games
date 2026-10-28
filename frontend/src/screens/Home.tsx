import { Link, useNavigate } from 'react-router'
import GameArt from '../components/GameArt.tsx'
import MainShell from '../components/MainShell.tsx'
import WeekBar from '../components/WeekBar.tsx'
import { GAMES, type GameId } from '../data/games.ts'
import { formatNumber, plural } from '../lib/format.ts'
import { useAppState } from '../state/context.ts'
import { currentStreak, dailyDoneCount, dailyOrder, nextDailyGame, weekCells } from '../state/store.ts'
import './Home.css'

export default function Home() {
  const { state, actions } = useAppState()
  const navigate = useNavigate()

  const order = dailyOrder(state)
  const next = nextDailyGame(state)
  const done = dailyDoneCount(state)
  const streak = currentStreak(state)
  const week = weekCells(state)
  const upcoming = order.filter((id) => !state.todayResults[id] && id !== next)

  const status = (id: GameId) => {
    const result = state.todayResults[id]
    if (result) return { kind: 'done' as const, text: `${formatNumber(result.points)} pts` }
    if (id === next) return { kind: 'next' as const, text: '' }
    return { kind: 'upcoming' as const, text: upcoming.indexOf(id) === 0 ? 'Up next' : 'After that' }
  }

  return (
    <MainShell>
      <div className="home">
        <section className="home-main" aria-labelledby="today-title">
          <h1 id="today-title" className="home-title">
            <span className="desktop-only">Today: </span>
            {done === 3 ? 'All 3 done' : `${done} of 3 done`}
          </h1>
          <WeekBar days={week} className="home-week" />

          {state.account.kind === 'guest' && (
            <p className="guest-note">
              Playing as a guest. Your progress isn't saved.
              <button type="button" className="link-button" onClick={() => actions.signIn()}>
                Sign in to keep it
              </button>
            </p>
          )}

          <ol className="daily-cards">
            {order.map((id) => {
              const s = status(id)
              return (
                <li key={id} className={`daily-card is-${s.kind}`}>
                  <div className="daily-card-art">
                    <GameArt game={id} />
                  </div>
                  <b>
                    {s.kind === 'done' && '✓ '}
                    <span className="title-desktop">{GAMES[id].name}</span>
                    <span className="title-mobile">{s.kind === 'done' ? GAMES[id].name : GAMES[id].title}</span>
                  </b>
                  {s.kind === 'next' ? (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(`/play/${id}`)}>
                      Play
                    </button>
                  ) : (
                    <span className="daily-card-status">{s.text}</span>
                  )}
                </li>
              )
            })}
          </ol>

          {done === 3 && (
            <p className="all-done">
              That's today's three. Your streak is now <b>{plural(streak, 'day')}</b>. See you tomorrow!
            </p>
          )}

          <h2 className="practice-title">Keep practicing</h2>
          <div className="practice-list">
            {order.map((id) => (
              <Link key={id} to={`/play/${id}`} className="chip">
                {GAMES[id].name}
              </Link>
            ))}
          </div>
        </section>

        <aside className="panel streak-panel" aria-label="Streak">
          <span className="streak-number">{streak}</span>
          <span className="streak-label">day streak</span>
          <WeekBar days={week} />
          <span className="streak-hint">Finish all 3 to add a day</span>
        </aside>
      </div>
    </MainShell>
  )
}
