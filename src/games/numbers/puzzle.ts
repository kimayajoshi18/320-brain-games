import {createRandom} from '../../lib/random.ts'

export type Op = "+" | "-" | "*" | "/"
export type Cell = 
    | {kind: 'number', answer: number; given: boolean}
    | {kind: Op, op: Op}
    | {kind: 'equals'}
    | {kind: 'block'}

export interface Equation {
    id: number;
    direction: 'across' | 'down';
    /** Cell Indexes. **/
    left: number, op: number, right: number, equals: number, result: number;
}

export interface Puzzle {
    size: number
    cells: Cell[]
    equations: Equation[]
    blanks: number[]
}

export const SIZE = 5
export const BLANK_COUNT = 4
const MAX_VALUE = 99 /* maximum value for numbers */
const OPS: Op[] = ['+', '-', '*', '/']
export const OP_LABEL: Record<Op, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' }

export const at = (row:number, col:number) => row*SIZE + col
const LINES: Omit<Equation, 'id'>[] = [
    { direction: 'across', left: at(0, 0), op: at(0, 1), right: at(0, 2), equals: at(0, 3), result: at(0, 4) },
    { direction: 'across', left: at(2, 0), op: at(2, 1), right: at(2, 2), equals: at(2, 3), result: at(2, 4) },
    { direction: 'down',   left: at(0, 0), op: at(1, 0), right: at(2, 0), equals: at(3, 0), result: at(4, 0) },
    { direction: 'down',   left: at(0, 2), op: at(1, 2), right: at(2, 2), equals: at(3, 2), result: at(4, 2) },
]

/** The four numbers every equation is built from: a, b, d, e. */
const STARTING_CELLS = [at(0, 0), at(0, 2), at(2, 0), at(2, 2)]

export function equationCells(eq: Equation): number[] {
  return [eq.left, eq.op, eq.right, eq.equals, eq.result]
}

export function createPuzzle(seed: string): Puzzle {
  const rand = createRandom(seed)
  const equations = LINES.map((line, id) => ({ ...line, id }))

  for (;;) {
    // 1. Starting numbers 1–9 (no zeros, so "0 × ? = 0" can't have many answers) and one operator per equation.
    const values = new Map<number, number>()
    for (const i of STARTING_CELLS) values.set(i, rand.int(1, 9))
    const ops = equations.map(() => rand.pick(OPS))

    // 2. Work out each result. Start again if one isn't a whole number from 0 to 99.
    let valid = true
    for (const [k, eq] of equations.entries()) {
      const value = apply(values.get(eq.left) ?? 0, ops[k], values.get(eq.right) ?? 0)
      if (value === null) {
        valid = false
        break
      }
      values.set(eq.result, value)
    }
    if (!valid) continue

    // 3. Hide some numbers. Keep them only if they can be worked out one at a time.
    const blanks = rand
      .shuffle([...values.keys()])
      .slice(0, BLANK_COUNT)
      .sort((x, y) => x - y)
    if (!solvable(equations, blanks)) continue

    // 4. Lay out the board.
    const cells = Array.from({ length: SIZE * SIZE }, (): Cell => ({ kind: 'block' }))
    for (const [k, eq] of equations.entries()) {
      cells[eq.op] = { kind: 'op', op: ops[k] }
      cells[eq.equals] = { kind: 'equals' }
    }
    for (const [i, answer] of values) cells[i] = { kind: 'number', answer, given: !blanks.includes(i) }

    return { size: SIZE, cells, equations, blanks }
  }
}

function calculate(a: number, op: Op, b: number): number | null {
  switch (op) {
    case '+':
      return a + b
    case '-':
      return a - b
    case '*':
      return a * b
    case '/':
      return b !== 0 && a % b === 0 ? a / b : null
  }
}

export function apply(a: number, op: Op, b: number): number | null {
    const value = calculate(a, op, b)
    return value !== null && value >= 0 && value <= MAX_VALUE ? value : null
    }

export function solvable(equations: Equation[], blanks: number[]): boolean {
    const unknown = new Set(blanks)
    let progress = true
    while (unknown.size > 0 && progress) {
        progress = false
        for (const eq of equations) {
            const gaps = [eq.left, eq.right, eq.result].filter((i) => unknown.has(i))
            if (gaps.length === 1) {
                unknown.delete(gaps[0])
                progress = true
      }
    }
  }
  return unknown.size === 0
    }

export function isCorrect(puzzle: Puzzle, index: number, value: number): boolean {
    const cell = puzzle.cells[index]
    return cell.kind === 'number' && cell.answer === value
    }

export function hintEquation(puzzle: Puzzle, solved: number[]): Equation | null {
    const open = (i: number) => puzzle.blanks.includes(i) && !solved.includes(i)
    return puzzle.equations.find((eq) => [eq.left, eq.right, eq.result].filter(open).length === 1) ?? null
}