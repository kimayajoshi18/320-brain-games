import type { CSSProperties, RefObject } from 'react'
import { equationCells, OP_LABEL, type Equation, type Puzzle } from './puzzle.ts'


interface Props {
    puzzle: Puzzle
    drafts: Record<number, string>
    solved: number[]
    hinted: Equation | null
    wrong: number | null
    inputRefs: RefObject<Map<number, HTMLInputElement>>
    onChange: (index: number, text: string) => void
    onSubmit: (index: number) => void
}

export default function NumberGrid({ puzzle, drafts, solved, hinted, wrong, inputRefs, onChange, onSubmit }: Props) {
    const hintedCells = hinted ? equationCells(hinted) : []
    const classes = (i: number, ...extra: (string | false)[]) =>
    ['numbers-cell', ...extra, hintedCells.includes(i) && 'hinted'].filter(Boolean).join(' ')
    return (
    <div className="numbers-grid" style={{ '--size': puzzle.size } as CSSProperties}
         role="group" aria-label="Number crossword">
            {puzzle.cells.map((cell, i) => {
                if (cell.kind === 'block') return <div key={i} className="numbers-cell block" />
                if (cell.kind === 'op') return <div key={i} className={classes(i, 'symbol')}>{OP_LABEL[cell.op]}</div>
                if (cell.kind === 'equals') return <div key={i} className={classes(i, 'symbol')}>=</div>
                if (cell.given) return <div key={i} className={classes(i, 'given')}>{cell.answer}</div>
                const isSolved = solved.includes(i)
                return (
                <input
                key={i}
                className={classes(i, 'blank', isSolved && 'solved', wrong === i && 'wrong')}
                inputMode="numeric"
                maxLength={2}
                autoComplete="off"
                aria-label={`Row ${Math.floor(i / puzzle.size) + 1}, column ${(i % puzzle.size) + 1}`}
                readOnly={isSolved}
                value={drafts[i] ?? ''}
                ref={(el) => {
                    if (el) inputRefs.current.set(i, el)
                    else inputRefs.current.delete(i)
                }}
                onChange={(e) => onChange(i, e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') onSubmit(i)
                }}
                onBlur={() => onSubmit(i)}
            />
        )
      })}
    </div>
  )
}
