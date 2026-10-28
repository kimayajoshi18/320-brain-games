import type { GameId } from '../data/games.ts'

/** Simple line drawings standing in for game thumbnails. */
export default function GameArt({ game, className }: { game: GameId; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 80"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      {game === 'memory' && <MemoryArt />}
      {game === 'numbers' && <NumbersArt />}
      {game === 'colors' && <ColorsArt />}
    </svg>
  )
}

function MemoryArt() {
  const cards = [
    { x: 22, y: 10, up: true, shape: 'circle' },
    { x: 50, y: 10, up: false },
    { x: 78, y: 10, up: false },
    { x: 22, y: 44, up: false },
    { x: 50, y: 44, up: true, shape: 'circle' },
    { x: 78, y: 44, up: false },
  ]
  return (
    <g strokeWidth="3" stroke="var(--ink)">
      {cards.map((c, i) => (
        <g key={i}>
          <rect x={c.x} y={c.y} width="20" height="26" fill={c.up ? 'var(--paper)' : 'var(--red)'} />
          {c.up && <circle cx={c.x + 10} cy={c.y + 13} r="5" fill="var(--ink)" stroke="none" />}
        </g>
      ))}
    </g>
  )
}

function NumbersArt() {
  const digits = ['4', '', '9', '', '7', '', '2', '', '5']
  return (
    <g>
      <rect x="33" y="4" width="54" height="72" fill="var(--paper)" stroke="var(--ink)" strokeWidth="3" />
      {[1, 2].map((i) => (
        <line key={`v${i}`} x1={33 + i * 18} y1="4" x2={33 + i * 18} y2="76" stroke="var(--ink)" strokeWidth="2" />
      ))}
      {[1, 2].map((i) => (
        <line key={`h${i}`} x1="33" y1={4 + i * 24} x2="87" y2={4 + i * 24} stroke="var(--ink)" strokeWidth="2" />
      ))}
      <rect x="52" y="29" width="16" height="22" fill="var(--red)" />
      {digits.map((d, i) =>
        d ? (
          <text
            key={i}
            x={42 + (i % 3) * 18}
            y={22 + Math.floor(i / 3) * 24}
            textAnchor="middle"
            fontSize="14"
            fontWeight="800"
            fontFamily="var(--font)"
            fill={i === 4 ? 'var(--paper)' : 'var(--ink)'}
          >
            {d}
          </text>
        ) : null,
      )}
    </g>
  )
}

function ColorsArt() {
  return (
    <g strokeWidth="3" stroke="var(--ink)">
      <rect x="10" y="12" width="46" height="56" fill="var(--paper)" />
      <rect x="64" y="12" width="46" height="56" fill="var(--paper)" />
      <circle cx="25" cy="30" r="8" fill="var(--ink)" stroke="none" />
      <rect x="34" y="44" width="14" height="14" fill="var(--grey-4)" stroke="none" />
      <circle cx="79" cy="30" r="8" fill="var(--ink)" stroke="none" />
      <rect x="88" y="44" width="14" height="14" fill="var(--red)" stroke="none" />
      <rect x="84" y="40" width="22" height="22" fill="none" stroke="var(--red)" strokeWidth="2" />
    </g>
  )
}
