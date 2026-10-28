import { Link } from 'react-router'

export default function ExitLink() {
  return (
    <Link to="/home" className="task-header-close" aria-label="Exit game">
      ✕<span className="long"> Exit</span>
    </Link>
  )
}
