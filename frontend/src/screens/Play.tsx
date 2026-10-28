import { Navigate, useParams } from 'react-router'
import { isGameId } from '../data/games.ts'
import ColorGame from '../games/colors/ColorGame.tsx'
import GamePlaceholder from '../games/GamePlaceholder.tsx'

export default function Play() {
  const { gameId } = useParams()
  if (!isGameId(gameId)) return <Navigate to="/home" replace />
  if (gameId === 'colors') return <ColorGame />
  return <GamePlaceholder key={gameId} gameId={gameId} />
}
