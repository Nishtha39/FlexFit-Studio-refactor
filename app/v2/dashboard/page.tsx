import { AcquisitionChart } from '@/components/v2/dashboard/acquisition-chart'
import { CheckInGrid } from '@/components/v2/dashboard/check-in-grid'
import { LifecycleBoard } from '@/components/v2/dashboard/lifecycle-board'
import { MetricCard, MetricStat } from '@/components/v2/dashboard/metric-card'
import { HEADLINE_METRICS, SECONDARY_METRICS } from '@/lib/v2/data/dashboard'

/**
 * Studio overview.
 *
 * Reads straight from the fixture modules today; each block takes plain props
 * or imports a typed constant, so moving to tRPC is a change of source only.
 */
export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">
            Studio overview
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Camden branch · updated a moment ago
          </p>
        </div>
      </div>

      {/* Analytics row: chart and the two headline tiles. */}
      <div className="grid gap-4 xl:grid-cols-[1fr_260px]">
        <AcquisitionChart />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          {HEADLINE_METRICS.map((metric, index) => (
            <MetricCard key={metric.id} metric={metric} emphasis={index === 1} />
          ))}
        </div>
      </div>

      <CheckInGrid />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SECONDARY_METRICS.map((metric) => (
          <MetricStat key={metric.id} metric={metric} />
        ))}
      </div>

      <LifecycleBoard />
    </div>
  )
}
