import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import Brand from './Brand.tsx'
import { NAV_ITEMS } from './nav.ts'
import './layout.css'

interface AppShellProps {
  /** Content on the right of the header (streak badge, "Log in", "Skip"...). */
  right?: ReactNode
  /** Replaces `right` on small screens, when the mobile wireframe differs. */
  mobileRight?: ReactNode
  /** Show the main navigation: header links on desktop, tab bar on mobile. */
  nav?: boolean
  brandTo?: string
  className?: string
  children: ReactNode
}

export default function AppShell({
  right,
  mobileRight,
  nav = false,
  brandTo,
  className,
  children,
}: AppShellProps) {
  const shellClass = ['app-shell', nav && 'has-tabs', className].filter(Boolean).join(' ')

  return (
    <div className={shellClass}>
      <header className="app-header">
        <Brand to={brandTo} />
        {nav && (
          <nav className="app-nav" aria-label="Main">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
        <div className="app-header-right">
          {mobileRight ? (
            <>
              <span className="desktop-only">{right}</span>
              <span className="mobile-only">{mobileRight}</span>
            </>
          ) : (
            right
          )}
        </div>
      </header>

      <main className="app-main">{children}</main>

      {nav && (
        <nav className="tab-bar" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.short}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
