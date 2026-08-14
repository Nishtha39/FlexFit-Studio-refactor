'use client'

import * as React from 'react'
import {
  Check,
  AlertTriangle,
  X,
  Clock,
  Ticket,
  CreditCard,
  PenLine,
  ShieldCheck,
  Snowflake,
  RotateCcw,
  UserCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Member } from '@/lib/types'
import { getPlan } from '@/lib/data/plans'
import { getCompany } from '@/lib/data/companies'
import { money, clock } from '@/lib/format'
import { NOW } from '@/lib/seed'
import { Button } from '@/components/ui/button'
import type { Decision, Outcome, ResolveKind } from './kiosk-engine'
import { bookedClassToday, trainerName } from './kiosk-engine'
import { WaiverCapture } from './kiosk-waiver'

/**
 * The result screen. Read from three metres away, so the outcome is carried by
 * SIZE and SHAPE first — a full-bleed tinted panel, a large glyph, a headline in
 * display type — and by color only as reinforcement.
 *
 * The kiosk auto-returns to idle on GREEN. It NEVER auto-dismisses AMBER or RED,
 * because those need a human, and a timer that clears a problem off the screen
 * before staff read it is how members get turned away with no explanation.
 */

const OUTCOME_STYLE: Record<Outcome, { panel: string; glyph: string; label: string }> = {
  green: {
    panel: 'border-good-border bg-good-soft',
    glyph: 'bg-good text-primary-foreground',
    label: 'Approved',
  },
  amber: {
    panel: 'border-warn-border bg-warn-soft',
    glyph: 'bg-warn text-primary-foreground',
    label: 'Approved · needs a word',
  },
  red: {
    panel: 'border-danger-border bg-danger-soft',
    glyph: 'bg-danger text-primary-foreground',
    label: 'Not admitted',
  },
}

const OUTCOME_ICON: Record<Outcome, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  green: Check,
  amber: AlertTriangle,
  red: X,
}

const RESOLVE_ICON: Record<ResolveKind, React.ComponentType<{ className?: string }>> = {
  'sign-waiver': PenLine,
  'take-payment': CreditCard,
  'sell-drop-in': Ticket,
  unfreeze: Snowflake,
  renew: RotateCcw,
  override: ShieldCheck,
  none: Check,
}

const GREEN_DWELL_MS = 4500

