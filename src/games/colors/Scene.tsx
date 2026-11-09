import type { MouseEvent } from 'react'
import type { Puzzle, Shape } from './puzzle.ts'

/**
 * Puzzle colors are fixed hex values; draw each through a CSS variable so the
 * scene can switch to a dark palette (see the --scene-* tokens in global.css).
 */
const SCENE_COLOR_VARS: Record<string, string> = {
  '#f4f1ea': '--scene-bg',
  '#881c1c': '--scene-red',
  '#d9a62e': '--scene-yellow',
  '#2f6d8c': '--scene-blue',
  '#3f8f5a': '--scene-green',
  '#e07a5f': '--scene-coral',
  '#6c4f9e': '--scene-purple',
  '#111111': '--scene-ink',
  '#8fb8c9': '--scene-sky',
}

const paint = (color: string) => {
  const variable = SCENE_COLOR_VARS[color.toLowerCase()]
  return variable ? `var(${variable}, ${color})` : color
}

export interface Miss {
  key: number
  x: number
  y: number
  scene: 'a' | 'b'
}

interface SceneProps {
  label: string
  scene: 'a' | 'b'
  puzzle: Puzzle
  shapes: Shape[]
  found: number[]
  hinted: number | null
  misses: Miss[]
  onTap: (x: number, y: number) => void
}

export default function Scene({ label, scene, puzzle, shapes, found, hinted, misses, onTap }: SceneProps) {
  const handleClick = (event: MouseEvent<SVGSVGElement>) => {
    const svg = event.currentTarget
    const matrix = svg.getScreenCTM()
    if (!matrix) return
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    // Ignore taps in the letterbox around the scene.
    if (point.x < 0 || point.y < 0 || point.x > puzzle.width || point.y > puzzle.height) return
    onTap(point.x, point.y)
  }

  return (
    <svg
      className="scene"
      viewBox={`0 0 ${puzzle.width} ${puzzle.height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={label}
      onClick={handleClick}
    >
      <rect width={puzzle.width} height={puzzle.height} fill={paint(puzzle.background)} />
      {shapes.map((s) => (
        <ShapeMark key={s.id} shape={s} />
      ))}
      {found.map((id) => {
        const s = puzzle.shapes[id]
        const size = s.r * 2 + 18
        return (
          <rect
            key={`found-${id}`}
            className="scene-found"
            x={s.x - size / 2}
            y={s.y - size / 2}
            width={size}
            height={size}
          />
        )
      })}
      {hinted !== null && scene === 'b' && (
        <circle
          className="scene-hint"
          cx={puzzle.shapes[hinted].x}
          cy={puzzle.shapes[hinted].y}
          r={puzzle.shapes[hinted].r + 22}
        />
      )}
      {misses
        .filter((m) => m.scene === scene)
        .map((m) => (
          <g key={m.key} className="scene-miss" transform={`translate(${m.x} ${m.y})`}>
            <path d="M-10 -10 L10 10 M10 -10 L-10 10" />
          </g>
        ))}
    </svg>
  )
}

function ShapeMark({ shape: s }: { shape: Shape }) {
  const transform = `rotate(${s.rotation} ${s.x} ${s.y})`
  switch (s.kind) {
    case 'circle':
      return <circle cx={s.x} cy={s.y} r={s.r} fill={paint(s.color)} />
    case 'square':
      return <rect x={s.x - s.r} y={s.y - s.r} width={s.r * 2} height={s.r * 2} fill={paint(s.color)} transform={transform} />
    case 'triangle':
      return (
        <polygon
          points={`${s.x},${s.y - s.r} ${s.x + s.r},${s.y + s.r * 0.8} ${s.x - s.r},${s.y + s.r * 0.8}`}
          fill={paint(s.color)}
          transform={transform}
        />
      )
    case 'diamond':
      return (
        <polygon
          points={`${s.x},${s.y - s.r} ${s.x + s.r},${s.y} ${s.x},${s.y + s.r} ${s.x - s.r},${s.y}`}
          fill={paint(s.color)}
          transform={transform}
        />
      )
  }
}
