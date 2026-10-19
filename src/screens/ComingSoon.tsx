import { Link } from 'react-router'
import AppShell from '../components/AppShell.tsx'

/** Temporary stand-in for screens that haven't been built yet. */
export default function ComingSoon({ name }: { name: string }) {
  return (
    <AppShell nav>
      <h1 style={{ fontSize: 40, fontWeight: 900 }}>{name}</h1>
      <p className="muted" style={{ marginTop: 12, fontSize: 20 }}>
        This screen is coming soon. <Link to="/">Back to start</Link>
      </p>
    </AppShell>
  )
}
