/** Dates are stored as local calendar days in YYYY-MM-DD form. */
export type DayKey = string

export function toDayKey(date: Date): DayKey {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

let timeZone: string | undefined
let formatter: Intl.DateTimeFormat | undefined

export function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Sets the time zone that decides which calendar day a moment falls on. Invalid or empty means the browser's. */
export function setTimezone(tz: string | null | undefined) {
  timeZone = tz && isValidTimezone(tz) ? tz : undefined
  formatter = undefined
}

/** The calendar day an instant falls on in the player's time zone. */
export function dayKeyOf(instant: Date): DayKey {
  formatter ??= new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
  const part = (type: string) => formatter!.formatToParts(instant).find((p) => p.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function todayKey(): DayKey {
  return dayKeyOf(new Date())
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
