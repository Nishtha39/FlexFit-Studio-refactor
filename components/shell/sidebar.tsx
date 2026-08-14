'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  HeartPulse,
  CalendarDays,
  ScanLine,
  Receipt,
  CreditCard,
  Building2,
  Filter,
  Dumbbell,
  FileBarChart,
  Settings,
  Bookmark,
  Monitor,
  UserRound,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp, type Role, type ScreenKey } from '@/components/shell/role-context'

interface NavItem {
  screen: ScreenKey
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

const NAV: NavItem[] = [
  { screen: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { screen: 'check_in', label: 'Check-in', href: '/check-in', icon: ScanLine },
  { screen: 'my_schedule', label: 'My schedule', href: '/my-schedule', icon: CalendarDays },
  { screen: 'portal', label: 'My bookings', href: '/portal', icon: UserRound },
  { screen: 'members', label: 'Members', href: '/members', icon: Users, badge: 380 },
  { screen: 'retention', label: 'Retention', href: '/retention', icon: HeartPulse, badge: 41 },
  { screen: 'schedule', label: 'Schedule', href: '/schedule', icon: CalendarDays },
  { screen: 'leads', label: 'Leads', href: '/leads', icon: Filter, badge: 23 },
  { screen: 'billing', label: 'Billing', href: '/billing', icon: Receipt, badge: 6 },
  { screen: 'payments', label: 'Payments', href: '/payments', icon: CreditCard },
  { screen: 'corporate', label: 'Corporate', href: '/corporate', icon: Building2 },
  { screen: 'trainers', label: 'Trainers', href: '/trainers', icon: Dumbbell },
  { screen: 'reports', label: 'Reports', href: '/reports', icon: FileBarChart },
  { screen: 'settings', label: 'Settings', href: '/settings', icon: Settings },
]

/** Saved views appear under Members for owner + front desk. Batch 3 consumes these. */
export const SAVED_VIEWS: { id: string; label: string; count: number; roles: Role[] }[] = [
  { id: 'at-risk', label: 'At risk · high value', count: 18, roles: ['owner', 'front_desk'] },
  { id: 'expiring-30', label: 'Expiring in 30 days', count: 27, roles: ['owner', 'front_desk'] },
  { id: 'failed-payments', label: 'Failed payments', count: 6, roles: ['owner', 'front_desk'] },
  { id: 'new-60', label: 'Joined last 60 days', count: 44, roles: ['owner', 'front_desk'] },
  { id: 'unsigned-waiver', label: 'Unsigned waivers', count: 9, roles: ['front_desk'] },
]

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex h-7 items-center gap-2 rounded-sm px-2 text-sm transition-colors duration-150 ease-[var(--ease-ui)]',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
        active
          ? 'bg-primary-soft font-medium text-accent-foreground'
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground',
      )}
    >
      <Icon className={cn('size-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
      <span className="truncate">{item.label}</span>
      {typeof item.badge === 'number' ? (
        <span className="ml-auto text-micro text-muted-foreground tnum">{item.badge}</span>
      ) : null}
    </Link>
  )
}

export function Sidebar({ className }: { className?: string }) {
  const { role, can, location } = useApp()
  const pathname = usePathname() ?? ''
  const items = NAV.filter((item) => can(item.screen))
  const savedViews = SAVED_VIEWS.filter((v) => v.roles.includes(role))

  return (
    <nav
      aria-label="Primary"
      className={cn(
        'flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar',
        className,
      )}
    >
      <div className="flex h-12 items-center gap-2 border-b border-sidebar-border px-3">
        <span
          aria-hidden
          className="flex size-6 items-center justify-center rounded-sm bg-primary text-micro font-bold text-primary-foreground"
        >
          FF
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold text-foreground">FlexFit Studio</p>
          <p className="truncate text-micro text-muted-foreground">{location.name}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        <ul className="flex flex-col gap-px">
          {items.map((item) => (
            <li key={item.screen}>
              <NavLink
                item={item}
                active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
              />
            </li>
          ))}
        </ul>

        {savedViews.length > 0 ? (
          <div className="mt-5">
            <p className="px-2 pb-1.5 text-micro font-medium tracking-wide text-muted-foreground uppercase">
              Saved views
            </p>
            <ul className="flex flex-col gap-px">
              {savedViews.map((view) => (
                <li key={view.id}>
                  <Link
                    href={`/members?view=${view.id}`}
                    className="flex h-7 items-center gap-2 rounded-sm px-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                  >
                    <Bookmark className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{view.label}</span>
                    <span className="ml-auto text-micro text-muted-foreground tnum">
                      {view.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {can('kiosk') ? (
        <div className="border-t border-sidebar-border p-2">
          <Link
            href="/kiosk"
            className="flex h-7 items-center gap-2 rounded-sm border border-border bg-surface px-2 text-sm text-secondary-foreground transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          >
            <Monitor className="size-3.5 text-muted-foreground" />
            Launch kiosk
          </Link>
        </div>
      ) : null}
    </nav>
  )
}

export { NAV }
