'use client'

import * as React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui/card'
import { monthLabel, num, percent } from '@/lib/format'
import { cohortAverage, cohortMaxMonths, cohorts, worstCohort } from './dashboard-data'

/**
 * Cohort retention triangle. Rows are join months, columns are months since
 * joining. Recent cohorts are short because they have not lived long enough —
 * the empty cells are honest, not missing data, and are labelled as such.
 */

function bandClass(value: number): string {
  if (value >= 85) return 'bg-good-soft text-good'
  if (value >= 70) return 'bg-primary-soft text-accent-foreground'
  if (value >= 55) return 'bg-warn-soft text-warn'
  return 'bg-danger-soft text-danger'
}

export function CohortTriangle() {
  const [activeCohort, setActiveCohort] = React.useState<string | null>(null)
  const months = Array.from({ length: cohortMaxMonths }, (_, i) => i)

  const selected = cohorts.find((c) => c.month === activeCohort) ?? null
  const totalJoiners = cohorts.reduce((s, c) => s + c.size, 0)
  const month3 = cohortAverage(3)
  const month6 = cohortAverage(6)

  // min-w-0 — see attendance-heatmap: keeps the min-w-[36rem] table inside its own
  // scroll container instead of widening the page.
  return (
    <Card className="min-w-0">
      <CardHeader
        title="Cohort retention"
        description="Share of each join month still a member N months later. Blank cells mean the cohort is not old enough yet."
      />

      <CardBody>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[36rem] border-separate border-spacing-0.5 text-sm">
            <caption className="sr-only">
              Retention percentage by join-month cohort and months since joining
            </caption>
            <thead>
              <tr>
                <th scope="col" className="pb-1 text-left text-micro font-medium text-muted-foreground uppercase">
                  Cohort
                </th>
                <th scope="col" className="pb-1 pr-2 text-right text-micro font-medium text-muted-foreground uppercase">
                  Size
                </th>
                {months.map((m) => (
                  <th
                    key={m}
                    scope="col"
                    className="pb-1 text-center text-micro font-medium text-muted-foreground tnum"
                  >
                    M{m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohorts.map((cohort) => {
                const isActive = cohort.month === activeCohort
                return (
                  <tr
                    key={cohort.month}
                    onMouseEnter={() => setActiveCohort(cohort.month)}
                    onMouseLeave={() => setActiveCohort(null)}
                  >
                    <th
                      scope="row"
                      className={cn(
                        'py-0.5 pr-2 text-left text-micro font-medium whitespace-nowrap tnum',
                        isActive ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {monthLabel(cohort.month)}
                    </th>
                    <td className="pr-2 text-right text-micro text-muted-foreground tnum">
                      {num(cohort.size)}
                    </td>
                    {months.map((m) => {
                      const value = cohort.retention[m]
                      if (value === undefined) {
                        return (
                          <td key={m} className="p-0">
                            <span
                              aria-hidden
                              className="block h-6 w-full rounded-sm border border-dashed border-border"
                            />
                          </td>
                        )
                      }
                      return (
                        <td key={m} className="p-0">
                          <span
                            title={`${monthLabel(cohort.month)} cohort, month ${m}: ${percent(value, 0)} retained`}
                            className={cn(
                              'block h-6 w-full rounded-sm text-center text-micro leading-6 font-medium tnum transition-[outline] duration-150',
                              bandClass(value),
                              isActive && 'outline-1 outline-foreground/30',
                            )}
                          >
                            {Math.round(value)}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <th
                  scope="row"
                  colSpan={2}
                  className="pt-1.5 pr-2 text-left text-micro font-medium text-foreground uppercase"
                >
                  Average
                </th>
                {months.map((m) => {
                  const avg = cohortAverage(m)
                  return (
                    <td key={m} className="pt-1.5 text-center text-micro font-medium text-foreground tnum">
                      {avg.cohorts > 0 ? Math.round(avg.value) : '—'}
                    </td>
                  )
                })}
              </tr>
              <tr>
                <td colSpan={2} />
                {months.map((m) => {
                  const avg = cohortAverage(m)
                  return (
                    <td key={m} className="text-center text-micro text-muted-foreground tnum">
                      {avg.cohorts > 0 ? `n${avg.cohorts}` : ''}
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-micro font-medium tracking-wide text-muted-foreground uppercase">
              Month 3 average
            </span>
            <span className="text-base font-medium text-foreground tnum">
              {percent(month3.value, 1)}
            </span>
            <span className="text-micro text-muted-foreground tnum">
              across {num(month3.cohorts)} cohorts
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-micro font-medium tracking-wide text-muted-foreground uppercase">
              Month 6 average
            </span>
            <span className="text-base font-medium text-foreground tnum">
              {month6.cohorts > 0 ? percent(month6.value, 1) : 'Not yet observable'}
            </span>
            <span className="text-micro text-muted-foreground tnum">
              across {num(month6.cohorts)} cohorts
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-micro font-medium tracking-wide text-muted-foreground uppercase">
              {selected ? 'Hovered cohort' : 'Weakest cohort'}
            </span>
            <span className="text-base font-medium text-foreground tnum">
              {selected
                ? `${monthLabel(selected.month)} · ${percent(selected.survivalToday, 0)} today`
                : worstCohort
                  ? `${monthLabel(worstCohort.month)} · ${percent(worstCohort.retention[3], 0)} at M3`
                  : '—'}
            </span>
            <span className="text-micro text-muted-foreground tnum">
              {selected
                ? `${num(selected.size)} joined that month`
                : worstCohort
                  ? `${num(worstCohort.size)} joined — January intakes decay fastest`
                  : ''}
            </span>
          </div>
        </div>
      </CardBody>

      <CardFooter>
        <span className="tnum">{num(totalJoiners)} joiners across {num(cohorts.length)} cohorts</span>
        <Link href="/members" className="font-medium text-primary underline-offset-2 hover:underline">
          Open the directory
        </Link>
      </CardFooter>
    </Card>
  )
}
