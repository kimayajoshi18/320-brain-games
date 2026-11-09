import { formatDuration } from '../lib/format.ts'

export interface Penalty {
  key: number
  /** What the mistake cost, e.g. "−50 pts". */
  label: string
}

export default function GameTimer({ seconds, penalty }: { seconds: number; penalty: Penalty | null }) {
  return (
    <span className="game-timer" role="timer" aria-label={`Time ${formatDuration(seconds)}`}>
      {penalty && (
        <span key={penalty.key} className="game-penalty" aria-hidden="true">
          {penalty.label}
        </span>
      )}
      {formatDuration(seconds)}
    </span>
  )
}
