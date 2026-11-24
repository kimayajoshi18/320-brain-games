import { Navigate, useParams } from 'react-router'
import { isGameId } from '../data/games.ts'
import ColorGame from '../games/colors/ColorGame.tsx'
import ColorWordGame from '../games/colorword/ColorWordGame.tsx'
import MemoryGame from '../games/memory/MemoryGame.tsx'
import NumbersGame from '../games/numbers/NumbersGame.tsx'
import GamePlaceholder from '../games/GamePlaceholder.tsx'

export default function Play() {
  const { gameId } = useParams()
  if (!isGameId(gameId)) return <Navigate to="/home" replace />
  if (gameId === 'colors') return <ColorGame />
  if (gameId === 'memory') return <MemoryGame />
  if (gameId === 'numbers') return <NumbersGame />
  if (gameId === 'colorword') return <ColorWordGame />
  return <GamePlaceholder key={gameId} gameId={gameId} />
}
