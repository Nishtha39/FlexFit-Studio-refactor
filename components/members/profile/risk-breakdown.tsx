import * as React from 'react'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui/card'
import { StatusChip } from '@/components/ui/status-chip'
import { RISK_BAND_META } from '@/lib/risk'
import type { RiskResult } from '@/lib/types'

/**
 * Risk contribution breakdown: the score, then every factor that produced it,
 * as bars proportional to their points. The factors sum to the total, so an
 * operator can audit the number instead of trusting it. A score with no cause
 * is a score nobody will act on.
 */
export function RiskBreakdown({ risk, className }: { risk: RiskResult; className?: string }) {
  const band = RISK_BAND_META[risk.band]
  const tone = risk.band === 'high' ? 'danger' : risk.band === 'medium' ? 'warn' : 'good'
  const max = Math.max(...risk.factors.map((f) => f.points), 1)
  const total = risk.factors.reduce((s, f) => s + f.points, 0)

  return (
    <Card className={className}>
      <CardHeader
        title="Churn risk"
        description="Every point in this score is attributable to a factor below."
        actions={<StatusChip tone={tone} label={`${band.label} · ${band.range}`} />}
      />
      <CardBody className="space-y-4">
        <div className="flex items-end gap-3">
          <span
            className={cn(
              'text-xl font-semibold leading-none tnum',
              tone === 'danger' ? 'text-danger' : tone === 'warn' ? 'text-warn' : 'text-good',
            )}
          >
            {risk.score}
          </span>
          <span className="pb-0.5 text-micro text-muted-foreground">
            out of 100 · {risk.factors.length} contributing factor
            {risk.factors.length === 1 ? '' : 's'}
          </span>
        </div>

        {risk.factors.length === 0 ? (
          <p className="rounded-md border border-good-border bg-good-soft px-3 py-2.5 text-sm leading-relaxed text-good">
            No risk factors are firing. This member visits regularly, pays on time and uses their
            plan — there is nothing to intervene on.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {risk.factors.map((factor) => {
              const share = factor.points / max
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
      </CardBody>
      {risk.factors.length > 0 ? (
        <CardFooter>
          <span>Factors sum to the score</span>
          <span className="font-medium text-foreground tnum">
            {risk.factors.map((f) => f.points).join(' + ')} = {total}
          </span>
        </CardFooter>
      ) : null}
    </Card>
  )
}
