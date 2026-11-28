// Testing the friends screen: leaderboard filters, friend requests and invites
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as leaderboard from '../lib/leaderboard.ts'
import type { LeaderboardRow } from '../lib/leaderboard.ts'
import { createGuestState } from '../state/store.ts'
import { signedInState, TODAY } from '../test/fixtures.ts'
import { renderWithApp } from '../test/render.tsx'
import Friends from './Friends.tsx'

// Friends only loads anything when Supabase is configured; the calls themselves are mocked below.
vi.mock('../lib/supabase.ts', () => ({ supabase: {} }))
vi.mock('../lib/leaderboard.ts', () => ({
  fetchLeaderboard: vi.fn(),
  fetchFriendRequests: vi.fn(),
  addFriendByEmail: vi.fn(),
  answerFriendRequest: vi.fn(),
}))

const api = vi.mocked(leaderboard)

const ROWS: LeaderboardRow[] = [
  { name: 'Grace', score: 1290, rank: 1, isYou: false },
  { name: 'Ada Lovelace', score: 1100, rank: 2, isYou: true },
  { name: 'Alan', score: 930, rank: 3, isYou: false },
]

const showFriends = () => renderWithApp(<Friends />, { state: signedInState(), route: '/friends' })
const leaderboardRows = () => screen.getAllByRole('listitem')
const emailBox = () => screen.getByLabelText("Friend's email")

beforeEach(() => {
  vi.clearAllMocks()
  api.fetchLeaderboard.mockResolvedValue(ROWS)
  api.fetchFriendRequests.mockResolvedValue([])
  api.addFriendByEmail.mockResolvedValue(true)
  api.answerFriendRequest.mockResolvedValue(true)
})

describe('Friends as a guest', () => {
  it('asks the player to sign in and loads nothing', async () => {
    const user = userEvent.setup()
    const { actions } = renderWithApp(<Friends />, { state: createGuestState(TODAY), route: '/friends' })

    expect(screen.getByText('Sign in to see your friends')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Leaderboard' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))
    expect(actions.signIn).toHaveBeenCalledOnce()
    expect(api.fetchLeaderboard).not.toHaveBeenCalled()
    expect(api.fetchFriendRequests).not.toHaveBeenCalled()
  })
})

describe('Friends leaderboard', () => {
  it("loads this week's friends leaderboard for all games and marks the player", async () => {
    showFriends()

    await waitFor(() => expect(leaderboardRows()).toHaveLength(3))
    expect(api.fetchLeaderboard).toHaveBeenCalledWith('all', 'week', true)
    const first = within(leaderboardRows()[0])
    expect(first.getByText('Grace')).toHaveClass('name')
    expect(first.getByText('1,290')).toHaveClass('score')
    expect(first.getByText('1')).toHaveClass('rank')
    expect(leaderboardRows()[1]).toHaveAttribute('aria-current', 'true')
    expect(leaderboardRows()[1]).toHaveClass('is-you')
    expect(leaderboardRows()[0]).not.toHaveAttribute('aria-current')
  })

  it('reloads when the time range, audience or game changes', async () => {
    const user = userEvent.setup()
    showFriends()
    await waitFor(() => expect(api.fetchLeaderboard).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: /This month/ }))
    expect(api.fetchLeaderboard).toHaveBeenLastCalledWith('all', 'month', true)
    expect(screen.getByRole('button', { name: /This month/ })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Everyone' }))
    expect(api.fetchLeaderboard).toHaveBeenLastCalledWith('all', 'month', false)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Game' }), 'memory')
    expect(api.fetchLeaderboard).toHaveBeenLastCalledWith('memory', 'month', false)
  })

  it('says when there are no scores for the period', async () => {
    api.fetchLeaderboard.mockResolvedValue([])
    showFriends()
    expect(await screen.findByText('No scores yet for this period.')).toBeInTheDocument()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('says when the leaderboard could not be loaded', async () => {
    api.fetchLeaderboard.mockResolvedValue(null)
    showFriends()
    expect(await screen.findByText('The leaderboard is not available right now.')).toBeInTheDocument()
  })
})

describe('Friend requests', () => {
  beforeEach(() => {
    api.fetchFriendRequests.mockResolvedValue([
      { requesterId: 'u-grace', name: 'Grace' },
      { requesterId: 'u-alan', name: 'Alan' },
    ])
  })

  it('accepts a request, removes it and reloads the leaderboard', async () => {
    const user = userEvent.setup()
    showFriends()
    expect(await screen.findByText(/Grace wants to be friends/)).toBeInTheDocument()
    await waitFor(() => expect(api.fetchLeaderboard).toHaveBeenCalledTimes(1))

    await user.click(screen.getAllByRole('button', { name: 'Accept' })[0])
    expect(api.answerFriendRequest).toHaveBeenCalledWith('u-grace', true)
    expect(screen.queryByText(/Grace wants to be friends/)).not.toBeInTheDocument()
    expect(screen.getByText(/Alan wants to be friends/)).toBeInTheDocument()
    expect(api.fetchLeaderboard).toHaveBeenCalledTimes(2)
  })

  it('declines a request without reloading the leaderboard', async () => {
    const user = userEvent.setup()
    showFriends()
    await screen.findByText(/Alan wants to be friends/)
    await waitFor(() => expect(api.fetchLeaderboard).toHaveBeenCalledTimes(1))

    await user.click(screen.getAllByRole('button', { name: 'Decline' })[1])
    expect(api.answerFriendRequest).toHaveBeenCalledWith('u-alan', false)
    expect(screen.queryByText(/Alan wants to be friends/)).not.toBeInTheDocument()
    expect(api.fetchLeaderboard).toHaveBeenCalledTimes(1)
  })

  it('keeps the request when answering it fails', async () => {
    api.answerFriendRequest.mockResolvedValue(false)
    const user = userEvent.setup()
    showFriends()
    await screen.findByText(/Grace wants to be friends/)

    await user.click(screen.getAllByRole('button', { name: 'Accept' })[0])
    expect(screen.getByText(/Grace wants to be friends/)).toBeInTheDocument()
  })
})

describe('Adding and inviting friends', () => {
  it('sends a request by email and clears the box', async () => {
    const user = userEvent.setup()
    showFriends()

    await user.type(emailBox(), 'grace@example.com')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(api.addFriendByEmail).toHaveBeenCalledWith('grace@example.com')
    expect(emailBox()).toHaveValue('')
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('Request sent')
  })

  it('does nothing for an empty email', async () => {
    const user = userEvent.setup()
    showFriends()

    await user.type(emailBox(), '   ')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(api.addFriendByEmail).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('keeps the email and says so when the request fails', async () => {
    api.addFriendByEmail.mockResolvedValue(false)
    const user = userEvent.setup()
    showFriends()

    await user.type(emailBox(), 'grace@example.com')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(emailBox()).toHaveValue('grace@example.com')
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('Could not send the request. Try again.')
  })

  it('copies the invite link', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')
    showFriends()

    await user.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/?ref=invite`)
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('Link copied. Send it to a friend.')
  })

  it('shows the link to copy by hand when the clipboard is blocked', async () => {
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('blocked'))
    showFriends()

    await user.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(screen.getAllByRole('status')[0]).toHaveTextContent(`Copy this link: ${window.location.origin}/?ref=invite`)
  })

  it("explains when the browser can't open contacts", async () => {
    const user = userEvent.setup()
    showFriends()

    await user.click(screen.getByRole('button', { name: 'From contacts' }))
    expect(screen.getAllByRole('status')[0]).toHaveTextContent("This browser can't open your contacts")
  })
})
