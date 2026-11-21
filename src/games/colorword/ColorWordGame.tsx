import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import TaskHeader from '../../components/TaskHeader.tsx'
import { formatDuration, plural } from '../../lib/format.ts'
import { colorWordPoints, MISTAKE_PENALTY_SECONDS } from '../../lib/scoring.ts'
import { useAppState } from '../../state/context.ts'
import ExitLink from '../ExitLink.tsx'
import GameTimer, { type Penalty } from '../GameTimer.tsx'
import { gameHeading } from '../heading.ts'
import { createRounds, INKS, ROUND_COUNT, summarize, type Answer, type Ink } from './rounds.ts'
import '../game.css'
import './ColorWordGame.css'

const LABELS: Record<Ink, string> = { red: 'Red', blue: 'Blue', green: 'Green', yellow: 'Yellow' }

/** How long the right/wrong mark stays up before the next word. A miss stays longer so the answer can be read. */
const FEEDBACK_MS = { right: 450, wrong: 900 }
/** Pause on the last answer before the results screen. */
const FINISH_MS = 900

/** Keyboard shortcuts: the first letter of each color, or 1 to 4 in button order. */
function inkForKey(key: string): Ink | undefined {
  const k = key.toLowerCase()
  return INKS.find((ink, i) => ink[0] === k || String(i + 1) === k)
}

interface Feedback {
  choice: Ink
  correct: boolean
}

export default function ColorWordGame() {
  const { state, actions } = useAppState()
  const navigate = useNavigate()

  // Everyone gets the same daily words; practice games get fresh ones each time.
  const [setup] = useState(() => {
    const heading = gameHeading(state, 'colorword')
    const seed = heading.daily ? `colorword:${state.today}` : `colorword:${state.today}:${state.gamesPlayed}`
    return { heading, rounds: createRounds(seed) }
  })
  const { heading, rounds } = setup

  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [penaltySeconds, setPenaltySeconds] = useState(0)
  const [penalty, setPenalty] = useState<Penalty | null>(null)
  /** Seconds on the clock (before penalties) when the last answer was given. */
  const [finalClock, setFinalClock] = useState<number | null>(null)
  const startedAt = useRef(0)
  const shownAt = useRef(0)
  const nextKey = useRef(0)

  const finished = finalClock !== null
  const round = rounds[index]

  useEffect(() => {
    startedAt.current = performance.now()
  }, [])

  // Count up until the last answer.
  useEffect(() => {
    if (finished) return
    const id = setInterval(() => setElapsed((performance.now() - startedAt.current) / 1000), 250)
    return () => clearInterval(id)
  }, [finished])

  // Response time runs from when a word is on screen.
  useEffect(() => {
    shownAt.current = performance.now()
  }, [index])

  // After the right/wrong mark, move on to the next word.
  useEffect(() => {
    if (!feedback || finished) return
    const timeout = setTimeout(
      () => {
        setFeedback(null)
        setIndex((i) => i + 1)
      },
      feedback.correct ? FEEDBACK_MS.right : FEEDBACK_MS.wrong,
    )
    return () => clearTimeout(timeout)
  }, [feedback, finished])

  // Give the last mark a moment on screen, then save and show results.
  useEffect(() => {
    if (finalClock === null) return
    const timeout = setTimeout(() => {
      const { correct, wrong, averageMs } = summarize(answers)
      const seconds = Math.round(finalClock + penaltySeconds)
      actions.recordResult({
        gameId: 'colorword',
        points: colorWordPoints({ seconds: Math.round(finalClock), wrongAnswers: wrong }),
        durationSec: seconds,
        stats: [
          `${correct} of ${ROUND_COUNT} correct`,
          `${(averageMs / 1000).toFixed(2)}s per answer`,
          formatDuration(seconds),
          wrong > 0 ? plural(wrong, 'wrong answer') : 'No mistakes',
        ],
        highlight: `${correct}/${ROUND_COUNT}`,
        details: { correct, wrong, rounds: ROUND_COUNT, avgResponseMs: averageMs },
        playedAt: state.today,
      })
      navigate('/results')
    }, FINISH_MS)
    return () => clearTimeout(timeout)
  }, [finalClock, answers, penaltySeconds, actions, navigate, state.today])

  const choose = (choice: Ink) => {
    if (feedback || finished) return
    const now = performance.now()
    const correct = choice === round.ink
    setAnswers((a) => [...a, { correct, ms: Math.round(now - shownAt.current) }])
    setFeedback({ choice, correct })
    if (!correct) {
      setPenaltySeconds((p) => p + MISTAKE_PENALTY_SECONDS)
      setPenalty({ key: nextKey.current++, seconds: MISTAKE_PENALTY_SECONDS })
    }
    if (index === rounds.length - 1) setFinalClock((now - startedAt.current) / 1000)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      const ink = inkForKey(e.key)
      if (ink) choose(ink)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const answered = answers.length
  const correctSoFar = answers.filter((a) => a.correct).length

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
        right={<GameTimer seconds={(finalClock ?? elapsed) + penaltySeconds} penalty={penalty} />}
      />

      <main className="game-body colorword">
        <div className="colorword-status">
          <span>
            Round {index + 1} of {ROUND_COUNT}
          </span>
          <div
            className="colorword-progress"
            role="progressbar"
            aria-label="Rounds answered"
            aria-valuemin={0}
            aria-valuemax={ROUND_COUNT}
            aria-valuenow={answered}
          >
            <span style={{ width: `${(answered / ROUND_COUNT) * 100}%` }} />
          </div>
          <span>{correctSoFar} correct</span>
        </div>

        <p className="colorword-prompt">
          Pick the <b>color of the ink</b>, not the word.
        </p>

        <div
          className={`colorword-card${feedback ? (feedback.correct ? ' is-right' : ' is-wrong') : ''}`}
          data-testid="colorword-card"
        >
          <span key={index} className={`colorword-word ink-${round.ink}`} data-ink={round.ink}>
            {round.word.toUpperCase()}
          </span>
          <output className="colorword-feedback" aria-live="polite">
            {feedback && (feedback.correct ? '✓ Correct' : `✗ It was ${LABELS[round.ink].toLowerCase()}`)}
          </output>
        </div>

        <div className={`colorword-choices${feedback ? ' has-feedback' : ''}`} role="group" aria-label="Ink color">
          {INKS.map((ink) => {
            const classes = ['colorword-choice', `choice-${ink}`]
            let mark = ''
            if (feedback && ink === round.ink) {
              classes.push(feedback.correct ? 'is-chosen' : 'is-answer')
              mark = '✓'
            } else if (feedback?.choice === ink) {
              classes.push('is-chosen')
              mark = '✗'
            }
            return (
              <button
                key={ink}
                type="button"
                className={classes.join(' ')}
                onClick={() => choose(ink)}
                aria-keyshortcuts={ink[0].toUpperCase()}
              >
                {mark && (
                  <span className="colorword-mark" aria-hidden="true">
                    {mark}
                  </span>
                )}
                {LABELS[ink]}
                <kbd aria-hidden="true">{ink[0].toUpperCase()}</kbd>
              </button>
            )
          })}
        </div>
      </main>
    </div>
  )
}
