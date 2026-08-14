'use client'

import * as React from 'react'
import { PageHeader, PageBody } from '@/components/shell/page-header'
import { RequireScreen } from '@/components/shell/app-shell'
import { Card, KpiTile } from '@/components/ui/card'
import { DeltaText } from '@/components/ui/status-chip'
import { compactMoney, num } from '@/lib/format'
import { RiskDistribution } from './risk-distribution'
import { RiskMovementPanels } from './risk-movement'
import { InterventionQueue } from './intervention-queue'
import { RiskContribution } from './risk-contribution'
import { EffectivenessReport } from './effectiveness-report'
import {
  bandSummary,
  effectiveness,
  enteringRisk,
  interventionQueue,
  leavingRisk,
  queueValue,
  retentionPool,
} from './retention-data'

/**
 * Retention. The order is deliberate: how big is the problem, is it getting
 * worse, who do I call today, why is this member at risk, and did any of it
 * work. Everything below the queue exists to justify or refute the queue.
 */
export function RetentionDashboard() {
  const bands = React.useMemo(() => bandSummary(), [])
  const high = bands[0]
  const netMovement = enteringRisk.length - leavingRisk.length
  const atStake = queueValue(interventionQueue)
  const proven = effectiveness.filter((r) => !r.inconclusive).length

  return (
    <RequireScreen screen="retention">
      <PageHeader
        title="Retention"
        crumbs={[{ label: 'FlexFit Studio', href: '/dashboard' }, { label: 'Retention' }]}
        meta={
          <>
            <span className="tnum">{num(retentionPool.length)} savable members</span>
            <span aria-hidden>·</span>
            <span className="tnum">{num(interventionQueue.length)} flagged today</span>
            <span aria-hidden>·</span>
            <span className="tnum">{compactMoney(atStake)}/mo at stake</span>
          </>
        }
        sticky={false}
      />

      <PageBody>
        <Card className="grid grid-cols-2 lg:grid-cols-4">
          <KpiTile
            label="High risk"
            value={num(high.count)}
            delta={<DeltaText value={netMovement} formatted={`${Math.abs(netMovement)}`} inverse />}
            footnote={`${compactMoney(high.monthlyValue)}/mo exposed`}
          />
          <KpiTile
            label="Entered this week"
            value={num(enteringRisk.length)}
            footnote="Crossed above 70"
          />
          <KpiTile
            label="Recovered this week"
            value={num(leavingRisk.length)}
            footnote="Dropped below 70"
          />
          <KpiTile
            label="Proven plays"
            value={`${num(proven)}/${num(effectiveness.length)}`}
            footnote="Rest are unproven, not failed"
          />
        </Card>

        <RiskDistribution />

        <RiskMovementPanels />

        <InterventionQueue />

        <div className="grid gap-4 lg:grid-cols-2">
          <RiskContribution />
          <EffectivenessReport />
        </div>
      </PageBody>
    </RequireScreen>
  )
}
