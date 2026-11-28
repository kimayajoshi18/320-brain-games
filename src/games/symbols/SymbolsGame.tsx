import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import TaskHeader from '../../components/TaskHeader.tsx'
import { formatDuration, plural } from '../../lib/format.ts'
import { MISTAKE_PENALTY_SECONDS, symbolsPoints } from '../../lib/scoring.ts'
import { useAppState } from '../../state/context.ts'
import ExitLink from '../ExitLink.tsx'
import GameTimer, { type Penalty } from '../GameTimer.tsx'
import { gameHeading } from '../heading.ts'
import {
  createRounds,
  DIGITS,
  DISTRACTORS_PER_ROUND,
  isOdd,
  PAIRS_PER_ROUND,
  QUESTION_COUNT,
  summarize,
  SYMBOLS,
  type Answer,
  type Glyph,
} from './rounds.ts'
import '../game.css'
import './SymbolsGame.css'

type Phase = 'study' | 'distract' | 'recall'

/** How long the pairs stay up if the player doesn't move on first. */
export const STUDY_MS_PER_PAIR = 2500
/** How long the right/wrong mark stays up before the next symbol. A miss stays longer so the answer can be read. */
const FEEDBACK_MS = { right: 450, wrong: 900 }
/** Pause on the last answer before the results screen. */
const FINISH_MS = 900

const PROMPTS: Record<Phase, string> = {
  study: 'Remember which number goes with each symbol.',
  distract: 'Quick: is this number odd or even?',
  recall: 'Which number went with this symbol?',
}

interface Feedback {
  choice: number
  correct: boolean
}

/** A symbol drawn as text (never as an emoji), with its name for screen readers. */
function SymbolGlyph({ glyph, className }: { glyph: Glyph; className?: string }) {
  return (
    <span className={className} role="img" aria-label={SYMBOLS[glyph]}>
      {glyph}
      {'︎'}
    </span>
  )
}

