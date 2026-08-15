import { AlertTriangle, CalendarClock, CheckCircle2, Wrench } from 'lucide-react'
import type {
  Equipment,
  EquipmentFault,
  EquipmentService,
  EquipmentStatus,
} from '@/lib/v2/types'
import { LOCATION_LABELS } from '@/lib/v2/types'
import { dateStamp, money } from '@/lib/v2/format'
import { Badge } from '@/components/v2/ui/badge'
import { Button } from '@/components/v2/ui/button'
import { DetailPanel, DetailShell, type DetailStat } from '@/components/v2/shared/detail-shell'
import { cn } from '@/lib/v2/utils'

const STATUS_LABELS: Record<EquipmentStatus, string> = {
  'in-service': 'In service',
  'needs-service': 'Needs service',
  'out-of-service': 'Out of service',
  retired: 'Retired',
}

const STATUS_STYLES: Record<EquipmentStatus, string> = {
  'in-service': 'bg-lime text-ink',
  'needs-service': 'bg-accent text-accent-foreground',
  'out-of-service': 'bg-destructive text-destructive-foreground',
  retired: 'bg-secondary text-muted-foreground',
}

const SEVERITY_STYLES: Record<EquipmentFault['severity'], string> = {
  low: 'bg-secondary text-muted-foreground',
  medium: 'bg-accent text-accent-foreground',
  high: 'bg-destructive text-destructive-foreground',
}

