'use client'

import * as React from 'react'
import { Search, Delete, UserPlus, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Member } from '@/lib/types'
import { getPlan } from '@/lib/data/plans'
import { lookup } from './kiosk-engine'

/**
 * Name search for the kiosk. Touch targets are 48px+ because this is used
 * standing up, one-handed, sometimes with gloves on.
 *
 * There is no on-screen alphabet keyboard: wall kiosks have a physical keyboard
 * or a tablet OS keyboard, and a fake QWERTY grid at 6am is slower than both.
 * What IS here is a letter jump-bar, which is the fastest way to a surname.
 */

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export function KioskSearchPad({
  onSelect,
  onGuest,
}: {
  onSelect: (member: Member) => void
  onGuest: () => void
}) {
  const [query, setQuery] = React.useState('')
  const [cursor, setCursor] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const results = React.useMemo(() => lookup(query, 6), [query])

  React.useEffect(() => setCursor(0), [query])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(c + 1, results.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      onSelect(results[cursor])
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <input
          ref={inputRef}
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={onKeyDown}
          placeholder="Type your name"
          aria-label="Search for your name"
          autoComplete="off"
          className={cn(
            'h-16 w-full rounded-lg border-2 border-border bg-surface pl-12 pr-14 text-xl text-foreground',
            'placeholder:font-normal placeholder:text-muted-foreground/70',
            'transition-colors duration-150 ease-[var(--ease-ui)]',
            'focus:border-primary focus:outline-none',
          )}
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery('')
              inputRef.current?.focus()
            }}
            className="absolute right-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Delete className="size-5" />
          </button>
        ) : null}
      </div>

      {/* Letter jump — fastest path to a surname on a touch screen. */}
      {query.length === 0 ? (
        <div className="flex flex-wrap gap-1" role="group" aria-label="Jump to last name">
          {LETTERS.map((letter) => (
            <button
              key={letter}
              type="button"
              onClick={() => {
                setQuery(letter)
                inputRef.current?.focus()
              }}
              className="h-11 min-w-11 flex-1 rounded-md border border-border bg-surface text-base font-medium text-secondary-foreground transition-colors duration-150 hover:border-border-strong hover:bg-muted"
            >
              {letter}
            </button>
          ))}
        </div>
      ) : null}

      <div className="min-h-[17rem]">
        {query.length > 0 && results.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border bg-subtle px-5 py-6">
            <p className="text-lg font-medium text-foreground">
              {'No one found for '}
              <span className="font-semibold">{query}</span>
            </p>
            <p className="max-w-md text-base leading-relaxed text-muted-foreground">
              Try your last name, or the last 4 digits of your phone number. If you are visiting
              today, check in as a guest and the front desk will sort it out.
            </p>
            <button
              type="button"
              onClick={onGuest}
              className="mt-1 inline-flex h-12 items-center gap-2 rounded-md bg-primary px-4 text-base font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary-hover"
            >
              <UserPlus className="size-4" />
              Check in as a guest
            </button>
          </div>
        ) : null}

        {results.length > 0 ? (
          <ul className="flex flex-col gap-1.5" role="listbox" aria-label="Matching members">
            {results.map((m, i) => {
              const plan = getPlan(m.planId)
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === cursor}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => onSelect(m)}
                    className={cn(
                      'flex h-16 w-full items-center gap-4 rounded-lg border px-4 text-left',
                      'transition-colors duration-150 ease-[var(--ease-ui)]',
                      i === cursor
                        ? 'border-primary bg-primary-soft'
                        : 'border-border bg-surface hover:border-border-strong',
                    )}
                  >
                    <span
                      aria-hidden
                      className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-base font-semibold text-muted-foreground"
                    >
                      {m.initials}
                    </span>
                    <span className="flex min-w-0 flex-col leading-tight">
                      <span className="truncate text-lg font-semibold text-foreground">{m.name}</span>
                      <span className="truncate text-sm text-muted-foreground">
                        {plan?.name ?? 'Membership'}
                        {' · '}
                        {m.phone.slice(-4)}
                      </span>
                    </span>
                    <ArrowRight
                      aria-hidden
                      className={cn(
                        'ml-auto size-5 shrink-0',
                        i === cursor ? 'text-primary' : 'text-muted-foreground/50',
                      )}
                    />
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
