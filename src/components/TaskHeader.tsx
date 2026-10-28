import type { ReactNode } from 'react'
import './layout.css'

interface TaskHeaderProps {
  /** Close/exit control on the left. */
  left: ReactNode
  /** Title, e.g. "Game 3 of 3 · Spot The Difference". */
  title: ReactNode
  /** Status on the right, e.g. the timer. */
  right?: ReactNode
}

/** Top bar for focused screens (playing a game, viewing results) with no main nav. */
export default function TaskHeader({ left, title, right }: TaskHeaderProps) {
  return (
    <header className="task-header">
      {left}
      <h1 className="task-header-title">{title}</h1>
      <span>{right}</span>
    </header>
  )
}