export function EquipmentDetailView({
  asset,
  categoryLabel,
  faults,
  services,
  bookValueAmount,
  nextService,
  daysUntilService,
}: {
  asset: Equipment
  categoryLabel: string
  faults: EquipmentFault[]
  services: EquipmentService[]
  bookValueAmount: number
  nextService: string | null
  daysUntilService: number | null
}) {
  const openFaults = faults.filter((f) => !f.resolvedDate)
  const overdue = daysUntilService !== null && daysUntilService < 0
  // A retired asset has left the floor, so a service date for it is noise.
  const serviceRelevant = asset.status !== 'retired'
  const lifetimeSpend = services.reduce((sum, s) => sum + s.cost, 0)

  const stats: DetailStat[] = [
    {
      label: 'Status',
      value: STATUS_LABELS[asset.status],
      hint: `${asset.quantity} unit${asset.quantity === 1 ? '' : 's'} in ${asset.zone}`,
      tone:
        asset.status === 'out-of-service'
          ? 'critical'
          : asset.status === 'needs-service'
            ? 'warning'
            : asset.status === 'in-service'
              ? 'positive'
              : 'default',
    },
    {
      label: 'Open faults',
      value: String(openFaults.length),
      hint: openFaults.length ? 'Awaiting a fix' : 'Nothing outstanding',
      tone: openFaults.length ? 'critical' : 'positive',
    },
    {
      label: 'Next service',
      value: !serviceRelevant
        ? '—'
        : nextService
          ? dateStamp(nextService)
          : 'Unscheduled',
      hint: !serviceRelevant
        ? 'Retired asset'
        : daysUntilService === null
          ? 'No service on record'
          : overdue
            ? `${Math.abs(daysUntilService)} days overdue`
            : `in ${daysUntilService} days`,
      tone: overdue && serviceRelevant ? 'critical' : 'default',
    },
    {
      label: 'Book value',
      value: money(bookValueAmount),
      hint: `${money(asset.unitCost)} per unit at purchase`,
    },
  ]

  return (
    <DetailShell
      backHref="/equipment"
      backLabel="Back to equipment"
      eyebrow={`${categoryLabel} · ${asset.assetTag}`}
      title={asset.name}
      subtitle={`${asset.make} ${asset.model} — ${asset.quantity} unit${asset.quantity === 1 ? '' : 's'} on the ${asset.zone.toLowerCase()} at ${LOCATION_LABELS[asset.location]}.`}
      badges={
        <>
          <Badge className={STATUS_STYLES[asset.status]}>{STATUS_LABELS[asset.status]}</Badge>
          <Badge variant="secondary">{categoryLabel}</Badge>
          {asset.bookable ? (
            <Badge className="bg-sky text-ink">Bookable · {asset.slotMinutes} min slots</Badge>
          ) : null}
          {overdue && serviceRelevant ? (
            <Badge className="bg-destructive text-destructive-foreground">
              <AlertTriangle className="mr-1 size-3" aria-hidden="true" />
              Service overdue
            </Badge>
          ) : null}
        </>
      }
      actions={
        <>
          <Button variant="outline" className="rounded-full bg-card">
            Report a fault
          </Button>
          <Button
            className="rounded-full bg-brand text-white hover:bg-brand/90"
            disabled={asset.status === 'retired'}
          >
            Log a service
          </Button>
        </>
      }
      stats={stats}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <DetailPanel
            title="Fault history"
            description={
              faults.length
                ? `${openFaults.length} open of ${faults.length} reported.`
                : 'Nothing has been reported against this asset.'
            }
          >
            {faults.length ? (
              <ul className="flex flex-col gap-3">
                {faults.map((f) => (
                  <li
                    key={f.id}
                    className={cn(
                      'flex flex-col gap-2 rounded-2xl border p-3.5',
                      f.resolvedDate ? 'border-border' : 'border-destructive/25 bg-destructive/5',
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={cn('text-xs capitalize', SEVERITY_STYLES[f.severity])}>
                        {f.severity}
                      </Badge>
                      {f.resolvedDate ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <CheckCircle2 className="size-3.5" aria-hidden="true" />
                          Resolved {dateStamp(f.resolvedDate)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                          <AlertTriangle className="size-3.5" aria-hidden="true" />
                          Open
                        </span>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {dateStamp(f.reportedDate)}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed">{f.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      Reported by {f.reporterName}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No faults on record.</p>
            )}
          </DetailPanel>

          <DetailPanel
            title="Service log"
            description={
              services.length
                ? `${money(lifetimeSpend)} spent across ${services.length} visit${services.length === 1 ? '' : 's'}.`
                : 'No services recorded yet.'
            }
          >
            {services.length ? (
              <ul className="divide-y divide-border">
                {services.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3">
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                      <Wrench className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      {s.vendor}
                    </span>
                    <span className="text-xs text-muted-foreground">{dateStamp(s.date)}</span>
                    <span className="ml-auto text-sm tabular-nums">{money(s.cost)}</span>
                    {s.notes ? (
                      <p className="w-full text-sm leading-relaxed text-muted-foreground">
                        {s.notes}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing logged against this asset.</p>
            )}
          </DetailPanel>
        </div>

        <div className="flex flex-col gap-4">
          <DetailPanel title="Asset" description="Identification and placement.">
            <dl className="flex flex-col gap-2.5 text-sm">
              {[
                ['Asset tag', asset.assetTag],
                ['Make', asset.make],
                ['Model', asset.model],
                ['Location', LOCATION_LABELS[asset.location]],
                ['Zone', asset.zone],
                ['Quantity', String(asset.quantity)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </DetailPanel>

          <DetailPanel title="Lifecycle" description="Cost and depreciation.">
            <dl className="flex flex-col gap-2.5 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Purchased</dt>
                <dd>{dateStamp(asset.purchaseDate)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Unit cost</dt>
                <dd className="tabular-nums">{money(asset.unitCost)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Useful life</dt>
                <dd className="tabular-nums">{asset.usefulLifeMonths} months</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Book value</dt>
                <dd className="tabular-nums">{money(bookValueAmount)}</dd>
              </div>
            </dl>
          </DetailPanel>

          <DetailPanel title="Servicing" description="Routine maintenance cadence.">
            <dl className="flex flex-col gap-2.5 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Interval</dt>
                <dd className="tabular-nums">{asset.serviceIntervalDays} days</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Last service</dt>
                <dd>{asset.lastServiceDate ? dateStamp(asset.lastServiceDate) : 'Never'}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <CalendarClock className="size-3.5" aria-hidden="true" />
                  Next due
                </dt>
                <dd className={cn(overdue && serviceRelevant && 'font-medium text-destructive')}>
                  {serviceRelevant && nextService ? dateStamp(nextService) : '—'}
                </dd>
              </div>
            </dl>
            {asset.notes ? (
              <p className="mt-4 border-t border-border pt-3 text-sm leading-relaxed text-muted-foreground">
                {asset.notes}
              </p>
            ) : null}
          </DetailPanel>
        </div>
      </div>
    </DetailShell>
  )
}
