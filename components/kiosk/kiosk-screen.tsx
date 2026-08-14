'use client'

import * as React from 'react'
import Link from 'next/link'
import { Keyboard, Hash, ArrowLeft, Wifi, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Member } from '@/lib/types'
import { clock } from '@/lib/format'
import { NOW } from '@/lib/seed'
import { LiveAnnouncer } from '@/components/ui/toast'
import { KioskSearchPad } from './kiosk-search-pad'
import { KioskIdEntry } from './kiosk-id-entry'
import { KioskResult } from './kiosk-result'
import { KioskGuestDialog, GuestEntryButton } from './kiosk-guest'
import { useKioskSession } from './kiosk-session'
import { guestDecision, todaysClasses, TODAY_LABEL, classStart } from './kiosk-engine'

/**
 * The kiosk. Deliberately NOT inside the app shell: no sidebar, no role
 * switcher, no breadcrumb. A member standing at the door must not be one tap
 * away from the revenue dashboard.
 *
 * Type is a step up across the board (the display size exists for this screen
 * only) and every target is at least 44px.
 */

type Method = 'name' | 'pin'

export function KioskScreen() {
  const session = useKioskSession()
  const [method, setMethod] = React.useState<Method>('name')
  const [guestOpen, setGuestOpen] = React.useState(false)

  const onPick = (m: Member) => session.present(m)

  const openGuest = () => {
    session.presentGuest(guestDecision())
    setGuestOpen(true)
  }

  const upcoming = React.useMemo(() => {
    const nowMin = NOW.getUTCHours() * 60 + NOW.getUTCMinutes()
    return todaysClasses()
      .filter((c) => {
        const [h, m] = c.startTime.split(':').map(Number)
        return h * 60 + m >= nowMin
      })
      .slice(0, 3)
  }, [])

  const idle = session.stage.kind === 'idle'

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <LiveAnnouncer message={session.announcement} />

      {/* --- Kiosk chrome: identity, not navigation. --- */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-surface px-5 py-3">
        <span
          aria-hidden
          className="flex size-8 items-center justify-center rounded-sm bg-primary text-sm font-bold text-primary-foreground"
        >
          FF
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-base font-semibold text-foreground">FlexFit Downtown</p>
          <p className="truncate text-micro text-muted-foreground">Check-in kiosk · Bay 1</p>
        </div>
        <div className="ml-auto flex items-center gap-4 text-micro text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Wifi aria-hidden className="size-3.5 text-good" />
            Online
          </span>
          <span className="tnum">{clock(NOW)}</span>
          <span className="hidden sm:inline">{`${TODAY_LABEL} · 14 Aug`}</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-6 sm:py-10">
        {idle ? (
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-display font-semibold tracking-tight text-foreground text-balance">
                Check in
              </h1>
              <p className="mt-1.5 text-lg leading-relaxed text-muted-foreground">
                Find your name, or enter your 4-digit PIN.
              </p>
            </div>

            {/* Method switch — two ways in, both first-class. */}
            <div
              role="tablist"
              aria-label="Check-in method"
              className="flex gap-2 rounded-lg border border-border bg-surface p-1"
            >
              {(
                [
                  { id: 'name' as Method, label: 'Search by name', icon: Keyboard },
                  { id: 'pin' as Method, label: 'PIN or QR code', icon: Hash },
                ]
              ).map((tab) => {
                const Icon = tab.icon
                const active = method === tab.id
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    type="button"
                    aria-selected={active}
                    onClick={() => setMethod(tab.id)}
                    className={cn(
                      'flex h-12 flex-1 items-center justify-center gap-2 rounded-md text-base font-medium',
                      'transition-colors duration-150 ease-[var(--ease-ui)]',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <Icon className="size-4" />
                    {tab.label}
                  </button>
                )
              })}
            </div>

            {method === 'name' ? (
              <KioskSearchPad onSelect={onPick} onGuest={openGuest} />
            ) : (
              <KioskIdEntry onResolved={onPick} />
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
              <GuestEntryButton onClick={openGuest} />
              {upcoming.length > 0 ? (
                <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <li className="font-medium text-foreground">Next up today</li>
                  {upcoming.map((c) => (
                    <li key={c.id} className="tnum">
                      {`${clock(classStart(c.startTime))} · ${c.name}`}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ) : null}

        {session.stage.kind === 'result' ? (
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={session.reset}
              className="flex w-fit items-center gap-1.5 text-base text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Not you? Start over
            </button>
            <KioskResult
              member={session.stage.member}
              decision={session.stage.decision}
              onAdmit={() => {
                const s = session.stage
                if (s.kind === 'result') session.admit(s.member, s.decision)
              }}
              onResolve={() => {
                const s = session.stage
                if (s.kind === 'result') session.resolveAndAdmit(s.member, s.decision)
              }}
              onTurnAway={() => {
                const s = session.stage
                if (s.kind === 'result') session.turnAway(s.member, s.decision)
              }}
              onCancel={session.reset}
            />
          </div>
        ) : null}

        {session.stage.kind === 'guest' ? (
          <div className="rounded-lg border-2 border-warn-border bg-warn-soft px-6 py-6">
            <h2 className="text-xl font-semibold text-foreground">
              {session.stage.decision.headline}
            </h2>
            <p className="mt-1.5 text-lg leading-relaxed text-foreground/80">
              {session.stage.decision.detail}
            </p>
            <button
              type="button"
              onClick={() => setGuestOpen(true)}
              className="mt-4 h-12 rounded-md bg-primary px-4 text-base font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Continue
            </button>
          </div>
        ) : null}
      </main>

      {/* --- Exit is a footer affordance, small and deliberate. --- */}
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-5 py-2.5">
        <p className="text-micro text-muted-foreground">
          Trouble checking in? Please see the front desk — we will sort it out.
        </p>
        <Link
          href="/check-in"
          className="flex items-center gap-1.5 text-micro text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
        >
          <Lock aria-hidden className="size-3" />
          Exit kiosk mode
        </Link>
      </footer>

      <KioskGuestDialog
        open={guestOpen}
        initialMode="day-pass"
        onClose={() => {
          setGuestOpen(false)
          session.reset()
        }}
        onComplete={(name, amount) => {
          setGuestOpen(false)
          session.admitGuest(name, amount)
        }}
      />
    </div>
  )
}
