import { useState } from 'react'
import { useNavigate } from 'react-router'
import AppShell from '../components/AppShell.tsx'
import GameArt from '../components/GameArt.tsx'
import { GAMES, GAME_IDS, type GameId } from '../data/games.ts'
import { SURVEY } from '../data/survey.ts'
import { useAppState } from '../state/context.ts'
import { dailyOrder, reminderFor } from '../state/store.ts'
import type { PlayTime } from '../state/types.ts'
import './Onboarding.css'

const STEP_COUNT = SURVEY.length + 1

export default function Onboarding() {
  const { state, actions } = useAppState()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [focus, setFocus] = useState<GameId[]>(state.onboarding.focus)
  const [answers, setAnswers] = useState<Record<string, string>>(state.onboarding.answers)

  const when = (answers.when as PlayTime | undefined) ?? null
  const signedIn = state.account.kind === 'google'
  const reminder = when ? reminderFor(when) : null
  const plan = dailyOrder({ ...state, onboarding: { complete: true, focus, when, answers } })
  const question = SURVEY[step]
  const optional = question?.kind === 'choice' && question.optional
  const answered = !question || (question.kind === 'games' ? focus.length > 0 : answers[question.id] !== undefined)
  const canContinue = answered || optional

  const toggleFocus = (id: GameId) =>
    setFocus((current) => (current.includes(id) ? current.filter((g) => g !== id) : [...current, id]))

  const finish = async (withGoogle: boolean) => {
    actions.completeOnboarding({ focus, when, answers })
    if (withGoogle) {
      // null means we are being sent to Google; the app picks up again when they return.
      const result = await actions.signIn()
      if (!result) return
    }
    navigate('/home')
  }

  const skip = () => {
    actions.completeOnboarding({ focus: [], when: null, answers: {} })
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

        {question?.kind === 'games' && (
          <>
            <h1 id={`q-${question.id}`}>{question.title}</h1>
            {question.hint && <p className="onboarding-hint">{question.hint}</p>}
            <div className="option-list" role="group" aria-labelledby={`q-${question.id}`}>
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

        {question?.kind === 'choice' && (
          <>
            <h1 id={`q-${question.id}`}>{question.title}</h1>
            {question.hint && <p className="onboarding-hint">{question.hint}</p>}
            <div className="option-list" role="radiogroup" aria-labelledby={`q-${question.id}`}>
              {question.options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  className="option"
                  aria-checked={answers[question.id] === o.id}
                  onClick={() => setAnswers((current) => ({ ...current, [question.id]: o.id }))}
                >
                  {o.short ? (
                    <>
                      <span className="desktop-only">{o.label}</span>
                      <span className="mobile-only">{o.short}</span>
                    </>
                  ) : (
                    o.label
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        {step === SURVEY.length && (
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
              {reminder ? `We'll remind you at ${reminder}.` : 'No reminders. Play whenever you like.'}
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
              {optional && !answered ? 'Skip' : 'Next'}
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
