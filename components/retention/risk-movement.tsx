'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { compactMoney, num } from '@/lib/format'
import { enteringRisk, leavingRisk, type RiskMovement } from './retention-data'

/**
 * Movement across the high-risk line in the last 7 days. A static distribution
 * tells you the size of the problem; this tells you whether it is getting worse.
 * Entering is the queue you work today. Leaving is the only evidence the work
 * is landing.
 */
function MovementRow({ movement, direction }: { movement: RiskMovement; direction: 'in' | 'out' }) {
  const { member, previousScore, currentScore, driver } = movement
  const Icon = direction === 'in' ? ArrowUpRight : ArrowDownRight
  return (
    <li className="flex items-start gap-2.5 py-2">
      <Icon
        aria-hidden
        className={cn('mt-0.5 size-3.5 shrink-0', direction === 'in' ? 'text-danger' : 'text-good')}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <Link
            href={`/members/${member.id}`}
            className="truncate text-sm font-medium text-foreground underline-offset-2 hover:underline"
          >
            {member.name}
          </Link>
          <span className="shrink-0 text-micro text-muted-foreground tnum">
            {previousScore} <span aria-hidden>&rarr;</span>{' '}
            <span
              className={cn('font-medium', direction === 'in' ? 'text-danger' : 'text-good')}
            >
              {currentScore}
            </span>
          </span>
        </div>
        <p className="truncate text-micro text-muted-foreground">
          {driver ? driver.detail : 'No single dominant factor'} ·{' '}
          <span className="tnum">{compactMoney(member.metrics.monthlyValue)}/mo</span>
        </p>
      </div>
    </li>
  )
}

function MovementCard({
  title,
  description,
  movements,
  direction,
  emptyTitle,
  emptyDescription,
}: {
  title: string
  description: string
  movements: RiskMovement[]
  direction: 'in' | 'out'
  emptyTitle: string
  emptyDescription: string
}) {
  const shown = movements.slice(0, 6)
  const value = movements.reduce((s, m) => s + m.member.metrics.monthlyValue, 0)

  return (
    <Card>
      <CardHeader
        title={title}
        description={description}
        actions={
          <span
            className={cn(
              'text-lg leading-none font-semibold tnum',
              direction === 'in' ? 'text-danger' : 'text-good',
            )}
          >
            {direction === 'in' ? '+' : '\u2212'}
            {num(movements.length)}
          </span>
        }
      />
      <CardBody className={shown.length === 0 ? '' : 'py-1'}>
        {shown.length === 0 ? (
          <EmptyState title={emptyTitle} description={emptyDescription} />
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((m) => (
              <MovementRow key={m.member.id} movement={m} direction={direction} />
            ))}
          </ul>
        )}
      </CardBody>
      {movements.length > 0 ? (
        <CardFooter>
          <span className="tnum">{compactMoney(value)}/mo affected</span>
          {movements.length > shown.length ? (
            <span className="tnum">{num(movements.length - shown.length)} more</span>
          ) : (
            <span>All shown</span>
          )}
        </CardFooter>
      ) : null}
    </Card>
  )
}

export function RiskMovementPanels({ className }: { className?: string }) {
  return (
    <div className={cn('grid gap-4 lg:grid-cols-2', className)}>
      <MovementCard
        title="Entered high risk"
        description="Crossed 70 in the last 7 days."
        movements={enteringRisk}
        direction="in"
        emptyTitle="Nobody crossed into high risk"
        emptyDescription="No member moved above 70 this week."
      />
      <MovementCard
        title="Left high risk"
        description="Dropped below 70 in the last 7 days."
        movements={leavingRisk}
        direction="out"
        emptyTitle="Nobody recovered this week"
        emptyDescription="No member moved back below 70. Recovery is the metric that proves the queue works — an empty list here is a warning, not a clean slate."
      />
    </div>
  )
}
