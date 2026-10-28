const numberFormat = new Intl.NumberFormat('en-US')

export function formatNumber(n: number): string {
  return numberFormat.format(n)
}

/** 52 -> "0:52", 124 -> "2:04" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}
