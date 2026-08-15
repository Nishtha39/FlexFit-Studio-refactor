'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { ArrowRight, LogOut } from 'lucide-react'
import { Icon } from '@/components/v2/shared/icon'
import { Logo } from '@/components/v2/shared/logo'
import { PRIORITY_NUDGE, SIDEBAR_NAV, STAFF } from '@/lib/v2/data/dashboard'
import { cn } from '@/lib/v2/utils'

/**
 * Dashboard navigation rail.
 *
 * Fixed on desktop and rendered inside the mobile drawer on small screens, so
 * it takes an `onNavigate` callback to let the drawer close on selection.
 */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const currentUser = STAFF.priya

  return (
    <div className="flex h-full flex-col gap-6 border-r border-border bg-card px-4 py-5">
      <div className="px-1">
        <Logo href="/dashboard" />
      </div>

      <nav aria-label="Dashboard" className="flex-1">
        <ul className="flex flex-col gap-0.5">
          {SIDEBAR_NAV.map((item) => {
            const active = pathname === item.href

            // Unbuilt sections render as inert rows rather than links that 404.
            if (!item.ready) {
              return (
                <li key={item.href}>
                  {/* Not a link and not focusable, so no aria-disabled: the
                      visible "Soon" text is what conveys the state to AT. */}
                  <span className="flex cursor-not-allowed items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-muted-foreground/55">
                    <Icon name={item.icon} className="size-[18px] shrink-0" />
                    {item.label}
                    <span className="ml-auto rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Soon
                    </span>
                  </span>
                </li>
              )
            }

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors',
                    active
                      ? 'bg-secondary font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                  )}
                >
                  <Icon name={item.icon} className="size-[18px] shrink-0" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Single inverted card: the one nudge worth interrupting for. */}
      <div className="rounded-2xl bg-ink p-4 text-white">
        <p className="text-[10px] font-semibold tracking-[0.12em] text-lime uppercase">
          {PRIORITY_NUDGE.title}
        </p>
        <p className="mt-2.5 text-xs leading-relaxed text-white/70 text-pretty">
          {PRIORITY_NUDGE.body}
        </p>
        <button
          type="button"
          className="group mt-3.5 inline-flex items-center gap-1.5 text-xs font-medium text-white transition-colors hover:text-lime"
        >
          {PRIORITY_NUDGE.action}
          <ArrowRight
            className="size-3.5 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </button>
      </div>

      <div className="flex items-center gap-2.5 border-t border-border pt-4">
        <Image
          src={currentUser.avatar}
          alt=""
          width={32}
          height={32}
          className="size-8 rounded-full object-cover"
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{currentUser.name}</span>
          <span className="truncate text-xs text-muted-foreground">
            {currentUser.role}
          </span>
        </span>
        <Link
          href="/login"
          aria-label="Sign out"
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}
