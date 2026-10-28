import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import MainShell from '../components/MainShell.tsx'
import { GAMES } from '../data/games.ts'
import { useAppState } from '../state/context.ts'
import { buildPath } from '../state/path.ts'
import { dailyDoneCount, dailyOrder, nextDailyGame } from '../state/store.ts'
import './LearningPath.css'

/** Zigzag columns: left, middle, right, middle, left... */
const COLUMNS = [0, 1, 2, 1]

export default function LearningPath() {
  const { state } = useAppState()
  const path = buildPath(state)
  const next = nextDailyGame(state)
  const games = dailyOrder(state)
    .map((id) => GAMES[id].name)
    .join(', ')
  const reward = path.nextReward

  return (
    <MainShell>
      <div className="learning">
        <section aria-label="Learning path">
          {path.hiddenDone > 0 && (
            <p className="path-earlier">✓ Days 1–{path.hiddenDone} complete</p>
          )}
          <ol className="path">
            {path.steps.map((step, i) => {
              const col = COLUMNS[(step.day - 1) % COLUMNS.length]
              const nextCol = COLUMNS[step.day % COLUMNS.length]
              const style = {
                '--col': col,
                '--next-col': nextCol,
                '--min-col': Math.min(col, nextCol),
                '--span': Math.abs(col - nextCol),
              } as CSSProperties
              const className = `path-step is-${step.status}${step.reward ? ' is-reward' : ''}`
              const content = (
                <>
                  <span className="path-node" aria-hidden="true" />
                  <span className="path-label">
                    <span className="long">{step.label}</span>
                    <span className="short">{step.shortLabel}</span>
                  </span>
                </>
              )
              return (
                <li key={step.day} className={className} style={style} aria-current={step.status === 'today' ? 'step' : undefined}>
                  {i < path.steps.length - 1 && <span className="path-link" aria-hidden="true" />}
                  {step.status === 'today' && next ? (
                    <Link to={`/play/${next}`} className="path-item">
                      {content}
                    </Link>
                  ) : (
                    <span className="path-item">{content}</span>
                  )}
                  <span className="visually-hidden">
                    {step.status === 'done' ? 'Done' : step.status === 'today' ? 'Today' : 'Locked'}
                  </span>
                </li>
              )
            })}
          </ol>
        </section>

        <aside className="learning-side">
          <div className="panel panel-accent">
            {path.todayDone ? (
              <>
                <b>Day {path.currentDay} done</b>
                <span className="muted">Come back tomorrow for day {path.currentDay + 1}.</span>
              </>
            ) : (
              <>
                <b>Day {path.currentDay} · Today’s three</b>
                <span className="muted">{games} · about 6 min</span>
                {next && (
                  <Link to={`/play/${next}`} className="btn btn-primary btn-sm">
                    {dailyDoneCount(state) > 0 ? 'Continue' : 'Start'}
                  </Link>
                )}
              </>
            )}
          </div>

          <div className="panel">
            <b>Next reward</b>
            {reward ? (
              <>
                <span>
                  {reward.day}-day streak · {reward.tier} badge
                </span>
                <div
                  className="reward-bar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={reward.day}
                  aria-valuenow={path.progress}
                  aria-label="Progress to next reward"
                >
                  <div style={{ width: `${(path.progress / reward.day) * 100}%` }} />
                </div>
                <span className="muted">
                  {path.progress} of {reward.day} days
                </span>
              </>
            ) : (
              <span>You've earned every streak reward.</span>
            )}
          </div>

          <div className="learning-legend">
            <span>Red = done · outline = today · grey = locked</span>
            <span>Dashed box = streak reward</span>
          </div>
        </aside>

        {!path.todayDone && next && (
          <Link to={`/play/${next}`} className="btn btn-primary learning-start-mobile">
            Start day {path.currentDay}
          </Link>
        )}
      </div>
    </MainShell>
  )
}
