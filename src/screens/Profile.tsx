import { useNavigate } from 'react-router'
import MainShell from '../components/MainShell.tsx'
import { ACHIEVEMENTS } from '../data/achievements.ts'
import { GAMES, GAME_IDS } from '../data/games.ts'
import { formatNumber, plural } from '../lib/format.ts'
import { useAppState } from '../state/context.ts'
import { bestResult } from '../state/store.ts'
import type { Profile as ProfileData } from '../state/types.ts'
import './Profile.css'

const REMINDER_TIMES = ['7:00am', '8:00am', '12:00pm', '6:00pm', '7:00pm', '9:00pm']

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .replace(/[^A-Za-z]/g, '')
    .slice(0, 2)
    .toUpperCase()
}

/** Points, the same number the leaderboard ranks by. */
function formatPoints(points: number | undefined) {
  return points === undefined ? '–' : formatNumber(points)
}

export default function Profile() {
  const { state, actions } = useAppState()
  const navigate = useNavigate()
  const profile = state.account.kind === 'google' ? state.account.profile : null

  // Signed-in players get their achievements from the database; guests and the demo account use local play.
  const fromDatabase = state.account.kind === 'google' && state.account.userId !== undefined
  const earnedNames = new Set((state.earnedAchievements ?? []).map((n) => n.trim().toLowerCase()))
  const achievements = ACHIEVEMENTS.map((a) => ({
    ...a,
    isEarned: fromDatabase ? earnedNames.has(a.name.trim().toLowerCase()) : a.earned(state),
  })).sort(
    (a, b) => Number(b.isEarned) - Number(a.isEarned),
  )

  return (
    <MainShell
      mobileRight={
        <a href="#account" className="link-button">
          Settings
        </a>
      }
    >
      <div className="profile">
        <section className="profile-card" aria-label="Player">
          <div className="profile-id">
            <div className="avatar" aria-hidden="true">
              {profile ? initials(profile.name) : '?'}
            </div>
            <h1 className="profile-name">{profile?.name ?? 'Guest'}</h1>
            <p className="profile-best">
              Best streak<span className="desktop-only">:</span> {plural(state.bestStreak, 'day')}
            </p>
          </div>

          <div id="account" className="account">
            <h2>Account</h2>
            {profile ? (
              <AccountSettings
                profile={profile}
                onChange={actions.updateProfile}
                onRedoSurvey={() => navigate('/onboarding?redo=1')}
                onSignOut={() => {
                  actions.signOut()
                  navigate('/')
                }}
              />
            ) : (
              <>
                <span>Playing as a guest. Progress isn't saved.</span>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => actions.signIn()}>
                  Continue with Google
                </button>
              </>
            )}
          </div>
        </section>

        <section className="profile-main">
          <h2>Achievements</h2>
          <ul className="achievements">
            {achievements.map((a) => (
              <li
                key={a.id}
                className={`achievement${a.isEarned ? '' : ' is-locked'}`}
                title={a.isEarned ? a.how : `Locked. ${a.how} to unlock.`}
              >
                <div className="achievement-tile" aria-hidden="true">
                  {a.isEarned ? '' : '?'}
                </div>
                {a.isEarned ? a.name : 'Locked'}
              </li>
            ))}
          </ul>

          <h2>High scores</h2>
          <dl className="high-scores">
            {GAME_IDS.map((id) => (
              <div key={id}>
                <dt>{GAMES[id].name}</dt>
                <dd>{formatPoints(bestResult(state, id)?.points)}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </MainShell>
  )
}

interface AccountSettingsProps {
  profile: ProfileData
  onChange: (changes: Partial<ProfileData>) => void
  onRedoSurvey: () => void
  onSignOut: () => void
}

function AccountSettings({ profile, onChange, onRedoSurvey, onSignOut }: AccountSettingsProps) {
  return (
    <>
      <span>Google login</span>

      <label>
        Reminder:{' '}
        <select
          value={profile.reminder ?? 'off'}
          onChange={(e) => onChange({ reminder: e.target.value === 'off' ? null : e.target.value })}
        >
          {REMINDER_TIMES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
          <option value="off">Off</option>
        </select>
      </label>

      <span>
        <button type="button" className="link-button" onClick={onRedoSurvey}>
          Redo survey
        </button>
      </span>

      <span>
        <button type="button" className="link-button" onClick={onSignOut}>
          Sign out
        </button>
      </span>
    </>
  )
}
