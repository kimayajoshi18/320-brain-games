const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** Seven cells for this week, filled for each day the daily three were finished. */
export default function WeekBar({ days, className }: { days: boolean[]; className?: string }) {
  return (
    <div className={['week-bar', className].filter(Boolean).join(' ')} role="list" aria-label="This week">
      {days.map((done, i) => (
        <span
          key={i}
          role="listitem"
          className={done ? 'done' : undefined}
          title={`${DAY_NAMES[i]}: ${done ? 'done' : 'not done'}`}
          aria-label={`${DAY_NAMES[i]}: ${done ? 'done' : 'not done'}`}
        />
      ))}
    </div>
  )
}
