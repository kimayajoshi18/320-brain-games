import { createRandom } from '../../lib/random.ts'

export type ShapeKind = 'circle' | 'square' | 'triangle' | 'diamond'

export interface Shape {
  id: number
  kind: ShapeKind
  x: number
  y: number
  /** Half the shape's size, in scene units. */
  r: number
  rotation: number
  color: string
}

export interface Puzzle {
  width: number
  height: number
  background: string
  /** Scene A. */
  shapes: Shape[]
  /** Shape id -> the different color it has in scene B. */
  differences: Map<number, string>
}

export const DIFFERENCE_COUNT = 5

const PALETTE = ['#881c1c', '#d9a62e', '#2f6d8c', '#3f8f5a', '#e07a5f', '#6c4f9e', '#111111', '#8fb8c9']
const KINDS: ShapeKind[] = ['circle', 'square', 'triangle', 'diamond']
const COLS = 5
const ROWS = 4

/** Builds a scene of shapes on a jittered grid, then recolors five of them for scene B. */
export function createPuzzle(seed: string): Puzzle {
  const rand = createRandom(seed)
  const width = 400
  const height = 300
  const cellW = width / COLS
  const cellH = height / ROWS

  const shapes: Shape[] = []
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      // Leave the odd cell empty so the scene doesn't look like a spreadsheet.
      if (rand.next() < 0.12) continue
      const r = rand.int(15, 25)
      const jitterX = cellW / 2 - r - 4
      const jitterY = cellH / 2 - r - 4
      shapes.push({
        id: shapes.length,
        kind: rand.pick(KINDS),
        x: col * cellW + cellW / 2 + (rand.next() * 2 - 1) * jitterX,
        y: row * cellH + cellH / 2 + (rand.next() * 2 - 1) * jitterY,
        r,
        rotation: rand.int(-20, 20),
        color: rand.pick(PALETTE),
      })
    }
  }

  const differences = new Map<number, string>()
  for (const shape of rand.shuffle(shapes).slice(0, DIFFERENCE_COUNT)) {
    differences.set(shape.id, rand.pick(PALETTE.filter((c) => c !== shape.color)))
  }

  return { width, height, background: '#f4f1ea', shapes, differences }
}

export function shapesForScene(puzzle: Puzzle, scene: 'a' | 'b'): Shape[] {
  if (scene === 'a') return puzzle.shapes
  return puzzle.shapes.map((s) => {
    const color = puzzle.differences.get(s.id)
    return color ? { ...s, color } : s
  })
}

/** The unfound difference under a tap, if any. Taps get some slack around each shape. */
export function differenceAt(puzzle: Puzzle, x: number, y: number, found: number[]): number | null {
  let best: { id: number; dist: number } | null = null
  for (const id of puzzle.differences.keys()) {
    if (found.includes(id)) continue
    const s = puzzle.shapes[id]
    const dist = Math.hypot(s.x - x, s.y - y)
    if (dist <= s.r + 12 && (!best || dist < best.dist)) best = { id, dist }
  }
  return best?.id ?? null
}

/** 150 points per difference plus a bonus for finishing under 90 seconds. */
export function scoreFor(totalSeconds: number): number {
  return DIFFERENCE_COUNT * 150 + Math.max(0, Math.round((90 - totalSeconds) * 6))
}
