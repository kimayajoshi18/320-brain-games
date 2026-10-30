export function warn(what: string, error: unknown) {
  const message = error instanceof Error ? error.message : (error as { message?: string } | null)?.message
  console.warn(`Could not ${what}:`, message ?? error)
}

/** Runs one database step; a failure is logged and does not stop the steps after it. */
export async function attempt(what: string, step: () => Promise<void>): Promise<boolean> {
  try {
    await step()
    return true
  } catch (error) {
    warn(what, error)
    return false
  }
}

/** crypto.randomUUID only exists on secure pages (https or localhost), so fall back for a LAN address. */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

let queue: Promise<unknown> = Promise.resolve()

/** Runs database work one task at a time, in the order it was asked for. */
export function inOrder<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  queue = run.catch(() => undefined)
  return run
}
