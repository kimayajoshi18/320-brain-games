import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import TaskHeader from '../../components/TaskHeader.tsx'
import { formatDuration, plural } from '../../lib/format.ts'
import { HINT_PENALTY_SECONDS, MISTAKE_PENALTY_SECONDS, numbersPoints } from '../../lib/scoring.ts'
import { useAppState } from '../../state/context.ts'
import ExitLink from '../ExitLink.tsx'
import GameTimer, { type Penalty } from '../GameTimer.tsx'
import { gameHeading } from '../heading.ts'
import NumberGrid from './NumberGrid.tsx'
import { BLANK_COUNT, createPuzzle, hintEquation, isCorrect, type Equation } from './puzzle.ts'
import '../game.css'
import './NumbersGame.css'

export default function NumbersGame() {
  const { state, actions } = useAppState()
  const navigate = useNavigate()

  // Everyone gets the same daily puzzle; practice rounds get a fresh one each time.
  const [setup] = useState(() => {
    const heading = gameHeading(state, 'numbers')
    const seed = heading.daily ? `numbers:${state.today}` : `numbers:${state.today}:${state.gamesPlayed}`
    return { heading, puzzle: createPuzzle(seed) }
  })
  const { heading, puzzle } = setup

  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [solved, setSolved] = useState<number[]>([])
  const [wrong, setWrong] = useState<number | null>(null)
  const [hinted, setHinted] = useState<Equation | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [penaltySeconds, setPenaltySeconds] = useState(0)
  const [penalty, setPenalty] = useState<Penalty | null>(null)
  const [wrongEntries, setWrongEntries] = useState(0)
  const [hints, setHints] = useState(0)
  const [finalTime, setFinalTime] = useState<number | null>(null)
  const inputRefs = useRef(new Map<number, HTMLInputElement>())
  const nextKey = useRef(0)

  const finished = finalTime !== null
  const total = elapsed + penaltySeconds

  // Count up until every blank is solved.
  useEffect(() => {
    if (finished) return
    const start = performance.now()
    const id = setInterval(() => setElapsed((performance.now() - start) / 1000), 250)
    return () => clearInterval(id)
  }, [finished])

  // Give the last answer a moment on screen, then save and show results.
  useEffect(() => {
    if (finalTime === null) return
    const timeout = setTimeout(() => {
      const seconds = Math.round(finalTime)
      const stats = [`${BLANK_COUNT} of ${BLANK_COUNT} solved`, formatDuration(seconds)]
      if (wrongEntries > 0) stats.push(plural(wrongEntries, 'wrong entry', 'wrong entries'))
      if (hints > 0) stats.push(plural(hints, 'hint'))
      actions.recordResult({
        gameId: 'numbers',
        points: numbersPoints({ seconds: Math.round(finalTime - penaltySeconds), wrongEntries, hints }),
        durationSec: seconds,
        hintsUsed: hints,
        hintPenalty: hints * HINT_PENALTY_SECONDS,
        stats,
        highlight: formatDuration(seconds),
        details: { blanks: BLANK_COUNT, wrongEntries, hints },
        playedAt: state.today,
      })
      navigate('/results')
    }, 700)
    return () => clearTimeout(timeout)
  }, [finalTime, penaltySeconds, wrongEntries, hints, actions, navigate, state.today])

  const addPenalty = (seconds: number) => {
    setPenaltySeconds((p) => p + seconds)
    setPenalty({ key: nextKey.current++, seconds })
  }

  const handleChange = (index: number, text: string) =>
    setDrafts((d) => ({ ...d, [index]: text.replace(/\D/g, '') }))

  // Runs on Enter and when a cell loses focus (phone number pads have no Enter key).
  const handleSubmit = (index: number) => {
    const text = drafts[index] ?? ''
    if (finished || solved.includes(index) || text === '') return

    if (!isCorrect(puzzle, index, Number(text))) {
      setWrongEntries((n) => n + 1)
      addPenalty(MISTAKE_PENALTY_SECONDS)
      setDrafts((d) => ({ ...d, [index]: '' }))
      setWrong(index)
      setTimeout(() => setWrong((w) => (w === index ? null : w)), 600)
      return
    }

    const nowSolved = [...solved, index]
    setSolved(nowSolved)
    if (nowSolved.length === puzzle.blanks.length) {
      setFinalTime(total)
      return
    }
    // Move to the next open blank. Wait a tick, so the blur this causes sees the cell as solved.
    const open = puzzle.blanks.filter((i) => !nowSolved.includes(i))
    const next = open.find((i) => i > index) ?? open[0]
    setTimeout(() => inputRefs.current.get(next)?.focus())
  }

  const showHint = () => {
    const eq = hintEquation(puzzle, solved)
    if (!eq) return
    setHinted(eq)
    setHints((n) => n + 1)
    addPenalty(HINT_PENALTY_SECONDS)
    setTimeout(() => setHinted((current) => (current === eq ? null : current)), 1600)
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
        right={<GameTimer seconds={finalTime ?? total} penalty={penalty} />}
      />

      <main className="game-body">
        <NumberGrid
          puzzle={puzzle}
          drafts={drafts}
          solved={solved}
          hinted={hinted}
          wrong={wrong}
          inputRefs={inputRefs}
          onChange={handleChange}
          onSubmit={handleSubmit}
        />

        <div className="game-footer">
          <div className="found-meter">
            {puzzle.blanks.map((_, k) => (
              <span key={k} className={k < solved.length ? 'found' : undefined} aria-hidden="true" />
            ))}
            <output aria-live="polite">
              {solved.length} of {puzzle.blanks.length}
              <span className="desktop-only"> solved</span>
            </output>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={showHint}
            disabled={finished || hinted !== null}
            title={`Highlights an equation you can solve. Adds ${HINT_PENALTY_SECONDS} seconds.`}
          >
            Hint
          </button>
        </div>
      </main>
    </div>
  )
}