export default function SymbolsGame() {
  const { state, actions } = useAppState()
  const navigate = useNavigate()

  // Everyone gets the same daily pairs; practice games get fresh ones each time.
  const [setup] = useState(() => {
    const heading = gameHeading(state, 'symbols')
    const seed = heading.daily ? `symbols:${state.today}` : `symbols:${state.today}:${state.gamesPlayed}`
    return { heading, rounds: createRounds(seed) }
  })
  const { heading, rounds } = setup

  const [roundIndex, setRoundIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('study')
  /** Place within the current phase: which odd-or-even number, or which symbol is being asked. */
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [oddEvenRight, setOddEvenRight] = useState(0)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  /** Seconds spent answering symbols. Studying and the odd-or-even task aren't timed. */
  const [elapsed, setElapsed] = useState(0)
  const [penaltySeconds, setPenaltySeconds] = useState(0)
  const [penalty, setPenalty] = useState<Penalty | null>(null)
  const [finished, setFinished] = useState(false)
  const shownAt = useRef(0)
  const nextKey = useRef(0)

  const round = rounds[roundIndex]
  const question = round.questions[step]
  const answeredMs = answers.reduce((sum, a) => sum + a.ms, 0)

  // Response time runs from when a symbol is on screen.
  useEffect(() => {
    if (phase === 'recall') shownAt.current = performance.now()
  }, [phase, roundIndex, step])

  // The clock only runs while a symbol is waiting for an answer.
  useEffect(() => {
    if (phase !== 'recall' || feedback || finished) return
    const id = setInterval(() => setElapsed((answeredMs + performance.now() - shownAt.current) / 1000), 250)
    return () => clearInterval(id)
  }, [phase, feedback, finished, answeredMs])

  // The pairs stay up for a set time, unless the player moves on first.
  useEffect(() => {
    if (phase !== 'study') return
    const timeout = setTimeout(() => {
      setPhase('distract')
      setStep(0)
    }, round.pairs.length * STUDY_MS_PER_PAIR)
    return () => clearTimeout(timeout)
  }, [phase, round])

  // After the right/wrong mark, ask the next symbol, or start the next round with one more pair.
  useEffect(() => {
    if (!feedback || finished) return
    const timeout = setTimeout(
      () => {
        setFeedback(null)
        if (step + 1 < round.questions.length) {
          setStep(step + 1)
        } else {
          setRoundIndex((r) => r + 1)
          setPhase('study')
          setStep(0)
        }
      },
      feedback.correct ? FEEDBACK_MS.right : FEEDBACK_MS.wrong,
    )
    return () => clearTimeout(timeout)
  }, [feedback, finished, step, round])

  // Give the last mark a moment on screen, then save and show results.
  useEffect(() => {
    if (!finished) return
    const timeout = setTimeout(() => {
      const { correct, wrong, averageMs, seconds: clock } = summarize(answers)
      const seconds = Math.round(clock + penaltySeconds)
      actions.recordResult({
        gameId: 'symbols',
        points: symbolsPoints({ seconds: Math.round(clock), wrongAnswers: wrong }),
        durationSec: seconds,
        stats: [
          `${correct} of ${QUESTION_COUNT} remembered`,
          `${(averageMs / 1000).toFixed(2)}s per answer`,
          formatDuration(seconds),
          wrong > 0 ? plural(wrong, 'wrong answer') : 'No mistakes',
        ],
        highlight: `${correct}/${QUESTION_COUNT}`,
        details: {
          correct,
          wrong,
          rounds: PAIRS_PER_ROUND.length,
          maxPairs: PAIRS_PER_ROUND.at(-1)!,
          avgResponseMs: averageMs,
          oddEvenRight,
        },
        playedAt: state.today,
      })
      navigate('/results')
    }, FINISH_MS)
    return () => clearTimeout(timeout)
  }, [finished, answers, penaltySeconds, oddEvenRight, actions, navigate, state.today])

  const doneStudying = () => {
    if (phase !== 'study') return
    setPhase('distract')
    setStep(0)
  }

  const sayOdd = (odd: boolean) => {
    if (phase !== 'distract') return
    if (isOdd(round.distractors[step]) === odd) setOddEvenRight((n) => n + 1)
    if (step + 1 < DISTRACTORS_PER_ROUND) {
      setStep(step + 1)
    } else {
      setPhase('recall')
      setStep(0)
    }
  }

  const recall = (choice: number) => {
    if (phase !== 'recall' || feedback || finished) return
    const ms = Math.round(performance.now() - shownAt.current)
    const correct = choice === question.number
    setAnswers((a) => [...a, { correct, ms }])
    setElapsed((answeredMs + ms) / 1000)
    setFeedback({ choice, correct })
    if (!correct) {
      setPenaltySeconds((p) => p + MISTAKE_PENALTY_SECONDS)
      setPenalty({ key: nextKey.current++, seconds: MISTAKE_PENALTY_SECONDS })
    }
    if (answers.length + 1 === QUESTION_COUNT) setFinished(true)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      const key = e.key.toLowerCase()
      if (phase === 'study' && (key === 'enter' || key === ' ')) doneStudying()
      if (phase === 'distract' && (key === 'o' || key === 'e')) sayOdd(key === 'o')
      if (phase === 'recall' && /^[1-9]$/.test(key)) recall(Number(key))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

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
        right={<GameTimer seconds={elapsed + penaltySeconds} penalty={penalty} />}
      />

      <main className="game-body symbols">
        <div className="symbols-status">
          <span>
            Round {roundIndex + 1} of {rounds.length} · {plural(round.pairs.length, 'pair')}
          </span>
          <div
            className="symbols-progress"
            role="progressbar"
            aria-label="Symbols answered"
            aria-valuemin={0}
            aria-valuemax={QUESTION_COUNT}
            aria-valuenow={answers.length}
          >
            <span style={{ width: `${(answers.length / QUESTION_COUNT) * 100}%` }} />
          </div>
          <span>{correctSoFar} correct</span>
        </div>

        <p className="symbols-prompt">{PROMPTS[phase]}</p>

        <div className={`symbols-card${feedback ? (feedback.correct ? ' is-right' : ' is-wrong') : ''}`}>
          {phase === 'study' && (
            <>
              <ul className="symbols-pairs" aria-label="Pairs to remember">
                {round.pairs.map((p) => (
                  <li key={p.symbol}>
                    <SymbolGlyph glyph={p.symbol} className="symbols-glyph" />
                    <span className="symbols-equals">=</span>
                    <span className="symbols-number">{p.number}</span>
                  </li>
                ))}
              </ul>
              <span
                key={roundIndex}
                className="symbols-countdown"
                style={{ animationDuration: `${round.pairs.length * STUDY_MS_PER_PAIR}ms` }}
                aria-hidden="true"
              />
            </>
          )}
          {phase === 'distract' && (
            <span key={step} className="symbols-big" data-testid="symbols-distractor">
              {round.distractors[step]}
            </span>
          )}
          {phase === 'recall' && (
            <>
              <SymbolGlyph key={`${roundIndex}-${step}`} glyph={question.symbol} className="symbols-big" />
              <output className="symbols-feedback" aria-live="polite">
                {feedback && (feedback.correct ? '✓ Correct' : `✗ It was ${question.number}`)}
              </output>
            </>
          )}
        </div>

        {phase === 'study' && (
          <div className="symbols-actions">
            <button type="button" className="btn btn-primary" onClick={doneStudying} aria-keyshortcuts="Enter">
              I’ve got them
            </button>
          </div>
        )}
        {phase === 'distract' && (
          <div className="symbols-actions" role="group" aria-label="Odd or even">
            <button type="button" className="btn btn-outline" onClick={() => sayOdd(true)} aria-keyshortcuts="O">
              Odd <kbd aria-hidden="true">O</kbd>
            </button>
            <button type="button" className="btn btn-outline" onClick={() => sayOdd(false)} aria-keyshortcuts="E">
              Even <kbd aria-hidden="true">E</kbd>
            </button>
          </div>
        )}
        {phase === 'recall' && (
          <div className={`symbols-digits${feedback ? ' has-feedback' : ''}`} role="group" aria-label="Number">
            {DIGITS.map((n) => {
              const classes = ['symbols-digit']
              if (feedback && n === question.number) classes.push(feedback.correct ? 'is-chosen' : 'is-answer')
              else if (feedback?.choice === n) classes.push('is-chosen')
              return (
                <button key={n} type="button" className={classes.join(' ')} onClick={() => recall(n)}>
                  {n}
                </button>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
