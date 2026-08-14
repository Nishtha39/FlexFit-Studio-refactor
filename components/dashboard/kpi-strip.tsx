'use client'

import { useRouter } from 'next/navigation'
import { Card, KpiTile } from '@/components/ui/card'
import { DeltaText } from '@/components/ui/status-chip'
import { compactMoney, delta as fmtDelta, num, percent } from '@/lib/format'
import { kpis, type Kpi } from './dashboard-data'

/**
 * Every KPI is a link. A metric you cannot click is a metric you cannot act
 * on, so each tile navigates to the screen where the number can be changed.
 */
function kpiValue(kpi: Kpi) {
  if (kpi.format === 'money') return compactMoney(kpi.value)
  if (kpi.format === 'percent') return percent(kpi.value, 1)
  return num(kpi.value)
}

export function KpiStrip() {
  const router = useRouter()

  return (
    <Card className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
      {kpis.map((kpi) => (
        <KpiTile
          key={kpi.id}
          label={kpi.label}
          value={kpiValue(kpi)}
          footnote={kpi.footnote}
          role="link"
          tabIndex={0}
          aria-label={`${kpi.label}: ${kpiValue(kpi)}. ${kpi.footnote}`}
          onClick={() => router.push(kpi.href)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              router.push(kpi.href)
            }
          }}
          className="border-b border-border last:border-b-0 md:border-b-0"
          delta={
            <DeltaText
              value={kpi.delta}
              formatted={fmtDelta(kpi.delta, { unit: kpi.deltaUnit })}
              inverse={kpi.inverse}
            />
          }
        />
      ))}
    </Card>
  )
}
