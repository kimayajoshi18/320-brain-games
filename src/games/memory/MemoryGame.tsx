import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import TaskHeader from '../../components/TaskHeader.tsx'
import { formatDuration, plural } from '../../lib/format.ts'
import { memoryPoints, unfinishedPoints } from '../../lib/scoring.ts'
import { useAppState } from '../../state/context.ts'
import type { GameResult } from '../../state/types.ts'
import ExitLink from '../ExitLink.tsx'
import GameTimer from '../GameTimer.tsx'
import { gameHeading } from '../heading.ts'
import { columnsForCount, createDeck, deckSeed, LAST_ROUND, TIME_LIMIT, TOTAL_PAIRS, type Card } from './deck.ts'
import '../game.css'
import './MemoryGame.css'

/** How long a pair that doesn't match stays face up. */
export const MISMATCH_MS = 900
/** How long the "Round complete" message shows before the next round (or the results). */
export const ROUND_PAUSE_MS = 1800

export default function MemoryGame() {
  const { state, actions } = useAppState()
  const navigate = useNavigate()
  const [heading] = useState(() => gameHeading(state, 'memory'))

  const [round, setRound] = useState(1)
  const [deck, setDeck] = useState<Card[]>(() => createDeck(1, deckSeed(state.today, state.gamesPlayed, 1)))
  const [flipped, setFlipped] = useState<number[]>([])
  const [matched, setMatched] = useState<Set<number>>(new Set())
  const [moves, setMoves] = useState(0)
  const [totalMoves, setTotalMoves] = useState(0)
  /** Turns where the two cards didn't match, across every round. */
  const [wrongPairs, setWrongPairs] = useState(0)
  /** Pairs matched across every round. */
  const [pairsFound, setPairsFound] = useState(0)
  const [locked, setLocked] = useState(false)
  const [roundComplete, setRoundComplete] = useState(false)
  const [gameOver, setGameOver] = useState(false)

  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mismatchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const roundTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTime = useRef(0)
  const gameOverRef = useRef(false)

  // The clock and the round timeout read these, so they always see the latest values.
  const progress = useRef({ round, totalMoves, wrongPairs, pairsFound })
  useEffect(() => {
    progress.current = { round, totalMoves, wrongPairs, pairsFound }
  }, [round, totalMoves, wrongPairs, pairsFound])

  const clearPendingTimeouts = useCallback(() => {
    if (mismatchTimeout.current) {
      clearTimeout(mismatchTimeout.current)
      mismatchTimeout.current = null
    }
    if (roundTimeout.current) {
      clearTimeout(roundTimeout.current)
      roundTimeout.current = null
    }
  }, [])

  useEffect(() => () => clearPendingTimeouts(), [clearPendingTimeouts])

  /** Saves the game and shows the results. `completed` is false when time ran out. */
  const finishGame = useCallback(
    (completed: boolean) => {
      if (gameOverRef.current) return
      gameOverRef.current = true
      setGameOver(true)
      if (timerRef.current) clearInterval(timerRef.current)
      clearPendingTimeouts()

      const { round: finalRound, totalMoves: allMoves, wrongPairs: misses, pairsFound: found } = progress.current
      const seconds = Math.min(TIME_LIMIT, Math.round((performance.now() - startTime.current) / 1000))
      const roundsCleared = completed ? LAST_ROUND : finalRound - 1
      const result: GameResult = {
        gameId: 'memory',
        points: completed ? memoryPoints({ seconds, wrongPairs: misses }) : unfinishedPoints(found / TOTAL_PAIRS),
        durationSec: seconds,
        stats: [
          completed ? 'All rounds cleared' : `Reached round ${finalRound}`,
          plural(allMoves, 'move'),
          formatDuration(seconds),
          misses > 0 ? plural(misses, 'missed pair') : 'No misses',
        ],
        highlight: `Round ${finalRound}`,
        details: { moves: allMoves, wrongPairs: misses, pairs: found, rounds: roundsCleared },
        playedAt: state.today,
      }
      actions.recordResult(result)
      navigate('/results')
    },
    [state.today, actions, navigate, clearPendingTimeouts],
  )

  const finishGameRef = useRef(finishGame)
  useEffect(() => {
    finishGameRef.current = finishGame
  }, [finishGame])

  const startClock = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    startTime.current = performance.now()
    timerRef.current = setInterval(() => {
      const now = (performance.now() - startTime.current) / 1000
      setElapsed(Math.min(now, TIME_LIMIT))
      if (now >= TIME_LIMIT) finishGameRef.current(false)
    }, 250)
  }, [])

  useEffect(() => {
    startClock()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [startClock])

  const startNextRound = useCallback(
    (nextRound: number) => {
      clearPendingTimeouts()
      setRound(nextRound)
      setDeck(createDeck(nextRound, deckSeed(state.today, state.gamesPlayed, nextRound)))
      setFlipped([])
      setMatched(new Set())
      setMoves(0)
      setLocked(false)
      setRoundComplete(false)
    },
    [state.today, state.gamesPlayed, clearPendingTimeouts],
  )

  const handleCardClick = (cardIndex: number) => {
    if (locked || gameOver || roundComplete) return
    if (flipped.includes(cardIndex) || matched.has(cardIndex)) return

    const newFlipped = [...flipped, cardIndex]
    setFlipped(newFlipped)
    if (newFlipped.length < 2) return

    setMoves((m) => m + 1)
    setTotalMoves((m) => m + 1)

    const [first, second] = newFlipped
    if (deck[first].symbol !== deck[second].symbol) {
      setWrongPairs((w) => w + 1)
      setLocked(true)
      mismatchTimeout.current = setTimeout(() => {
        setFlipped([])
        setLocked(false)
      }, MISMATCH_MS)
      return
    }

    const newMatched = new Set(matched).add(first).add(second)
    setMatched(newMatched)
    setPairsFound((p) => p + 1)
    setFlipped([])

    if (newMatched.size === deck.length) {
      setRoundComplete(true)
      setLocked(true)
      roundTimeout.current = setTimeout(
        () => (round >= LAST_ROUND ? finishGame(true) : startNextRound(round + 1)),
        ROUND_PAUSE_MS,
      )
    }
  }

  const restartGame = () => {
    clearPendingTimeouts()
    gameOverRef.current = false
    setGameOver(false)
    setRound(1)
    setDeck(createDeck(1, `${deckSeed(state.today, state.gamesPlayed, 1)}:restart:${Date.now()}`))
    setFlipped([])
    setMatched(new Set())
    setMoves(0)
    setTotalMoves(0)
    setWrongPairs(0)
    setPairsFound(0)
    setLocked(false)
    setRoundComplete(false)
    setElapsed(0)
    startClock()
  }

  const pairs = deck.length / 2
  const matchedPairs = matched.size / 2
  const cols = columnsForCount(deck.length)

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
        right={<GameTimer seconds={elapsed} penalty={null} />}
      />

      <main className="game-body">
        <div className="memory-stats">
          <span>
            Round {round} of {LAST_ROUND}
          </span>
          <span>{plural(moves, 'move')}</span>
          <span>
            {matchedPairs}/{pairs} matched
          </span>
        </div>

        <div className="memory-board" data-cols={cols} role="grid" aria-label="Memory card grid">
          {deck.map((card, index) => {
            const isFlipped = flipped.includes(index)
            const isMatched = matched.has(index)
            const className = ['memory-card', isFlipped ? 'flipped' : '', isMatched ? 'matched' : '']
              .filter(Boolean)
              .join(' ')

            return (
              <button
                key={`${round}-${card.id}`}
                type="button"
                className={className}
                onClick={() => handleCardClick(index)}
                disabled={isMatched}
                aria-label={isFlipped || isMatched ? `Card: ${card.symbol}` : 'Face-down card'}
              >
                <div className="memory-card-inner">
                  <div className="memory-card-face memory-card-back" aria-hidden="true" />
                  <div className="memory-card-face memory-card-front" aria-hidden="true">
                    {card.symbol}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="memory-footer">
          <button type="button" className="btn btn-outline btn-sm" onClick={restartGame}>
            Restart Game
          </button>
        </div>

        {roundComplete && !gameOver && (
          <div className="memory-overlay" role="status" aria-live="polite">
            <h2>{round >= LAST_ROUND ? 'All rounds cleared!' : 'Round Complete!'}</h2>
            <p>
              {plural(moves, 'move')} &middot; {round >= LAST_ROUND ? 'Saving your score...' : `Starting round ${round + 1}...`}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
