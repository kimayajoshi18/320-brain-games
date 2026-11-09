import { useEffect, useState, type FormEvent } from 'react'
import MainShell from '../components/MainShell.tsx'
import { GAMES, GAME_IDS, type GameId } from '../data/games.ts'
import {
  addFriendByEmail,
  answerFriendRequest,
  fetchFriendRequests,
  fetchLeaderboard,
  type FriendRequest,
  type LeaderboardRow,
  type Period,
} from '../lib/leaderboard.ts'
import { supabase } from '../lib/supabase.ts'
import { formatNumber, plural } from '../lib/format.ts'
import { useAppState } from '../state/context.ts'
import './Friends.css'


/** The Contact Picker API is only in some browsers (mostly Chrome on Android). */
type ContactsNavigator = Navigator & {
  contacts?: { select: (props: string[], options?: { multiple?: boolean }) => Promise<unknown[]> }
}

const inviteUrl = () => `${window.location.origin}/?ref=invite`

export default function Friends() {
  const { state, actions } = useAppState()
  const [range, setRange] = useState<Period>('week')
  const [game, setGame] = useState<GameId | 'all'>('all')
  const [friendsOnly, setFriendsOnly] = useState(true)
  const [board, setBoard] = useState<LeaderboardRow[] | null>(null)
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [email, setEmail] = useState('')
  const [inviteStatus, setInviteStatus] = useState<string | null>(null)
  const isGuest = state.account.kind === 'guest'

  useEffect(() => {
    if (isGuest || !supabase) return
    let current = true
    void fetchLeaderboard(game, range, friendsOnly).then((rows) => current && setBoard(rows))
    return () => {
      current = false
    }
  }, [isGuest, game, range, friendsOnly])

  useEffect(() => {
    if (isGuest || !supabase) return
    void fetchFriendRequests().then(setRequests)
  }, [isGuest])

  if (isGuest) {
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

  const rows = board ?? []

  const addFriend = async (event: FormEvent) => {
    event.preventDefault()
    if (!email.trim()) return
    const ok = await addFriendByEmail(email)
    setInviteStatus(ok ? "Request sent, if that email has an account. They'll see it here." : 'Could not send the request. Try again.')
    if (ok) setEmail('')
  }

  const answer = async (request: FriendRequest, accept: boolean) => {
    if (!(await answerFriendRequest(request.id, accept))) return
    setRequests((current) => current.filter((r) => r.id !== request.id))
    if (accept) void fetchLeaderboard(game, range, friendsOnly).then(setBoard)
  }

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
              <button type="button" aria-pressed={range === 'month'} onClick={() => setRange('month')}>
                <span className="desktop-only">This month</span>
                <span className="mobile-only">Month</span>
              </button>
            </div>
          </div>
          <div className="friends-head">
            <div className="segmented" role="group" aria-label="Who to show">
              <button type="button" aria-pressed={friendsOnly} onClick={() => setFriendsOnly(true)}>
                Friends
              </button>
              <button type="button" aria-pressed={!friendsOnly} onClick={() => setFriendsOnly(false)}>
                Everyone
              </button>
            </div>
            <select aria-label="Game" value={game} onChange={(e) => setGame(e.target.value as GameId | 'all')}>
              <option value="all">All games</option>
              {GAME_IDS.map((id) => (
                <option key={id} value={id}>
                  {GAMES[id].name}
                </option>
              ))}
            </select>
          </div>

          <ol className="leaderboard">
            {rows.map((row, i) => (
              <li key={`${row.name}-${i}`} className={row.isYou ? 'is-you' : undefined} aria-current={row.isYou || undefined}>
                <span className="rank">{row.rank}</span>
                <span className="mini-avatar" aria-hidden="true">
                  {row.isYou ? '' : row.name[0]}
                </span>
                <span className="name">{row.name}</span>
                <span className="score">{formatNumber(row.score)}</span>
              </li>
            ))}
          </ol>
          {board === null && <p className="friends-note">The leaderboard is not available right now.</p>}
          {board !== null && rows.length === 0 && <p className="friends-note">No scores yet for this period.</p>}
          <p className="friends-note">Ranked by each player's best single-game score. Weeks start on Monday and months on the 1st (UTC).</p>
          {inviteStatus && (
            <p className="friends-note mobile-only" role="status">
              {inviteStatus}
            </p>
          )}
        </section>

        <aside className="panel invite" aria-label="Invite friends">
          <b>Invite friends</b>
          <p>Share a link, or add a friend by the email they sign in with.</p>
          <form onSubmit={addFriend} noValidate>
            <label className="visually-hidden" htmlFor="friend-email">
              Friend's email
            </label>
            <input id="friend-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="submit" className="btn btn-dark btn-sm">
              Add
            </button>
          </form>
          {requests.map((r) => (
            <p key={r.id}>
              {r.name} wants to be friends.{' '}
              <button type="button" className="link-button" onClick={() => answer(r, true)}>
                Accept
              </button>{' '}
              <button type="button" className="link-button" onClick={() => answer(r, false)}>
                Decline
              </button>
            </p>
          ))}
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
