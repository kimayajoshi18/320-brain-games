import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import TaskHeader from '../../components/TaskHeader.tsx'
import { formatDuration, plural } from '../../lib/format.ts'
import { createRandom } from '../../lib/random.ts'
import { useAppState } from '../../state/context.ts'
import type { GameResult } from '../../state/types.ts'
import ExitLink from '../ExitLink.tsx'
import GameTimer from '../GameTimer.tsx'
import { gameHeading } from '../heading.ts'
import '../game.css'
import './MemoryGame.css'

const SYMBOLS = ['★', '♦', '♣', '♠', '♥', '▲', '●', '■']
const TIME_LIMIT = 120

const ROUND_CONFIG: Record<number, number> = {
  1: 4,
  2: 6,
  3: 8,
  4: 12,
  5: 16,
}

function cardCountForRound(round: number): number {
  if (round <= 5) return ROUND_CONFIG[round]
  return 16
}

function columnsForCount(count: number): number {
  if (count <= 4) return 2
  if (count <= 6) return 3
  return 4
}

interface Card {
  id: number
  symbol: string
}

function createDeck(round: number, seed: string): Card[] {
  const count = cardCountForRound(round)
  const pairs = count / 2
  const rand = createRandom(seed)
  const shuffled = rand.shuffle(SYMBOLS)
  const chosen = shuffled.slice(0, pairs)
  const cards: Card[] = chosen.flatMap((symbol, i) => [
    { id: i * 2, symbol },
    { id: i * 2 + 1, symbol },
  ])
  return rand.shuffle(cards)
}

function scoreForGame(totalMoves: number, totalSeconds: number, finalRound: number): number {
  const base = finalRound * 200
  const moveBonus = Math.max(0, 300 - totalMoves * 8)
  const timeBonus = Math.max(0, 500 - totalSeconds * 3)
  return base + moveBonus + timeBonus
}

