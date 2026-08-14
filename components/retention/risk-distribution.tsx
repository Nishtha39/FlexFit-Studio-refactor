'use client'

import * as React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui/card'
import { StatusChip } from '@/components/ui/status-chip'
import { RISK_BAND_META } from '@/lib/risk'
import { compactMoney, num, percent } from '@/lib/format'
import { bandSummary, riskDistribution, retentionPool } from './retention-data'
import type { RiskBand } from '@/lib/types'

const bandTone: Record<RiskBand, 'good' | 'warn' | 'danger'> = {
  low: 'good',
  medium: 'warn',
  high: 'danger',
}

const barTone: Record<RiskBand, string> = {
  low: 'bg-good',
  medium: 'bg-warn',
  high: 'bg-danger',
}

/**
 * Where the book of business actually sits on the risk scale. The histogram is
 * bucketed by 10 points because that is the resolution an operator can act on;
 * a smooth curve would imply precision the score does not have.
 */
export function RiskDistribution({ className }: { className?: string }) {
  const buckets = React.useMemo(() => riskDistribution(), [])
  const bands = React.useMemo(() => bandSummary(), [])
  const maxCount = Math.max(...buckets.map((b) => b.count), 1)
  const total = retentionPool.length
  const atRiskValue = bands
    .filter((b) => b.band !== 'low')
    .reduce((s, b) => s + b.monthlyValue, 0)

  return (
    <Card className={className}>
      <CardHeader
        title="Risk distribution"
        description={`All ${num(total)} savable members by churn-risk score.`}
        actions={<StatusChip tone="danger" label={`${num(bands[0].count)} high`} />}
      />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {bands.map((b) => (
            <div key={b.band} className="flex flex-col gap-1">
              <span className="text-micro font-medium tracking-wide text-muted-foreground uppercase">
                {RISK_BAND_META[b.band].label} · {RISK_BAND_META[b.band].range}
              </span>
              <span
                className={cn(
                  'text-xl leading-none font-semibold tnum',
                  b.band === 'high'
                    ? 'text-danger'
                    : b.band === 'medium'
                      ? 'text-warn'
                      : 'text-good',
                )}
              >
                {num(b.count)}
              </span>
              <span className="text-micro text-muted-foreground tnum">
                {percent(b.share)} · {compactMoney(b.monthlyValue)}/mo
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-stretch gap-1" role="img" aria-label="Risk score histogram">
          {buckets.map((bucket) => {
            const height = bucket.count / maxCount
            return (
              <div
                key={bucket.from}
                className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
              >
                <span className="text-micro text-muted-foreground tnum">
                  {bucket.count > 0 ? bucket.count : ''}
                </span>
                <div
                  title={`${bucket.from}–${bucket.to}: ${bucket.count} members · ${compactMoney(bucket.value)}/mo`}
                  className="flex h-24 w-full items-end"
                >
                  <div
                    className={cn('w-full rounded-t-sm', barTone[bucket.band])}
                    style={{ height: `${Math.max(height * 100, bucket.count > 0 ? 3 : 0)}%` }}
                  />
                </div>
                <span className="text-micro text-muted-foreground tnum">{bucket.from}</span>
              </div>
            )
          })}
        </div>

        <p className="text-micro leading-relaxed text-muted-foreground">
          The 70-point line is where a member becomes worth a staff hour.{' '}
          <span className="font-medium text-foreground tnum">{compactMoney(atRiskValue)}</span> of
          monthly recurring revenue sits at or above the watch threshold.
        </p>
      </CardBody>
      <CardFooter>
        <span>Scores recomputed nightly from attendance, billing and plan use</span>
        <Link
          href="/members?view=at-risk"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Open in directory
        </Link>
      </CardFooter>
    </Card>
  )
}
