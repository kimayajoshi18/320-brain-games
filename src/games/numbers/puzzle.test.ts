import { describe, expect, it } from 'vitest'
import { apply, BLANK_COUNT, createPuzzle, hintEquation, solvable, type Puzzle } from './puzzle.ts'

const puzzles = Array.from({ length: 50 }, (_, i) => createPuzzle(`seed-${i}`))

function answerAt(puzzle: Puzzle, index: number): number {
  const cell = puzzle.cells[index]
  if (cell.kind !== 'number') throw new Error(`cell ${index} is not a number`)
  return cell.answer
}

describe('apply', () => {
  it('only allows whole numbers from 0 to 99', () => {
    expect(apply(9, '*', 9)).toBe(81)
    expect(apply(8, '/', 4)).toBe(2)
    expect(apply(7, '/', 2)).toBeNull()
    expect(apply(3, '-', 5)).toBeNull()
  })
})

describe('createPuzzle', () => {
  it('builds the same puzzle from the same seed', () => {
    expect(createPuzzle('abc')).toEqual(createPuzzle('abc'))
  })

  it('makes every equation true', () => {
    for (const p of puzzles) {
      for (const eq of p.equations) {
        const op = p.cells[eq.op]
        if (op.kind !== 'op') throw new Error('expected an operator')
        expect(apply(answerAt(p, eq.left), op.op, answerAt(p, eq.right))).toBe(answerAt(p, eq.result))
      }
    }
  })

  it('hides BLANK_COUNT numbers that can be worked out one at a time', () => {
    for (const p of puzzles) {
      expect(p.blanks).toHaveLength(BLANK_COUNT)
      for (const i of p.blanks) expect(p.cells[i]).toMatchObject({ kind: 'number', given: false })
      expect(solvable(p.equations, p.blanks)).toBe(true)
    }
  })
})

describe('hintEquation', () => {
  it('always points at an equation with exactly one gap, until the puzzle is done', () => {
    for (const p of puzzles) {
      const solved: number[] = []
      while (solved.length < p.blanks.length) {
        const eq = hintEquation(p, solved)
        if (!eq) throw new Error('no hint while blanks are left')
        const gaps = [eq.left, eq.right, eq.result].filter((i) => p.blanks.includes(i) && !solved.includes(i))
        expect(gaps).toHaveLength(1)
        solved.push(gaps[0])
      }
      expect(hintEquation(p, solved)).toBeNull()
    }
  })
})