import { formatDuration } from '../lib/format.ts'

export interface Penalty {
  key: number
  seconds: number
}

export default function GameTimer({ seconds, penalty }: { seconds: number; penalty: Penalty | null }) {
  return (
    <span className="game-timer" role="timer" aria-label={`Time ${formatDuration(seconds)}`}>
      {penalty && (
        <span key={penalty.key} className="game-penalty" aria-hidden="true">
          +{penalty.seconds}s
        </span>
      )}
      {formatDuration(seconds)}
    </span>
  )
}
