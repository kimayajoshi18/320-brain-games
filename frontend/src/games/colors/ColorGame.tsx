import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import TaskHeader from '../../components/TaskHeader.tsx'
import { formatDuration, plural } from '../../lib/format.ts'
import { useAppState } from '../../state/context.ts'
import ExitLink from '../ExitLink.tsx'
import GameTimer, { type Penalty } from '../GameTimer.tsx'
import { gameHeading } from '../heading.ts'
import { createPuzzle, differenceAt, DIFFERENCE_COUNT, scoreFor, shapesForScene } from './puzzle.ts'
import Scene, { type Miss } from './Scene.tsx'
import '../game.css'

const WRONG_TAP_SECONDS = 3
const HINT_SECONDS = 5

export default function ColorGame() {
  const { state, actions } = useAppState()
  const navigate = useNavigate()

  // Everyone gets the same daily puzzle; practice rounds get a fresh one each time.
  const [setup] = useState(() => {
    const heading = gameHeading(state, 'colors')
    const seed = heading.daily ? `colors:${state.today}` : `colors:${state.today}:${state.gamesPlayed}`
    return { heading, puzzle: createPuzzle(seed) }
  })
  const { heading, puzzle } = setup

  const [found, setFound] = useState<number[]>([])
  const [misses, setMisses] = useState<Miss[]>([])
  const [hinted, setHinted] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [penaltySeconds, setPenaltySeconds] = useState(0)
  const [penalty, setPenalty] = useState<Penalty | null>(null)
  const [wrongTaps, setWrongTaps] = useState(0)
  const [hints, setHints] = useState(0)
  const [finalTime, setFinalTime] = useState<number | null>(null)
  const nextKey = useRef(0)

  const finished = finalTime !== null
  const total = elapsed + penaltySeconds

  // Count up until every difference is found.
  useEffect(() => {
    if (finished) return
    const start = performance.now()
    const id = setInterval(() => setElapsed((performance.now() - start) / 1000), 250)
    return () => clearInterval(id)
  }, [finished])

  // Give the last marker a moment on screen, then save and show results.
  useEffect(() => {
    if (finalTime === null) return
    const timeout = setTimeout(() => {
      const seconds = Math.round(finalTime)
      const stats = [`${DIFFERENCE_COUNT} of ${DIFFERENCE_COUNT} found`, formatDuration(seconds)]
      if (wrongTaps > 0) stats.push(plural(wrongTaps, 'wrong tap'))
      if (hints > 0) stats.push(plural(hints, 'hint'))
      actions.recordResult({
        gameId: 'colors',
        points: scoreFor(seconds),
        durationSec: seconds,
        stats,
        highlight: `${DIFFERENCE_COUNT}/${DIFFERENCE_COUNT}`,
        playedAt: state.today,
      })
      navigate('/results')
    }, 700)
    return () => clearTimeout(timeout)
  }, [finalTime, wrongTaps, hints, actions, navigate, state.today])

  const addPenalty = (seconds: number) => {
    setPenaltySeconds((p) => p + seconds)
    setPenalty({ key: nextKey.current++, seconds })
  }

  const handleTap = (scene: 'a' | 'b') => (x: number, y: number) => {
    if (finished) return
    const hit = differenceAt(puzzle, x, y, found)
    if (hit === null) {
      const key = nextKey.current++
      setMisses((m) => [...m, { key, x, y, scene }])
      setTimeout(() => setMisses((m) => m.filter((miss) => miss.key !== key)), 800)
      setWrongTaps((n) => n + 1)
      addPenalty(WRONG_TAP_SECONDS)
      return
    }
    const nowFound = [...found, hit]
    setFound(nowFound)
    if (hinted === hit) setHinted(null)
    if (nowFound.length === DIFFERENCE_COUNT) setFinalTime(total)
  }

  const showHint = () => {
    const target = [...puzzle.differences.keys()].find((id) => !found.includes(id))
    if (target === undefined) return
    setHinted(target)
    setHints((n) => n + 1)
    addPenalty(HINT_SECONDS)
    setTimeout(() => setHinted((current) => (current === target ? null : current)), 1600)
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
        <div className="scenes">
          {(['a', 'b'] as const).map((scene) => (
            <Scene
              key={scene}
              label={`Scene ${scene.toUpperCase()}. Tap a shape whose color differs from the other scene.`}
              scene={scene}
              puzzle={puzzle}
              shapes={shapesForScene(puzzle, scene)}
              found={found}
              hinted={hinted}
              misses={misses}
              onTap={handleTap(scene)}
            />
          ))}
        </div>

        <div className="game-footer">
          <div className="found-meter">
            {Array.from({ length: DIFFERENCE_COUNT }, (_, i) => (
              <span key={i} className={i < found.length ? 'found' : undefined} aria-hidden="true" />
            ))}
            <output aria-live="polite">
              {found.length} of {DIFFERENCE_COUNT}
              <span className="desktop-only"> found</span>
            </output>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={showHint}
            disabled={finished || hinted !== null}
            title={`Shows one difference. Adds ${HINT_SECONDS} seconds.`}
          >
            Hint
          </button>
        </div>
      </main>
    </div>
  )
}
