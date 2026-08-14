'use client'

import * as React from 'react'
import Link from 'next/link'
import { Search, Check, AlertTriangle, X, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Member } from '@/lib/types'
import { getPlan } from '@/lib/data/plans'
import { money } from '@/lib/format'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RiskScore } from '@/components/ui/status-chip'
import { lookup, type Decision, type Outcome } from '../kiosk/kiosk-engine'

/**
 * Manual lookup for the front desk. Same decision engine as the kiosk, so a
 * member held at the door sees the identical reason and script here — staff never
 * have to reconcile two different verdicts about the same person.
 */

const OUTCOME_MARK: Record<Outcome, { cls: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
  green: { cls: 'border-good-border bg-good-soft text-good', icon: Check, label: 'Clear to enter' },
  amber: { cls: 'border-warn-border bg-warn-soft text-warn', icon: AlertTriangle, label: 'Enter · needs a word' },
  red: { cls: 'border-danger-border bg-danger-soft text-danger', icon: X, label: 'Hold at door' },
}

export function CheckinLookup({
  evaluate,
  onAdmit,
  onResolve,
}: {
  evaluate: (m: Member) => Decision
  onAdmit: (m: Member, d: Decision) => void
  onResolve: (m: Member, d: Decision) => void
}) {
  const [query, setQuery] = React.useState('')
  const [picked, setPicked] = React.useState<Member | null>(null)

  const results = React.useMemo(() => (query.trim() ? lookup(query, 5) : []), [query])
  const decision = picked ? evaluate(picked) : null

  const reset = () => {
    setPicked(null)
    setQuery('')
  }

  return (
    <Card>
      <CardHeader
        title="Manual check-in"
        description="Search by name, phone tail or PIN. Uses the same rules as the kiosk."
      />

      <div className="flex flex-col gap-3 p-4">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.currentTarget.value)
              setPicked(null)
            }}
            placeholder="Name, last 4 digits or PIN"
            aria-label="Look up a member"
            className="pl-8"
            autoComplete="off"
          />
        </div>

        {!picked && results.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-md border border-border">
            {results.map((m) => {
              const d = evaluate(m)
              const mark = OUTCOME_MARK[d.outcome]
              const Icon = mark.icon
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setPicked(m)}
                    className="flex w-full items-center gap-2.5 bg-surface px-3 py-2 text-left transition-colors duration-150 hover:bg-subtle"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded-sm border',
                        mark.cls,
                      )}
                    >
                      <Icon className="size-3" />
                    </span>
                    <span className="flex min-w-0 flex-col leading-tight">
                      <span className="truncate text-sm font-medium text-foreground">{m.name}</span>
                      <span className="truncate text-micro text-muted-foreground">
                        {getPlan(m.planId)?.name ?? 'Membership'}
                        {' · '}
                        {m.phone.slice(-4)}
                      </span>
                    </span>
                    <RiskScore score={m.risk.score} className="ml-auto shrink-0" />
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}

        {query.trim() && !picked && results.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-subtle px-3 py-3 text-sm leading-relaxed text-muted-foreground">
            {`No member matches "${query}". Try a surname or the last 4 digits of their phone. If they are a visitor, sell a day pass from the kiosk.`}
          </p>
        ) : null}

        {picked && decision ? (
          <MemberVerdict
            member={picked}
            decision={decision}
            onAdmit={() => {
              onAdmit(picked, decision)
              reset()
            }}
            onResolve={() => {
              onResolve(picked, decision)
              reset()
            }}
            onClear={reset}
          />
        ) : null}
      </div>
    </Card>
  )
}

function MemberVerdict({
  member,
  decision,
  onAdmit,
  onResolve,
  onClear,
}: {
  member: Member
  decision: Decision
  onAdmit: () => void
  onResolve: () => void
  onClear: () => void
}) {
  const mark = OUTCOME_MARK[decision.outcome]
  const Icon = mark.icon
  const plan = getPlan(member.planId)

  return (
    <div className={cn('rounded-md border', mark.cls)}>
      <div className="flex items-start gap-2.5 px-3 py-3">
        <span
          aria-hidden
          className={cn('flex size-6 shrink-0 items-center justify-center rounded-sm border', mark.cls)}
        >
          <Icon className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-micro font-semibold tracking-wide uppercase opacity-80">
            {mark.label}
          </p>
          <p className="mt-0.5 text-base font-semibold text-foreground">{decision.headline}</p>
          <p className="mt-0.5 text-sm leading-relaxed text-foreground/80">{decision.detail}</p>
        </div>
        <Link
          href={`/members/${member.id}`}
          aria-label={`Open ${member.name}'s profile`}
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowUpRight className="size-4" />
        </Link>
      </div>

      <dl className="flex flex-wrap gap-x-6 gap-y-2 border-t border-current/15 px-3 py-2.5">
        <Cell label="Member" value={member.name} />
        <Cell label="Plan" value={plan?.name ?? 'Membership'} />
        <Cell
          label="Visits left"
          value={decision.creditsAfter === null ? 'Unlimited' : String(decision.creditsAfter)}
        />
        <Cell
          label="Last visit"
          value={
            member.metrics.daysSinceLastVisit === null
              ? 'Never'
              : `${member.metrics.daysSinceLastVisit}d ago`
          }
        />
        {decision.amountDue !== null ? (
          <Cell label="Due now" value={money(decision.amountDue)} />
        ) : null}
      </dl>

      {decision.script ? (
        <div className="border-t border-current/15 bg-surface/50 px-3 py-2.5">
          <p className="text-micro font-medium tracking-wide text-muted-foreground uppercase">
            Say this
          </p>
          <blockquote className="mt-1 border-l-2 border-primary pl-2.5 text-sm leading-relaxed text-foreground text-pretty">
            {decision.script}
          </blockquote>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-current/15 bg-surface/50 px-3 py-2.5">
        {decision.resolve !== 'none' ? (
          <Button variant="primary" size="sm" onClick={onResolve}>
            {decision.resolveLabel}
          </Button>
        ) : null}
        <Button variant="secondary" size="sm" onClick={onAdmit}>
          {decision.admitted ? 'Check in' : 'Override and check in'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear} className="ml-auto">
          Clear
        </Button>
      </div>
    </div>
  )
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-micro tracking-wide uppercase opacity-70">{label}</dt>
      <dd className="text-sm font-medium text-foreground tnum">{value}</dd>
    </div>
  )
}
