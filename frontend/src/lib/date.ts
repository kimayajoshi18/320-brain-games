/** Dates are stored as local calendar days in YYYY-MM-DD form. */
export type DayKey = string

export function toDayKey(date: Date): DayKey {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayKey(): DayKey {
  return toDayKey(new Date())
}

export function fromDayKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: DayKey, days: number): DayKey {
  const date = fromDayKey(key)
  date.setDate(date.getDate() + days)
  return toDayKey(date)
}

/** Monday-first index of the weekday (Mon = 0 ... Sun = 6). */
export function weekdayIndex(key: DayKey): number {
  return (fromDayKey(key).getDay() + 6) % 7
}
