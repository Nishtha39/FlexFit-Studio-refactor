'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

/**
 * Billing has four screens that share one context (invoices, dunning, plans).
 * Route-level sub-nav, so a link is shareable — not client tab state.
 */
const LINKS = [
  { href: '/billing', label: 'Invoices' },
  { href: '/billing/dunning', label: 'Dunning' },
  { href: '/billing/plans', label: 'Plans' },
]

export function BillingTabs({ counts }: { counts?: Record<string, number> }) {
  const pathname = usePathname() ?? ''
  return (
    <div className="flex items-center gap-1" role="navigation" aria-label="Billing sections">
      {LINKS.map((link) => {
        const active = link.href === '/billing' ? pathname === '/billing' : pathname.startsWith(link.href)
        const count = counts?.[link.href]
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors duration-150 ease-[var(--ease-ui)]',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
              active
                ? 'border-primary bg-primary-soft font-medium text-accent-foreground'
                : 'border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground',
            )}
          >
            {link.label}
            {typeof count === 'number' ? (
              <span className="text-micro text-muted-foreground tnum">{count}</span>
            ) : null}
          </Link>
        )
      })}
    </div>
  )
}
