import { Navigate, useNavigate } from 'react-router'
import AppShell from '../components/AppShell.tsx'
import GameArt from '../components/GameArt.tsx'
import { GAMES, GAME_IDS } from '../data/games.ts'
import { useAppState } from '../state/context.ts'
import './Landing.css'

export default function Landing() {
  const { state, actions } = useAppState()
  const navigate = useNavigate()

  // Returning players skip straight to today's games.
  if (state.onboarding.complete) return <Navigate to="/home" replace />

  const signIn = () => {
    const { onboarded } = actions.signIn()
    navigate(onboarded ? '/home' : '/onboarding')
  }

  return (
    <AppShell
      className="landing"
      right={
        <button type="button" className="link-button" onClick={signIn}>
          Log in
        </button>
      }
    >
      <section className="landing-hero">
        <div className="landing-art">
          {GAME_IDS.map((id) => (
            <GameArt key={id} game={id} />
          ))}
        </div>
        <h1 className="landing-title">Train your brain. Three games a day.</h1>
        <p className="landing-sub">Free. No ads. No sign-up needed. Works offline.</p>
        <div className="landing-actions">
          <button type="button" className="btn btn-primary" onClick={() => navigate('/onboarding')}>
            Play as guest
          </button>
          <button type="button" className="btn btn-outline" onClick={signIn}>
            Continue with Google
          </button>
        </div>
        <p className="landing-note">Guests play right away. Sign in any time to keep your progress.</p>
      </section>

      <section className="landing-games" aria-label="Games">
        {GAME_IDS.map((id) => (
          <div key={id} className="landing-game">
            <GameArt game={id} />
            <div>
              <b>{GAMES[id].name}</b>
              <span>{GAMES[id].trains}</span>
            </div>
          </div>
        ))}
      </section>
    </AppShell>
  )
}