export function KioskResult({
  member,
  decision,
  onAdmit,
  onResolve,
  onTurnAway,
  onCancel,
}: {
  member: Member
  decision: Decision
  onAdmit: () => void
  onResolve: () => void
  onTurnAway: () => void
  onCancel: () => void
}) {
  const style = OUTCOME_STYLE[decision.outcome]
  const Glyph = OUTCOME_ICON[decision.outcome]
  const ResolveIcon = RESOLVE_ICON[decision.resolve]
  const plan = getPlan(member.planId)
  const company = member.companyId ? getCompany(member.companyId) : null
  const booked = bookedClassToday(member.id)
  const [waiverOpen, setWaiverOpen] = React.useState(false)

  // GREEN clears itself — the member walks away and the next person steps up.
  const [remaining, setRemaining] = React.useState(GREEN_DWELL_MS / 1000)
  React.useEffect(() => {
    if (decision.outcome !== 'green') return
    const tick = window.setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000)
    const done = window.setTimeout(onAdmit, GREEN_DWELL_MS)
    return () => {
      window.clearInterval(tick)
      window.clearTimeout(done)
    }
  }, [decision.outcome, onAdmit])

  const startResolve = () => {
    if (decision.resolve === 'sign-waiver') return setWaiverOpen(true)
    onResolve()
  }

  return (
    <div className="flex flex-col gap-4">
      {/* --- Outcome panel --- */}
      <section className={cn('rounded-lg border-2 px-6 py-6 sm:px-8 sm:py-8', style.panel)}>
        <div className="flex items-start gap-5">
          <span
            aria-hidden
            className={cn(
              'flex size-14 shrink-0 items-center justify-center rounded-full sm:size-16',
              style.glyph,
            )}
          >
            <Glyph className="size-8 sm:size-9" strokeWidth={3} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold tracking-wide uppercase opacity-80">
              {style.label}
            </p>
            <h2 className="mt-1 text-display font-semibold tracking-tight text-foreground text-balance">
              {decision.headline}
            </h2>
            <p className="mt-2 max-w-2xl text-lg leading-relaxed text-foreground/80">
              {decision.detail}
            </p>
          </div>
        </div>

        {/* Member context strip — the facts staff need before they speak. */}
        <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t border-current/15 pt-4">
          <Fact label="Member" value={member.name} sub={`${member.phone.slice(-4)} · ${member.id}`} />
          <Fact
            label="Plan"
            value={plan?.name ?? 'Membership'}
            sub={company ? company.name : plan?.interval === 'annual' ? 'Billed annually' : 'Billed monthly'}
          />
          <Fact
            label="Visits left"
            value={
              decision.creditsAfter === null ? 'Unlimited' : `${decision.creditsAfter}`
            }
            sub={
              member.metrics.planVisitsPerMonth === null
                ? 'No monthly cap'
                : `of ${member.metrics.planVisitsPerMonth} this month`
            }
          />
          <Fact
            label="Last visit"
            value={member.metrics.lastVisit ? `${member.metrics.daysSinceLastVisit}d ago` : 'Never'}
            sub={`${member.metrics.visitsLast30} visits in 30 days`}
          />
          {member.assignedTrainerId ? (
            <Fact label="Trainer" value={trainerName(member.assignedTrainerId)} sub="Assigned" />
          ) : null}
        </dl>

        {booked ? (
          <p className="mt-4 flex items-center gap-2 rounded-md border border-info-border bg-info-soft px-3 py-2 text-base text-info">
            <Clock aria-hidden className="size-4 shrink-0" />
            <span>
              {`Booked into ${booked.name} at ${clock(new Date(`${NOW.toISOString().slice(0, 10)}T${booked.startTime}:00Z`))} with ${trainerName(booked.trainerId)}.`}
            </span>
          </p>
        ) : null}
      </section>

      {/* --- Staff script + resolution. Never shown on GREEN. --- */}
      {decision.outcome !== 'green' ? (
        <section className="rounded-lg border border-border-strong bg-card">
          <header className="flex items-center gap-2 border-b border-border bg-subtle px-4 py-2.5">
            <UserCheck aria-hidden className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Say this</h3>
            <span className="ml-auto text-micro text-muted-foreground">
              Staff view · not shown to the member
            </span>
          </header>

          <div className="px-4 py-4">
            <blockquote className="border-l-2 border-primary pl-3 text-lg leading-relaxed text-foreground text-pretty">
              {decision.script}
            </blockquote>

            {decision.amountDue !== null ? (
              <p className="mt-3 text-base text-muted-foreground">
                {'Amount to collect: '}
                <span className="font-semibold text-foreground tnum">
                  {money(decision.amountDue)}
                </span>
                {decision.code === 'drop-in' || decision.code === 'credits-exhausted'
                  ? ' — day pass, does not use a plan visit.'
                  : ''}
              </p>
            ) : null}
          </div>

          <footer className="flex flex-wrap items-center gap-2 border-t border-border bg-subtle px-4 py-3">
            {decision.resolve !== 'none' ? (
              <Button variant="primary" size="lg" onClick={startResolve} className="gap-2">
                <ResolveIcon className="size-4" />
                {decision.resolveLabel}
              </Button>
            ) : null}

            {/* An amber member is already admitted; the note is informational. */}
            {decision.admitted ? (
              <Button variant="secondary" size="lg" onClick={onAdmit}>
                {decision.resolve === 'none' ? 'Acknowledge and admit' : 'Admit without resolving'}
              </Button>
            ) : (
              <Button variant="secondary" size="lg" onClick={onTurnAway}>
                Record as not admitted
              </Button>
            )}

            <Button variant="ghost" size="lg" onClick={onCancel} className="ml-auto">
              Cancel
            </Button>
          </footer>
        </section>
      ) : (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-base text-muted-foreground">
            {`Door released. Returning to the start in ${remaining}s.`}
          </p>
          <Button variant="secondary" size="lg" onClick={onAdmit}>
            Done
          </Button>
        </div>
      )}

      <WaiverCapture
        open={waiverOpen}
        member={member}
        onClose={() => setWaiverOpen(false)}
        onSigned={() => {
          setWaiverOpen(false)
          onResolve()
        }}
      />
    </div>
  )
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-micro font-medium tracking-wide uppercase opacity-70">{label}</dt>
      <dd className="text-base font-semibold text-foreground tnum">{value}</dd>
      {sub ? <dd className="text-micro opacity-70">{sub}</dd> : null}
    </div>
  )
}
