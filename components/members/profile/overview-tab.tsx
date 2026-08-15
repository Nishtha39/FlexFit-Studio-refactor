'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, Pin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardBody, CardFooter, DataPoint, CapacityBar } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusChip } from '@/components/ui/status-chip'
import { ConsequenceNotice } from '@/components/ui/modal'
import type { Member } from '@/lib/types'
import { compactMoney, daysAgo, fullDate, money, num, percent } from '@/lib/format'
import { NOW } from '@/lib/seed'
import { getPlan } from '@/lib/data/plans'
import { getCompany, poolUtilization, weeksToExhaustion } from '@/lib/data/companies'
import { weeklyCheckInCounts } from '@/lib/data/attendance'
import { RiskBreakdown } from './risk-breakdown'
import { NOTE_META, notesFor, programsFor } from './profile-data'
import { toMemberView } from '../member-view'

/**
 * Overview tab. The left column answers "what should I do about this member",
 * the right column answers "why". Anything a staff member must know before
 * speaking to them — pinned injuries, failed payments — is at the top.
 */
export function OverviewTab({ member, onTab }: { member: Member; onTab: (id: string) => void }) {
  const view = toMemberView(member)
  const m = member.metrics
  const plan = getPlan(member.planId)
  const company = member.companyId ? getCompany(member.companyId) : null
  const notes = React.useMemo(() => notesFor(member.id), [member])
  const pinned = notes.filter((n) => n.pinned)
  const programs = React.useMemo(() => programsFor(member), [member])
  const weekly = React.useMemo(() => weeklyCheckInCounts(member.id, 12), [member.id])
  const trend = weekly.slice(-12)
  const maxTrend = Math.max(...trend, 1)

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-4">
        {/* Things that must be said before a conversation starts. */}
        {pinned.length > 0 ? (
          <ConsequenceNotice
            tone="danger"
            headline={
              <span className="flex items-center gap-1.5">
                <Pin aria-hidden className="size-3.5" />
                {NOTE_META[pinned[0].kind].label} on file
              </span>
            }
            detail={pinned.map((n) => (
              <p key={n.id}>{n.body}</p>
            ))}
          />
        ) : null}

        {m.failedPayments > 0 ? (
          <ConsequenceNotice
            tone="warn"
            headline={`${m.failedPayments} failed payment${m.failedPayments > 1 ? 's' : ''} on record`}
            detail={
              <span className="flex flex-wrap items-center gap-2">
                <span>
                  {money(m.monthlyValue)} per month is not collecting. Resolve the card before the
                  next cycle.
                </span>
                <Button variant="secondary" size="xs" onClick={() => onTab('billing')}>
                  Open billing
                  <ArrowRight className="size-3" />
                </Button>
              </span>
            }
          />
        ) : null}

        {/* Engagement */}
        <Card>
          <CardHeader
            title="Engagement"
            description="Trailing 12 weeks of check-ins."
            actions={
              <Button variant="ghost" size="xs" onClick={() => onTab('attendance')}>
                Full history
                <ArrowRight className="size-3" />
              </Button>
            }
          />
          <CardBody className="space-y-4">
            <div className="flex items-end gap-1">
              {trend.map((count, i) => (
                <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <span
                    title={`${count} visit${count === 1 ? '' : 's'}`}
                    className={cn(
                      'w-full rounded-sm',
                      count === 0 ? 'bg-muted' : 'bg-primary',
                    )}
                    style={{ height: `${Math.max(3, (count / maxTrend) * 56)}px` }}
                  />
                  <span className="text-micro text-muted-foreground tnum">
                    {i === 0 || i === trend.length - 1 ? count : ''}
                  </span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <DataPoint
                label="Visits 30d"
                value={num(m.visitsLast30)}
                sub={`prev 30d: ${num(m.visitsPrev30)}`}
              />
              <DataPoint
                label="Per week"
                value={m.avgVisitsPerWeek.toFixed(1)}
                sub="Rolling average"
              />
              <DataPoint
                label="Last visit"
                value={m.lastVisit ? daysAgo(m.lastVisit, NOW) : 'Never'}
                sub={m.lastVisit ? fullDate(m.lastVisit) : 'No check-ins'}
              />
              <DataPoint
                label="Cancel rate"
                value={percent(m.cancelRate * 100)}
                sub="Of bookings made"
              />
            </div>
          </CardBody>
        </Card>

        {/* Plan + utilization */}
        <Card>
          <CardHeader
            title="Plan &amp; utilization"
            actions={<StatusChip tone="neutral" label={plan?.interval ?? 'monthly'} />}
          />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-medium text-foreground">{view.planName}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                  {plan?.description}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-foreground tnum">
                  {money(m.monthlyValue)}
                </p>
                <p className="text-micro text-muted-foreground">per month</p>
              </div>
            </div>

            {m.planVisitsPerMonth === null ? (
              <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                Unlimited plan — there is no allowance to under-use. Judge value by visit frequency
                instead.
              </p>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">This month&apos;s usage</span>
                  <span className="font-medium text-foreground tnum">
                    {num(m.visitsLast30)} of {num(m.planVisitsPerMonth)} visits
                  </span>
                </div>
                <CapacityBar filled={m.visitsLast30} capacity={m.planVisitsPerMonth} />
                {view.utilization !== null && view.utilization < 0.4 ? (
                  <p className="text-micro leading-relaxed text-warn">
                    Using {percent(view.utilization * 100)} of a plan they pay{' '}
                    {money(m.monthlyValue)} for. A downgrade keeps them as a member instead of
                    losing them at renewal.
                  </p>
                ) : null}
              </div>
            )}

            <ul className="flex flex-wrap gap-1.5">
              {plan?.perks.map((perk) => (
                <li
                  key={perk}
                  className="rounded-sm border border-border bg-muted px-1.5 py-px text-micro text-muted-foreground"
                >
                  {perk}
                </li>
              ))}
            </ul>
          </CardBody>
          <CardFooter>
            <span>
              {m.creditsRemaining !== null
                ? `${num(m.creditsRemaining)} credits remaining this cycle`
                : 'No credit balance to track'}
            </span>
            <Button variant="ghost" size="xs" onClick={() => onTab('billing')}>
              Change plan
            </Button>
          </CardFooter>
        </Card>

        {/* Corporate pool context — only when it applies. */}
        {company ? (
          <Card>
            <CardHeader
              title="Corporate pool"
              description={`${company.name} · renews ${fullDate(company.renewalDate)}`}
              actions={
                weeksToExhaustion(company) < 6 ? (
                  <StatusChip tone="danger" label="Near exhausted" />
                ) : (
                  <StatusChip tone="info" label="Healthy" />
                )
              }
            />
            <CardBody className="space-y-3">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-muted-foreground">Pool consumed</span>
                <span className="font-medium text-foreground tnum">
                  {num(company.creditsUsed)} of {num(company.poolCredits)} credits
                </span>
              </div>
              <CapacityBar filled={company.creditsUsed} capacity={company.poolCredits} />
              <p
                className={cn(
                  'text-micro leading-relaxed',
                  weeksToExhaustion(company) < 6 ? 'text-danger' : 'text-muted-foreground',
                )}
              >
                {weeksToExhaustion(company) < 6 ? (
                  <span className="inline-flex items-start gap-1">
                    <AlertTriangle aria-hidden className="mt-px size-3 shrink-0" />
                    At {num(company.burnRatePerWeek)} credits/week the pool runs dry in about{' '}
                    {weeksToExhaustion(company).toFixed(0)} weeks — before the renewal date. This
                    member loses access when it does.
                  </span>
                ) : (
                  `Burning ${num(company.burnRatePerWeek)} credits/week — roughly ${weeksToExhaustion(company).toFixed(0)} weeks of headroom. ${percent(poolUtilization(company) * 100)} used.`
                )}
              </p>
            </CardBody>
            <CardFooter>
              <span>{num(company.employeeMemberIds.length)} employees on this pool</span>
              <Link
                href="/corporate"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Open account
              </Link>
            </CardFooter>
          </Card>
        ) : null}
      </div>

      {/* Right column: the why. */}
      <div className="flex min-w-0 flex-col gap-4">
        <RiskBreakdown risk={member.risk} />

        <Card>
          <CardHeader title="Value" />
          <CardBody className="grid grid-cols-2 gap-4">
            <DataPoint label="Lifetime" value={compactMoney(m.lifetimeValue)} sub="Total collected" />
            <DataPoint label="Monthly" value={compactMoney(m.monthlyValue)} sub="Recurring" />
            <DataPoint
              label="Tenure"
              value={m.tenureMonths < 1 ? 'new' : `${m.tenureMonths} mo`}
              sub={`Joined ${fullDate(member.joinedDate)}`}
            />
            <DataPoint
              label="Freezes"
              value={num(m.freezeCount)}
              sub={m.freezeCount > 0 ? 'Pauses on record' : 'Never paused'}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Booked classes"
            description={`${num(programs.length)} on the weekly schedule`}
            actions={
              <Button variant="ghost" size="xs" onClick={() => onTab('programs')}>
                All
                <ArrowRight className="size-3" />
              </Button>
            }
          />
          {programs.length === 0 ? (
            <CardBody>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Not booked into any classes. Members who attend classes retain materially better
                than floor-only members — worth a recommendation.
              </p>
            </CardBody>
          ) : (
            <ul className="divide-y divide-border">
              {programs.slice(0, 4).map(({ gymClass, waitlistPosition }) => (
                <li
                  key={gymClass.id}
                  className="flex items-center justify-between gap-2 px-4 py-2 text-sm"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium text-foreground">{gymClass.name}</span>
                    <span className="text-muted-foreground"> · {gymClass.startTime}</span>
                  </span>
                  {waitlistPosition ? (
                    <StatusChip tone="info" label={`Waitlist #${waitlistPosition}`} />
                  ) : (
                    <StatusChip tone="good" label="Booked" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Latest notes"
            actions={
              <Button variant="ghost" size="xs" onClick={() => onTab('notes')}>
                All {num(notes.length)}
                <ArrowRight className="size-3" />
              </Button>
            }
          />
          <ul className="divide-y divide-border">
            {notes.slice(0, 3).map((note) => (
              <li key={note.id} className="px-4 py-2.5">
                <div className="flex items-center gap-1.5">
                  <StatusChip tone={NOTE_META[note.kind].tone} label={NOTE_META[note.kind].label} />
                  <span className="text-micro text-muted-foreground">
                    {daysAgo(note.timestamp, NOW)}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-foreground">{note.body}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
