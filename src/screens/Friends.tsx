import { useState } from 'react'
import MainShell from '../components/MainShell.tsx'
import { FRIENDS } from '../data/mock.ts'
import { addDays, weekdayIndex } from '../lib/date.ts'
import { formatNumber, plural } from '../lib/format.ts'
import { useAppState } from '../state/context.ts'
import { bestPoints } from '../state/store.ts'
import './Friends.css'

type Range = 'week' | 'allTime'

/** The Contact Picker API is only in some browsers (mostly Chrome on Android). */
type ContactsNavigator = Navigator & {
  contacts?: { select: (props: string[], options?: { multiple?: boolean }) => Promise<unknown[]> }
}

const inviteUrl = () => `${window.location.origin}/?ref=invite`

export default function Friends() {
  const { state, actions } = useAppState()
  const [range, setRange] = useState<Range>('week')
  const [inviteStatus, setInviteStatus] = useState<string | null>(null)

  if (state.account.kind === 'guest') {
    return (
      <MainShell>
        <div className="panel friends-signin">
          <b>Sign in to see your friends</b>
          <p className="muted">
            Leaderboards rank you against your friends' high scores. Sign in with Google to add friends and keep your
            scores.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => actions.signIn()}>
            Continue with Google
          </button>
        </div>
      </MainShell>
    )
  }

  const monday = addDays(state.today, -weekdayIndex(state.today))
  const you = range === 'week' ? bestPoints(state, monday) : bestPoints(state)
  const rows = [
    ...FRIENDS.map((f) => ({ name: f.name, score: range === 'week' ? f.week : f.allTime, isYou: false })),
    { name: 'You', score: you, isYou: true },
  ].sort((a, b) => b.score - a.score)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl())
      setInviteStatus('Link copied. Send it to a friend.')
    } catch {
      setInviteStatus(`Copy this link: ${inviteUrl()}`)
    }
  }

  const fromContacts = async () => {
    const contacts = (navigator as ContactsNavigator).contacts
    if (!contacts) {
      setInviteStatus("This browser can't open your contacts. Copy the link instead.")
      return
    }
    try {
      const picked = await contacts.select(['name', 'email', 'tel'], { multiple: true })
      if (picked.length > 0) {
        setInviteStatus(`Sending invites isn't built yet, but you picked ${plural(picked.length, 'contact')}.`)
      }
    } catch {
      // The picker was closed.
    }
  }

  const shareInvite = async () => {
    if (!navigator.share) return copyLink()
    try {
      await navigator.share({ title: 'Puzzlr', text: 'Train your brain with me on Puzzlr.', url: inviteUrl() })
    } catch {
      // The share sheet was closed.
    }
  }

  return (
    <MainShell>
      <div className="friends">
        <section className="friends-main">
          <div className="friends-head">
            <h1>Leaderboard</h1>
            <div className="segmented" role="group" aria-label="Time range">
              <button type="button" aria-pressed={range === 'week'} onClick={() => setRange('week')}>
                <span className="desktop-only">This week</span>
                <span className="mobile-only">Week</span>
              </button>
              <button type="button" aria-pressed={range === 'allTime'} onClick={() => setRange('allTime')}>
                All time
              </button>
            </div>
          </div>

          <ol className="leaderboard">
            {rows.map((row, i) => (
              <li key={row.name} className={row.isYou ? 'is-you' : undefined} aria-current={row.isYou || undefined}>
                <span className="rank">{i + 1}</span>
                <span className="mini-avatar" aria-hidden="true">
                  {row.isYou ? '' : row.name[0]}
                </span>
                <span className="name">{row.name}</span>
                <span className="score">{formatNumber(row.score)}</span>
              </li>
            ))}
          </ol>
          <p className="friends-note">Ranked by each player's best single-game score.</p>
          {inviteStatus && (
            <p className="friends-note mobile-only" role="status">
              {inviteStatus}
            </p>
          )}
        </section>

        <aside className="panel invite" aria-label="Invite friends">
          <b>Invite friends</b>
          <p>Share a link or find people from your contacts.</p>
          <button type="button" className="btn btn-primary btn-sm" onClick={copyLink}>
            Copy link
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={fromContacts}>
            From contacts
          </button>
          {inviteStatus && (
            <p role="status" className="desktop-only">
              {inviteStatus}
            </p>
          )}
        </aside>

        <div className="invite-mobile">
          <button type="button" className="btn btn-primary" onClick={shareInvite}>
            Invite a friend
          </button>
        </div>
      </div>
    </MainShell>
  )
}