export default function MemoryGame() {
  const { state, actions } = useAppState()
  const navigate = useNavigate()
  const [heading] = useState(() => gameHeading(state, 'memory'))

  const [round, setRound] = useState(1)
  const [deck, setDeck] = useState<Card[]>(() =>
    createDeck(1, `memory:${state.today}:${state.gamesPlayed}:1`),
  )
  const [flipped, setFlipped] = useState<number[]>([])
  const [matched, setMatched] = useState<Set<number>>(new Set())
  const [moves, setMoves] = useState(0)
  const [totalMoves, setTotalMoves] = useState(0)
  const [locked, setLocked] = useState(false)
  const [roundComplete, setRoundComplete] = useState(false)
  const [gameOver, setGameOver] = useState(false)

  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mismatchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const roundTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTime = useRef(performance.now())
  const gameOverRef = useRef(false)

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

  useEffect(() => {
    return () => clearPendingTimeouts()
  }, [clearPendingTimeouts])

  const roundRef = useRef(round)
  roundRef.current = round
  const totalMovesRef = useRef(totalMoves)
  totalMovesRef.current = totalMoves

  const finishGame = useCallback(
    (finalRound: number, allMoves: number) => {
      if (gameOverRef.current) return
      gameOverRef.current = true
      setGameOver(true)
      if (timerRef.current) clearInterval(timerRef.current)
      clearPendingTimeouts()
      const seconds = Math.round((performance.now() - startTime.current) / 1000)
      const points = scoreForGame(allMoves, seconds, finalRound)
      const result: GameResult = {
        gameId: 'memory',
        points,
        durationSec: seconds,
        stats: [
          plural(allMoves, 'move'),
          formatDuration(seconds),
          `Round ${finalRound}`,
        ],
        highlight: `Round ${finalRound}`,
        playedAt: state.today,
      }
      actions.recordResult(result)
      navigate('/results')
    },
    [state.today, actions, navigate, clearPendingTimeouts],
  )

  const finishGameRef = useRef(finishGame)
  finishGameRef.current = finishGame

  useEffect(() => {
    startTime.current = performance.now()
    timerRef.current = setInterval(() => {
      const now = (performance.now() - startTime.current) / 1000
      setElapsed(now)
      if (now >= TIME_LIMIT) {
        finishGameRef.current(roundRef.current, totalMovesRef.current)
      }
    }, 250)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const startNextRound = useCallback(
    (nextRound: number) => {
      clearPendingTimeouts()
      const newDeck = createDeck(
        nextRound,
        `memory:${state.today}:${state.gamesPlayed}:${nextRound}`,
      )
      setRound(nextRound)
      setDeck(newDeck)
      setFlipped([])
      setMatched(new Set())
      setMoves(0)
      setLocked(false)
      setRoundComplete(false)
    },
    [state.today, state.gamesPlayed, clearPendingTimeouts],
  )

  const handleCardClick = useCallback(
    (cardIndex: number) => {
      if (locked || gameOver || roundComplete) return
      if (flipped.includes(cardIndex)) return
      if (matched.has(cardIndex)) return

      const newFlipped = [...flipped, cardIndex]
      setFlipped(newFlipped)

      if (newFlipped.length === 2) {
        const newMoves = moves + 1
        const newTotalMoves = totalMoves + 1
        setMoves(newMoves)
        setTotalMoves(newTotalMoves)

        const [first, second] = newFlipped
        if (deck[first].symbol === deck[second].symbol) {
          const newMatched = new Set(matched)
          newMatched.add(first)
          newMatched.add(second)
          setMatched(newMatched)
          setFlipped([])

          if (newMatched.size === deck.length) {
            setRoundComplete(true)
            setLocked(true)

            const maxRound = 5
            if (round >= maxRound && cardCountForRound(round) === 16) {
              roundTimeout.current = setTimeout(() => {
                finishGame(round, newTotalMoves)
              }, 1800)
            } else {
              roundTimeout.current = setTimeout(() => {
                startNextRound(round + 1)
              }, 1800)
            }
          }
        } else {
          setLocked(true)
          mismatchTimeout.current = setTimeout(() => {
            setFlipped([])
            setLocked(false)
          }, 900)
        }
      }
    },
    [
      locked,
      gameOver,
      roundComplete,
      flipped,
      matched,
      moves,
      totalMoves,
      deck,
      round,
      startNextRound,
      finishGame,
    ],
  )

  const restartGame = useCallback(() => {
    clearPendingTimeouts()
    if (timerRef.current) clearInterval(timerRef.current)
    gameOverRef.current = false
    setGameOver(false)
    setRound(1)
    setDeck(
      createDeck(1, `memory:${state.today}:${state.gamesPlayed}:restart:${Date.now()}`),
    )
    setFlipped([])
    setMatched(new Set())
    setMoves(0)
    setTotalMoves(0)
    setLocked(false)
    setRoundComplete(false)
    setElapsed(0)
    startTime.current = performance.now()
    timerRef.current = setInterval(() => {
      const now = (performance.now() - startTime.current) / 1000
      setElapsed(now)
      if (now >= TIME_LIMIT) {
        finishGameRef.current(roundRef.current, totalMovesRef.current)
      }
    }, 250)
  }, [state.today, state.gamesPlayed, clearPendingTimeouts])

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
          <span>Round {round}</span>
          <span>{moves} moves</span>
          <span>
            {matchedPairs}/{pairs} matched
          </span>
        </div>

        <div
          className="memory-board"
          data-cols={cols}
          role="grid"
          aria-label="Memory card grid"
        >
          {deck.map((card, index) => {
            const isFlipped = flipped.includes(index)
            const isMatched = matched.has(index)
            const className = [
              'memory-card',
              isFlipped ? 'flipped' : '',
              isMatched ? 'matched' : '',
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <button
                key={`${round}-${card.id}`}
                type="button"
                className={className}
                onClick={() => handleCardClick(index)}
                disabled={isMatched}
                aria-label={
                  isFlipped || isMatched
                    ? `Card: ${card.symbol}`
                    : 'Face-down card'
                }
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
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={restartGame}
          >
            Restart Game
          </button>
        </div>

        {roundComplete && !gameOver && (
          <div className="memory-overlay" aria-live="polite">
            <h2>Round Complete!</h2>
            <p>
              {moves} moves &middot; Starting round {round + 1}...
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
