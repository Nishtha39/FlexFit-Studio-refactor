'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui/card'
import { NullResultState } from '@/components/ui/empty-state'
import { StatusChip } from '@/components/ui/status-chip'
import { TableWrap, Table, Thead, Tbody, Th, Tr, Td } from '@/components/ui/table'
import { num, percent } from '@/lib/format'
import { EFFECTIVENESS_WINDOW_DAYS, PLAYS, effectiveness } from './retention-data'

/**
 * Did the interventions work? Measured against a matched control group at 60
 * days, with a confidence interval on every row. Where the interval straddles
 * zero the row says "no measurable lift" instead of reporting the point estimate
 * as a win — the alternative is a report that always congratulates itself and so
 * carries no information.
 */
export function EffectivenessReport({ className }: { className?: string }) {
  const conclusive = effectiveness.filter((r) => !r.inconclusive)
  const inconclusive = effectiveness.filter((r) => r.inconclusive)
  const best = conclusive[0] ?? null
  const totalCohort = effectiveness.reduce((s, r) => s + r.cohort, 0)

  return (
    <Card className={className}>
      <CardHeader
        title={`Effectiveness at ${EFFECTIVENESS_WINDOW_DAYS} days`}
        description={`${num(totalCohort)} members contacted, each matched against a control group that received nothing.`}
        actions={
          <StatusChip
            tone={inconclusive.length > 0 ? 'warn' : 'good'}
            label={`${num(conclusive.length)} of ${num(effectiveness.length)} proven`}
          />
        }
      />

      <TableWrap>
        <Table>
          <Thead>
            <tr>
              <Th width={160}>Play</Th>
              <Th align="right" width={80}>
                Cohort
              </Th>
              <Th align="right" width={92}>
                Retained
              </Th>
              <Th align="right" width={92}>
                Control
              </Th>
              <Th align="right" width={132}>
                Lift
              </Th>
              <Th width={150}>Verdict</Th>
            </tr>
          </Thead>
          <Tbody>
            {effectiveness.map((row) => (
              <Tr key={row.play}>
                <Td>
                  <span className="font-medium text-foreground">{PLAYS[row.play].label}</span>
                </Td>
                <Td align="right" muted className="tnum">
                  {num(row.cohort)}
                </Td>
                <Td align="right" className="tnum">
                  {percent(row.retainedRate)}
                </Td>
                <Td align="right" muted className="tnum">
                  {percent(row.controlRate)}
                </Td>
                <Td align="right" className="tnum">
                  <span
                    className={cn(
                      'font-medium',
                      row.inconclusive
                        ? 'text-muted-foreground'
                        : row.lift > 0
                          ? 'text-good'
                          : 'text-danger',
                    )}
                  >
                    {row.lift > 0 ? '+' : '\u2212'}
                    {Math.abs(row.lift).toFixed(1)}
                  </span>
                  <span className="text-muted-foreground"> ±{row.margin.toFixed(1)}pp</span>
                </Td>
                <Td>
                  {row.inconclusive ? (
                    <StatusChip tone="neutral" label="No measurable lift" />
                  ) : (
                    <StatusChip
                      tone={row.lift > 0 ? 'good' : 'danger'}
                      label={row.lift > 0 ? 'Works' : 'Underperforms'}
                    />
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableWrap>

      <CardBody className="space-y-3 border-t border-border">
        {inconclusive.length > 0 ? (
          <NullResultState
            title={`${num(inconclusive.length)} play${inconclusive.length === 1 ? '' : 's'} cannot be called either way yet`}
            description={`${inconclusive
              .map((r) => PLAYS[r.play].label)
              .join(' and ')} ${inconclusive.length === 1 ? 'has' : 'have'} confidence intervals that cross zero — the observed difference is inside the noise for a cohort this size. That is not evidence the play failed; it is evidence the sample is too small to tell. Keep running it and re-read this row when the cohort passes roughly 150 members, or stop spending staff hours on it and accept you will not learn the answer.`}
          />
        ) : null}

        {best ? (
          <p className="text-micro leading-relaxed text-muted-foreground">
            Best measured play is{' '}
            <span className="font-medium text-foreground">{PLAYS[best.play].label}</span> at{' '}
            <span className="font-medium text-foreground tnum">
              +{best.lift.toFixed(1)}pp
            </span>{' '}
            over control, costing{' '}
            <span className="tnum">{num(best.minutesPerMember)} staff minutes</span> per member.
            Cheaper plays with wider intervals are not automatically worse — they are unproven.
          </p>
        ) : null}
      </CardBody>

      <CardFooter>
        <span>Matched on tenure, plan and prior attendance · 95% confidence</span>
        <span className="tnum">{num(totalCohort)} contacted</span>
      </CardFooter>
    </Card>
  )
}
