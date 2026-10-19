import { Link } from 'react-router'

export default function Brand({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="brand" aria-label="Puzzlr home">
      <span className="brand-mark" aria-hidden="true" />
      <span>Puzzlr</span>
    </Link>
  )
}
