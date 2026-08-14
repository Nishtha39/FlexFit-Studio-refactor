'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Building2,
  CreditCard,
  Megaphone,
  Receipt,
  ScanLine,
  Search,
  UserRound,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp, type ScreenKey } from '@/components/shell/role-context'
import { NAV } from '@/components/shell/sidebar'
import { members } from '@/lib/data/members'
import { companies } from '@/lib/data/companies'
import { invoices } from '@/components/billing/billing-data'
import { money } from '@/lib/format'

/**
 * ⌘K palette. Two jobs: jump anywhere in one keystroke, and reach the handful
 * of actions that would otherwise need three clicks. Results are grouped and
 * ranked, never a flat fuzzy list — staff scan by category.
 */

interface Command {
  id: string
  label: string
  hint?: string
  group: 'Go to' | 'Members' | 'Invoices' | 'Corporate' | 'Actions'
  screen?: ScreenKey
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const ACTIONS: Command[] = [
  { id: 'a-checkin', label: 'Check someone in', group: 'Actions', screen: 'check_in', href: '/check-in', icon: ScanLine },
  { id: 'a-kiosk', label: 'Launch the kiosk', hint: 'Full screen', group: 'Actions', screen: 'kiosk', href: '/kiosk', icon: ScanLine },
  { id: 'a-broadcast', label: 'Compose a broadcast', group: 'Actions', screen: 'notifications', href: '/notifications?compose=1', icon: Megaphone },
  { id: 'a-dunning', label: 'Work the dunning queue', group: 'Actions', screen: 'billing', href: '/billing/dunning', icon: Receipt },
  { id: 'a-refund', label: 'Find a payment to refund', group: 'Actions', screen: 'payments', href: '/payments', icon: CreditCard },
]

export function CommandPalette() {
  const router = useRouter()
  const { commandOpen, setCommandOpen, can } = useApp()
  const [query, setQuery] = React.useState('')
  const [active, setActive] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (commandOpen) {
      setQuery('')
      setActive(0)
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [commandOpen])

  const results = React.useMemo<Command[]>(() => {
    const q = query.trim().toLowerCase()
    const nav: Command[] = NAV.filter((item) => can(item.screen)).map((item) => ({
      id: `nav-${item.screen}`,
      label: item.label,
      group: 'Go to',
      screen: item.screen,
      href: item.href,
      icon: item.icon,
    }))
    const actions = ACTIONS.filter((a) => !a.screen || can(a.screen))

    if (!q) return [...nav.slice(0, 6), ...actions]

    const matchesText = (value: string) => value.toLowerCase().includes(q)
    const memberHits: Command[] = can('members')
      ? members
          .filter((m) => matchesText(m.name) || matchesText(m.email) || matchesText(m.id))
          .slice(0, 5)
          .map((m) => ({
            id: `m-${m.id}`,
            label: m.name,
            hint: `${m.status} · risk ${m.risk.score}`,
            group: 'Members',
            href: `/members/${m.id}`,
            icon: UserRound,
          }))
      : []
    const invoiceHits: Command[] = can('billing')
      ? invoices
          .filter((i) => matchesText(i.id) || matchesText(i.memberName))
          .slice(0, 4)
          .map((i) => ({
            id: `i-${i.id}`,
            label: i.id,
            hint: `${i.memberName} · ${money(i.amount)} · ${i.status}`,
            group: 'Invoices',
            href: `/billing/invoices/${i.id}`,
            icon: Receipt,
          }))
      : []
    const companyHits: Command[] = can('corporate')
      ? companies
          .filter((c) => matchesText(c.name))
          .map((c) => ({
            id: `c-${c.id}`,
            label: c.name,
            hint: `${c.creditsUsed}/${c.poolCredits} credits used`,
            group: 'Corporate',
            href: `/corporate/${c.id}`,
            icon: Building2,
          }))
      : []

    return [
      ...nav.filter((n) => matchesText(n.label)),
      ...actions.filter((a) => matchesText(a.label)),
      ...memberHits,
      ...invoiceHits,
      ...companyHits,
    ]
  }, [query, can])

  React.useEffect(() => setActive(0), [query])

  const run = React.useCallback(
    (command: Command) => {
      setCommandOpen(false)
      router.push(command.href)
    },
    [router, setCommandOpen],
  )

  React.useEffect(() => {
    if (!commandOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setCommandOpen(false)
      } else if (e.key === 'ArrowDown' || (e.key.toLowerCase() === 'n' && e.ctrlKey)) {
        e.preventDefault()
        setActive((i) => Math.min(results.length - 1, i + 1))
      } else if (e.key === 'ArrowUp' || (e.key.toLowerCase() === 'p' && e.ctrlKey)) {
        e.preventDefault()
        setActive((i) => Math.max(0, i - 1))
      } else if (e.key === 'Enter' && results[active]) {
        e.preventDefault()
        run(results[active])
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [commandOpen, results, active, run, setCommandOpen])

  if (!commandOpen) return null

  let lastGroup = ''

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Close command palette"
        onClick={() => setCommandOpen(false)}
        className="absolute inset-0 bg-foreground/25 animate-in fade-in duration-150"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border-strong bg-popover shadow-[0_16px_48px_-12px_oklch(0.2_0.01_258/0.28)] animate-in duration-150 ease-[var(--ease-ui)] slide-in-from-top-2"
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            placeholder="Search members, invoices, pools — or type a command"
            aria-label="Search commands"
            className="w-full bg-transparent text-base text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
          />
          <kbd className="shrink-0 rounded-sm border border-border bg-muted px-1 font-mono text-micro text-muted-foreground">
            esc
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto py-1 scrollbar-thin">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nothing matches “{query}”. Try a member name, an invoice number, or a screen.
            </p>
          ) : (
            results.map((command, i) => {
              const Icon = command.icon
              const showGroup = command.group !== lastGroup
              lastGroup = command.group
              return (
                <React.Fragment key={command.id}>
                  {showGroup ? (
                    <p className="px-3 pb-1 pt-2 text-micro font-medium tracking-wide text-muted-foreground uppercase">
                      {command.group}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => run(command)}
                    aria-current={i === active ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors duration-150',
                      i === active ? 'bg-primary-soft' : 'hover:bg-muted',
                    )}
                  >
                    <Icon className={cn('size-4 shrink-0', i === active ? 'text-primary' : 'text-muted-foreground')} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{command.label}</span>
                      {command.hint ? (
                        <span className="block truncate text-micro text-muted-foreground">{command.hint}</span>
                      ) : null}
                    </span>
                    {i === active ? <ArrowRight className="size-3.5 shrink-0 text-primary" /> : null}
                  </button>
                </React.Fragment>
              )
            })
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-subtle px-3 py-2 text-micro text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded-sm border border-border bg-muted px-1 font-mono">↑</kbd>
            <kbd className="rounded-sm border border-border bg-muted px-1 font-mono">↓</kbd>
            move
            <kbd className="ml-1.5 rounded-sm border border-border bg-muted px-1 font-mono">↵</kbd>
            open
          </span>
          <span>Only screens your role can reach are listed.</span>
        </div>
      </div>
    </div>
  )
}
