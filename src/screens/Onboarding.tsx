import { useState } from 'react'
import { useNavigate } from 'react-router'
import AppShell from '../components/AppShell.tsx'
import GameArt from '../components/GameArt.tsx'
import { GAMES, GAME_IDS, type GameId } from '../data/games.ts'
import { useAppState } from '../state/context.ts'
import { dailyOrder } from '../state/store.ts'
import type { PlayTime } from '../state/types.ts'
import './Onboarding.css'

const PLAY_TIMES: { id: PlayTime; label: string; short: string; reminder: string | null }[] = [
  { id: 'commute', label: 'On my commute (offline)', short: 'On my commute', reminder: '8:00am' },
  { id: 'morning', label: 'Morning', short: 'Morning', reminder: '8:00am' },
  { id: 'evening', label: 'Evening', short: 'Evening', reminder: '7:00pm' },
  { id: 'whenever', label: 'Whenever I remember', short: 'Whenever', reminder: null },
]

const STEP_COUNT = 3

export default function Onboarding() {
  const { state, actions } = useAppState()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [focus, setFocus] = useState<GameId[]>(state.onboarding.focus)
  const [when, setWhen] = useState<PlayTime | null>(state.onboarding.when)

  const signedIn = state.account.kind === 'google'
  const playTime = PLAY_TIMES.find((t) => t.id === when)
  const plan = dailyOrder({ ...state, onboarding: { complete: true, focus, when } })
  const canContinue = step === 0 ? focus.length > 0 : step === 1 ? when !== null : true

  const toggleFocus = (id: GameId) =>
    setFocus((current) => (current.includes(id) ? current.filter((g) => g !== id) : [...current, id]))

  const finish = (withGoogle: boolean) => {
    actions.completeOnboarding({ focus, when })
    if (withGoogle) actions.signIn()
    if (withGoogle || signedIn) actions.updateProfile({ reminder: playTime?.reminder ?? null })
    navigate('/home')
  }

  const skip = () => {
    actions.completeOnboarding({ focus: [], when: null })
    navigate('/home')
  }

  return (
    <AppShell
      right={
        <button type="button" className="link-button" onClick={skip}>
          Skip
        </button>
      }
    >
      <div className="onboarding">
        <div className="onboarding-progress" aria-hidden="true">
          {Array.from({ length: STEP_COUNT }, (_, i) => (
            <span key={i} className={i <= step ? 'done' : undefined} />
          ))}
        </div>
        <p className="onboarding-step">
          Step {step + 1} of {STEP_COUNT}
        </p>

        {step === 0 && (
          <>
            <h1 id="q-focus">What do you want to train?</h1>
            <p className="onboarding-hint">Pick any. We'll put these first in your daily three.</p>
            <div className="option-list" role="group" aria-labelledby="q-focus">
              {GAME_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="option"
                  aria-pressed={focus.includes(id)}
                  onClick={() => toggleFocus(id)}
                >
                  {GAMES[id].trains}
                  <small>{GAMES[id].name}</small>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h1 id="q-when">When do you usually play?</h1>
            <div className="option-list" role="radiogroup" aria-labelledby="q-when">
              {PLAY_TIMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  className="option"
                  aria-checked={when === t.id}
                  onClick={() => setWhen(t.id)}
                >
                  <span className="desktop-only">{t.label}</span>
                  <span className="mobile-only">{t.short}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1>Your plan</h1>
            <p className="onboarding-hint">Three games a day, about 6 minutes. Finish all three to add a day to your streak.</p>
            <ol className="plan-list">
              {plan.map((id) => (
                <li key={id}>
                  <GameArt game={id} />
                  <div>
                    <b>{GAMES[id].name}</b>
                    {GAMES[id].title}
                  </div>
                  {focus.includes(id) && <span className="badge">Focus</span>}
                </li>
              ))}
            </ol>
            <p className="plan-reminder">
              {playTime?.reminder
                ? `We'll remind you at ${playTime.reminder}.`
                : 'No reminders. Play whenever you like.'}
              {when === 'commute' && ' Games work offline, so no signal is fine.'}
            </p>
            {!signedIn && (
              <div className="panel plan-save">
                <b>Keep your progress?</b>
                <p>Sign in with Google to save your streak and scores. Guests can play now and sign in later.</p>
              </div>
            )}
          </>
        )}

        <div className="onboarding-actions">
          {step > 0 && (
            <button type="button" className="btn btn-outline" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          {step < STEP_COUNT - 1 && (
            <button type="button" className="btn btn-dark" disabled={!canContinue} onClick={() => setStep(step + 1)}>
              Next
            </button>
          )}
          {step === STEP_COUNT - 1 && signedIn && (
            <button type="button" className="btn btn-dark" onClick={() => finish(false)}>
              Start playing
            </button>
          )}
          {step === STEP_COUNT - 1 && !signedIn && (
            <>
              <button type="button" className="btn btn-outline" onClick={() => finish(false)}>
                Play as guest
              </button>
              <button type="button" className="btn btn-primary" onClick={() => finish(true)}>
                Continue with Google
              </button>
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
