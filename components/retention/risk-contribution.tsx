'use client'

import * as React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui/card'
import { Select } from '@/components/ui/input'
import { StatusChip } from '@/components/ui/status-chip'
import { RISK_BAND_META } from '@/lib/risk'
import { compactMoney, num } from '@/lib/format'
import { interventionQueue, PLAYS, playFor } from './retention-data'
import type { Member } from '@/lib/types'

/**
 * "78 → its causes." The score is additive from named factors, so the bars are
 * proportional to points and always reconcile to the total. An operator who
 * cannot audit a score will not act on it — and a score nobody acts on is worse
 * than no score, because it looks like the work is being done.
 */
export function RiskContribution({ className }: { className?: string }) {
  const candidates = React.useMemo(() => interventionQueue.slice(0, 12), [])
  const [selectedId, setSelectedId] = React.useState(candidates[0]?.member.id ?? '')

  const member: Member | undefined =
    candidates.find((i) => i.member.id === selectedId)?.member ?? candidates[0]?.member

  if (!member) return null

  const risk = member.risk
  const band = RISK_BAND_META[risk.band]
  const tone = risk.band === 'high' ? 'danger' : risk.band === 'medium' ? 'warn' : 'good'
  const total = risk.factors.reduce((s, f) => s + f.points, 0)
  const play = PLAYS[playFor(member)]

  return (
    <Card className={className}>
      <CardHeader
        title="Risk breakdown"
        description="Every point traced to the factor that produced it."
        actions={<StatusChip tone={tone} label={`${band.label} \u00b7 ${band.range}`} />}
      />
      <CardBody className="space-y-4">
        <Select
          aria-label="Select a member to audit"
          value={member.id}
          onChange={(e) => setSelectedId(e.currentTarget.value)}
        >
          {candidates.map((item) => (
            <option key={item.member.id} value={item.member.id}>
              {item.member.name} — risk {item.member.risk.score} ·{' '}
              {compactMoney(item.member.metrics.monthlyValue)}/mo
            </option>
          ))}
        </Select>

        <div className="flex items-end gap-3">
          <span
            className={cn(
              'text-xl leading-none font-semibold tnum',
              tone === 'danger' ? 'text-danger' : tone === 'warn' ? 'text-warn' : 'text-good',
            )}
          >
            {risk.score}
          </span>
          <span className="pb-0.5 text-micro text-muted-foreground">
            out of 100 · {num(risk.factors.length)} contributing factor
            {risk.factors.length === 1 ? '' : 's'}
          </span>
        </div>

        {risk.factors.length === 0 ? (
          <p className="rounded-md border border-good-border bg-good-soft px-3 py-2.5 text-sm leading-relaxed text-good">
            No risk factors are firing for this member. There is nothing to intervene on.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {risk.factors.map((factor) => {
              // Bars are scaled against the score, not the largest factor, so the
              // widths read as "share of 100" rather than a relative ranking.
              const share = factor.points / Math.max(total, 1)
              return (
                <li key={factor.key} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-medium text-foreground">
                      {factor.label}
                    </span>
                    <span className="shrink-0 text-micro font-medium text-muted-foreground tnum">
                      +{factor.points}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-sm bg-muted">
                    <div
                      className={cn(
                        'h-full',
                        factor.points >= 20
                          ? 'bg-danger'
                          : factor.points >= 10
                            ? 'bg-warn'
                            : 'bg-border-strong',
                      )}
                      style={{ width: `${share * 100}%` }}
                    />
                  </div>
                  <p className="text-micro leading-relaxed text-muted-foreground">
                    {factor.detail}
                  </p>
                </li>
              )
            })}
          </ul>
        )}

        <div className="rounded-md border border-border bg-subtle px-3 py-2.5">
          <p className="text-micro font-medium tracking-wide text-muted-foreground uppercase">
            Recommended play
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">{play.label}</p>
          <p className="mt-0.5 text-micro leading-relaxed text-muted-foreground">{play.script}</p>
        </div>
      </CardBody>
      <CardFooter>
        {risk.factors.length > 0 ? (
          <span className="tnum">
            {risk.factors.map((f) => f.points).join(' + ')} = {total}
          </span>
        ) : (
          <span>No contributing factors</span>
        )}
        <Link
          href={`/members/${member.id}`}
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Open profile
        </Link>
      </CardFooter>
    </Card>
  )
}
