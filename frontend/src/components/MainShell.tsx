import type { ReactNode } from 'react'
import { useAppState } from '../state/context.ts'
import { currentStreak } from '../state/store.ts'
import { plural } from '../lib/format.ts'
import AppShell from './AppShell.tsx'

/** Shell for the main tabs (Today, Path, Friends, Profile): nav plus the streak badge. */
export default function MainShell({ mobileRight, children }: { mobileRight?: ReactNode; children: ReactNode }) {
  const { state } = useAppState()
  const streak = currentStreak(state)

  return (
    <AppShell
      nav
      brandTo="/home"
      right={
        <span className="badge" title="Current streak">
          {plural(streak, 'day')}
        </span>
      }
      mobileRight={mobileRight}
    >
      {children}
    </AppShell>
  )
}
