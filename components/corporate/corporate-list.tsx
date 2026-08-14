'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { PageHeader, PageBody } from '@/components/shell/page-header'
import { RequireScreen } from '@/components/shell/app-shell'
import { Card, CardBody, CardHeader, KpiTile, CapacityBar } from '@/components/ui/card'
import { StatusChip } from '@/components/ui/status-chip'
import { ConsequenceNotice } from '@/components/ui/modal'
import { compactMoney, fullDate, num, percent } from '@/lib/format'
import { HEALTH_META, pools } from './corporate-data'

/**
 * Corporate pools. Sorted by how close each is to running dry, because that is
 * the only event on this screen that hurts: the pool empties and employees who
 * believe they have a membership are turned away at the desk.
 */
export function CorporateList() {
  const atRisk = pools.filter((p) => p.health === 'critical' || p.health === 'exhausted')
  const credits = pools.reduce((s, p) => s + p.company.poolCredits, 0)
  const used = pools.reduce((s, p) => s + p.company.creditsUsed, 0)
  const employees = pools.reduce((s, p) => s + p.employees.length, 0)
  const monthlyValue = pools.reduce((s, p) => s + p.costPerCredit * p.company.burnRatePerWeek * 4, 0)

  return (
    <RequireScreen screen="corporate">
      <PageHeader
        title="Corporate"
        crumbs={[{ label: 'FlexFit Studio', href: '/dashboard' }, { label: 'Corporate' }]}
        meta={
          <>
            <span className="tnum">{pools.length} pools</span>
            <span aria-hidden>·</span>
            <span className="tnum">{num(employees)} employees</span>
            <span aria-hidden>·</span>
            <span className="tnum">{percent((used / credits) * 100)} of credits consumed</span>
          </>
        }
        sticky={false}
      />

      <PageBody>
        <Card className="grid grid-cols-2 lg:grid-cols-4">
          <KpiTile label="Credits sold" value={num(credits)} footnote="Across all live contracts" />
          <KpiTile label="Consumed" value={num(used)} footnote={percent((used / credits) * 100)} />
          <KpiTile label="Employees covered" value={num(employees)} footnote={`${num(pools.reduce((s, p) => s + p.activeEmployees, 0))} active in 30 days`} />
          <KpiTile label="Monthly burn value" value={compactMoney(monthlyValue)} footnote="At the current burn rate" />
        </Card>

        {atRisk.length > 0 ? (
          <ConsequenceNotice
            tone="danger"
            headline={`${atRisk.length === 1 ? atRisk[0].company.name : `${atRisk.length} pools`} will run out before renewal`}
            detail={
              <>
                {atRisk[0].company.name} has {num(atRisk[0].remaining)} credits left and burns{' '}
                {atRisk[0].company.burnRatePerWeek}/week — roughly {atRisk[0].weeksLeft.toFixed(1)} weeks,
                against {atRisk[0].weeksToRenewal.toFixed(1)} weeks until renewal. Employees get turned
                away at the desk on the day it empties.{' '}
                <Link href={`/corporate/${atRisk[0].company.id}`} className="font-medium underline underline-offset-2">
                  Open {atRisk[0].company.name}
                </Link>
                .
              </>
            }
          />
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          {pools.map((pool) => {
            const health = HEALTH_META[pool.health]
            return (
              <Card key={pool.company.id}>
                <CardHeader
                  title={
                    <Link href={`/corporate/${pool.company.id}`} className="hover:text-primary hover:underline">
                      {pool.company.name}
                    </Link>
                  }
                  description={`${pool.planName} · renews ${fullDate(pool.company.renewalDate)}`}
                  actions={<StatusChip tone={health.tone} label={health.label} />}
                />
                <CardBody className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xl font-semibold text-foreground tnum">{num(pool.remaining)}</span>
                      <span className="text-micro text-muted-foreground tnum">
                        of {num(pool.company.poolCredits)} left
                      </span>
                    </div>
                    <CapacityBar filled={pool.company.creditsUsed} capacity={pool.company.poolCredits} />
                  </div>

                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div>
                      <dt className="text-micro tracking-wide text-muted-foreground uppercase">Burn / week</dt>
                      <dd className="text-sm font-medium text-foreground tnum">{pool.company.burnRatePerWeek}</dd>
                    </div>
                    <div>
                      <dt className="text-micro tracking-wide text-muted-foreground uppercase">Weeks left</dt>
                      <dd className="text-sm font-medium text-foreground tnum">
                        {pool.remaining === 0 ? '0' : pool.weeksLeft.toFixed(1)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-micro tracking-wide text-muted-foreground uppercase">To renewal</dt>
                      <dd className="text-sm font-medium text-foreground tnum">{pool.weeksToRenewal.toFixed(1)} wks</dd>
                    </div>
                    <div>
                      <dt className="text-micro tracking-wide text-muted-foreground uppercase">Employees</dt>
                      <dd className="text-sm font-medium text-foreground tnum">
                        {num(pool.employees.length)}
                        <span className="ml-1 text-micro text-muted-foreground">
                          {num(pool.activeEmployees)} active
                        </span>
                      </dd>
                    </div>
                  </dl>

                  {pool.shortfall > 0 ? (
                    <p className="rounded-md border border-warn-border bg-warn-soft px-2.5 py-2 text-micro leading-relaxed text-warn">
                      Short by ~{num(pool.shortfall)} credits before {fullDate(pool.company.renewalDate)}.
                    </p>
                  ) : (
                    <p className="text-micro leading-relaxed text-muted-foreground">
                      Lasts past renewal at the current rate. No action needed.
                    </p>
                  )}

                  <Link
                    href={`/corporate/${pool.company.id}`}
                    className="inline-flex items-center gap-1 text-micro font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Pool detail
                    <ArrowUpRight className="size-3" />
                  </Link>
                </CardBody>
              </Card>
            )
          })}
        </div>
      </PageBody>
    </RequireScreen>
  )
}
