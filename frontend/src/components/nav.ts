export interface NavItem {
  to: string
  label: string
  /** Label used in the mobile tab bar, where space is tight. */
  short: string
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/home', label: 'Today', short: 'Today' },
  { to: '/path', label: 'Path', short: 'Path' },
  { to: '/friends', label: 'Friends', short: 'Friends' },
  { to: '/profile', label: 'Profile', short: 'Me' },
]
