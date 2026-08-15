'use client'

import * as React from 'react'
import { AlertTriangle, CalendarClock, Plus, Wrench } from 'lucide-react'
import { PageBody, PageHeader } from '@/components/shell/page-header'
import { RequireScreen } from '@/components/shell/app-shell'
import { useApp } from '@/components/shell/role-context'
import { useStudio } from '@/lib/store/studio-store'
import { api } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, KpiTile } from '@/components/ui/card'
import { StatusChip } from '@/components/ui/status-chip'
import { ViewToggle } from '@/components/ui/tabs'
import { EmptyState } from '@/components/ui/empty-state'
import {
  CellStack,
  SerialTd,
  SerialTh,
  Table,
  TableWrap,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@/components/ui/table'
import { compactMoney, fullDate, money, num, percent } from '@/lib/format'
import { equipment, EQUIPMENT_CATEGORY_LABELS } from '@/lib/data/equipment'
import { members } from '@/lib/data/members'
import { staff } from '@/lib/data/staff'
import { locations } from '@/lib/data'
import { isoDate, NOW } from '@/lib/seed'
import type { Equipment, EquipmentFault, LocationId } from '@/lib/types'
import {
  EQUIPMENT_CATEGORIES,
  STATUS_META,
  SEVERITY_META,
  isAvailable,
  isOnFloor,
  isServiceOverdue,
  memberName,
  openFaultsFor,
  serviceQueue,
  summarize,
  toRow,
  upcomingReservations,
  utilizationTrailing,
} from './equipment-data'
import {
  EquipmentFormDialog,
  LogServiceDialog,
  ReportFaultDialog,
  ReserveDialog,
  ResolveFaultDialog,
} from './equipment-dialogs'

/**
 * One screen, three readings of it.
 *
 * The owner needs the asset register: what it is worth, what it costs to run,
 * what is overdue. The trainer needs to know what is on their floor and needs a
 * one-tap way to report the thing they just found broken. The member needs to
 * know what is working and to book the sauna. They are the same data answering
 * three different questions, so this is one route with three bodies rather than
 * three near-identical screens that drift apart.
 */
export function EquipmentView() {
  const { role } = useApp()
  // Reading the version subscribes this tree to hydration: the data modules are
  // swapped in place, so without it React would never learn a write landed.
  const { version } = useStudio()

  return (
    <RequireScreen screen="equipment">
      <div key={version}>
        {role === 'member' ? <MemberEquipment /> : role === 'trainer' ? <TrainerEquipment /> : <OwnerEquipment />}
      </div>
    </RequireScreen>
  )
}

/* -------------------------------------------------------------------------- */
/*  Owner — the asset register                                                */
/* -------------------------------------------------------------------------- */

type StatusFilter = 'all' | 'attention' | 'in-service' | 'out-of-service' | 'retired'

function OwnerEquipment() {
  const { location } = useApp()
  const { mutate, busy } = useStudio()
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [category, setCategory] = React.useState<'all' | Equipment['category']>('all')
  const [formFor, setFormFor] = React.useState<{ open: boolean; asset?: Equipment }>({ open: false })
  const [serviceFor, setServiceFor] = React.useState<Equipment | undefined>()
  const [resolveFault, setResolveFault] = React.useState<{ fault: EquipmentFault; name: string } | undefined>()

  // The location switcher in the top bar uses its own ids ('riverside',
  // 'northgate', 'harbour'); the data uses LocationId. Only the ones that match
  // filter — anything else falls back to showing everything rather than an
  // empty screen that looks like a bug.
  const scoped = React.useMemo(() => {
    const ids = new Set(locations.map((l) => l.id as string))
    return ids.has(location.id) ? equipment.filter((e) => e.location === location.id) : equipment
  }, [location.id])

  const estate = React.useMemo(() => summarize(scoped), [scoped])
  const queue = React.useMemo(() => serviceQueue().filter((r) => scoped.includes(r.equipment)), [scoped])

  const rows = React.useMemo(() => {
    return scoped
      .filter((e) => {
        if (category !== 'all' && e.category !== category) return false
        if (statusFilter === 'all') return true
        if (statusFilter === 'attention') return isServiceOverdue(e) || openFaultsFor(e.id).length > 0
        if (statusFilter === 'in-service') return e.status === 'in-service'
        return e.status === statusFilter
      })
      .map(toRow)
      .sort((a, b) => b.overdueDays - a.overdueDays || a.equipment.name.localeCompare(b.equipment.name))
  }, [scoped, statusFilter, category])

  async function setStatus(asset: Equipment, status: Equipment['status']) {
    await mutate(() => api.equipment.setStatus.mutate({ id: asset.id, status }), {
      success: (r) => ({
        title: `${asset.name} — ${STATUS_META[status].label.toLowerCase()}`,
        detail:
          r.cancelledReservations > 0
            ? `${r.cancelledReservations} upcoming reservation${r.cancelledReservations === 1 ? '' : 's'} cancelled.`
            : STATUS_META[status].description,
      }),
    })
  }

  return (
    <>
      <PageHeader
        title="Equipment"
        crumbs={[{ label: 'FlexFit Studio', href: '/dashboard' }, { label: 'Equipment' }]}
        meta={
          <>
            <span className="tnum">{num(estate.assets)} assets</span>
            <span aria-hidden>·</span>
            <span className="tnum">{num(estate.units)} units on the floor</span>
            <span aria-hidden>·</span>
            <span className="tnum">{compactMoney(estate.bookValue)} book value</span>
          </>
        }
        actions={
          <Button variant="primary" size="sm" onClick={() => setFormFor({ open: true })}>
            <Plus className="size-3.5" />
            <span className="hidden sm:inline">Add equipment</span>
          </Button>
        }
        sticky={false}
      />

      <PageBody>
        <Card className="grid grid-cols-2 lg:grid-cols-5">
          <KpiTile
            label="Book value"
            value={compactMoney(estate.bookValue)}
            footnote={`${compactMoney(estate.replacementCost)} to replace new`}
          />
          <KpiTile
            label="Maintenance · 12mo"
            value={compactMoney(estate.maintenance12m)}
            footnote="Excludes purchase cost"
          />
          <KpiTile
            label="Service overdue"
            value={num(estate.overdue)}
            footnote={`of ${num(estate.onFloor)} assets on the floor`}
          />
          <KpiTile
            label="Off the floor"
            value={num(estate.down)}
            footnote={`${num(estate.unsafeFaults)} unsafe fault${estate.unsafeFaults === 1 ? '' : 's'} open`}
          />
          <KpiTile
            label="Bookable use"
            value={percent(estate.avgUtilization)}
            footnote={`${num(estate.bookableAssets)} reservable assets · 14-day mean`}
          />
        </Card>

        {queue.length > 0 ? (
          <Card className="overflow-hidden">
            <CardHeader
              title="Needs attention"
              description="Overdue services and open faults, worst first. An unsafe fault takes the asset off the floor on its own."
            />
            <TableWrap>
              <Table>
                <Thead>
                  <tr>
                    <SerialTh />
                    <Th>Asset</Th>
                    <Th width={150}>Issue</Th>
                    <Th width={130}>Reported by</Th>
                    <Th align="right" width={110}>Overdue</Th>
                    <Th width={190}>Action</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {queue.map((row, i) => {
                    const fault = row.openFaults[0]
                    return (
                      <Tr key={row.equipment.id}>
                        <SerialTd index={i} />
                        <Td>
                          <CellStack
                            primary={row.equipment.name}
                            secondary={`${row.equipment.assetTag} · ${row.locationName} · ${row.equipment.zone}`}
                          />
                        </Td>
                        <Td>
                          {fault ? (
                            <span className="flex items-center gap-1.5">
                              <StatusChip
                                tone={SEVERITY_META[fault.severity].tone}
                                label={SEVERITY_META[fault.severity].label}
                              />
                              <span className="truncate text-micro text-muted-foreground">{fault.summary}</span>
                            </span>
                          ) : (
                            <StatusChip tone="warn" label="Service due" />
                          )}
                        </Td>
                        <Td muted className="text-micro">
                          {fault ? fault.reporterName : '—'}
                        </Td>
                        <Td align="right" className="tnum">
                          {row.overdueDays > 0 ? (
                            <span className="text-danger">{row.overdueDays}d</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </Td>
                        <Td>
                          <span className="flex gap-1">
                            <Button size="xs" variant="secondary" onClick={() => setServiceFor(row.equipment)}>
                              <Wrench className="size-3" />
                              Log service
                            </Button>
                            {fault ? (
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => setResolveFault({ fault, name: row.equipment.name })}
                              >
                                Resolve
                              </Button>
                            ) : null}
                          </span>
                        </Td>
                      </Tr>
                    )
                  })}
                </Tbody>
              </Table>
            </TableWrap>
          </Card>
        ) : null}

        <Card className="overflow-hidden">
          <CardHeader
            title="Asset register"
            description="Book value is straight-line depreciation over each asset's useful life, with no residual."
            actions={
              <ViewToggle
                value={statusFilter}
                onChange={(id) => setStatusFilter(id as StatusFilter)}
                items={(['all', 'attention', 'in-service', 'out-of-service', 'retired'] as StatusFilter[]).map(
                  (s) => ({
                    id: s,
                    label:
                      s === 'all'
                        ? 'All'
                        : s === 'attention'
                          ? 'Attention'
                          : STATUS_META[s as Equipment['status']].label,
                  }),
                )}
              />
            }
          />
          <div className="flex flex-wrap gap-1 border-b border-border px-4 py-2">
            <ViewToggle
              value={category}
              onChange={(id) => setCategory(id as typeof category)}
              items={[
                { id: 'all', label: 'All' },
                ...EQUIPMENT_CATEGORIES.map((c) => ({ id: c, label: EQUIPMENT_CATEGORY_LABELS[c] })),
              ]}
            />
          </div>

          {rows.length === 0 ? (
            <EmptyState
              title="Nothing matches those filters"
              description="Clear the status or category filter to see the rest of the register."
            />
          ) : (
            <TableWrap>
              <Table>
                <Thead>
                  <tr>
                    <SerialTh />
                    <Th>Asset</Th>
                    <Th width={110}>Category</Th>
                    <Th align="right" width={70}>Units</Th>
                    <Th width={130}>Status</Th>
                    <Th width={120}>Next service</Th>
                    <Th align="right" width={110}>Book value</Th>
                    <Th align="right" width={120}>Run cost / mo</Th>
                    <Th align="right" width={90}>Use</Th>
                    <Th width={180}>Actions</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {rows.map((row, i) => (
                    <Tr key={row.equipment.id}>
                      <SerialTd index={i} />
                      <Td>
                        <CellStack
                          primary={row.equipment.name}
                          secondary={`${row.equipment.assetTag} · ${row.equipment.make} ${row.equipment.model} · ${row.locationName} / ${row.equipment.zone}`}
                        />
                      </Td>
                      <Td muted>{EQUIPMENT_CATEGORY_LABELS[row.equipment.category]}</Td>
                      <Td align="right" className="tnum">
                        {num(row.equipment.quantity)}
                      </Td>
                      <Td>
                        <span className="flex flex-wrap items-center gap-1">
                          <StatusChip
                            tone={STATUS_META[row.equipment.status].tone}
                            label={STATUS_META[row.equipment.status].label}
                          />
                          {row.openFaults.length > 0 ? (
                            <span className="text-micro text-muted-foreground tnum">
                              {row.openFaults.length} fault{row.openFaults.length === 1 ? '' : 's'}
                            </span>
                          ) : null}
                        </span>
                      </Td>
                      <Td className="tnum">
                        {row.overdueDays > 0 ? (
                          <span className="text-danger">{row.overdueDays}d overdue</span>
                        ) : (
                          <span className="text-muted-foreground">{fullDate(row.nextService)}</span>
                        )}
                      </Td>
                      <Td align="right" className="tnum">
                        {compactMoney(row.bookValue)}
                      </Td>
                      <Td align="right" className="tnum">
                        {row.monthlyRunningCost > 0 ? money(row.monthlyRunningCost) : '—'}
                      </Td>
                      <Td align="right" className="tnum">
                        {row.equipment.bookable ? (
                          percent(row.utilization)
                        ) : (
                          <span className="text-muted-foreground">walk-up</span>
                        )}
                      </Td>
                      <Td>
                        <span className="flex gap-1">
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => setFormFor({ open: true, asset: row.equipment })}
                          >
                            Edit
                          </Button>
                          {row.equipment.status === 'out-of-service' ? (
                            <Button
                              size="xs"
                              variant="secondary"
                              disabled={busy || row.openFaults.some((f) => f.severity === 'unsafe')}
                              title={
                                row.openFaults.some((f) => f.severity === 'unsafe')
                                  ? 'Resolve the unsafe fault first — it is what took this off the floor.'
                                  : undefined
                              }
                              onClick={() => setStatus(row.equipment, 'in-service')}
                            >
                              Return to floor
                            </Button>
                          ) : row.equipment.status !== 'retired' ? (
                            <Button
                              size="xs"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => setStatus(row.equipment, 'out-of-service')}
                            >
                              Take off floor
                            </Button>
                          ) : null}
                        </span>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      </PageBody>

      <EquipmentFormDialog
        open={formFor.open}
        asset={formFor.asset}
        onClose={() => setFormFor({ open: false })}
      />
      <LogServiceDialog open={Boolean(serviceFor)} asset={serviceFor} onClose={() => setServiceFor(undefined)} />
      <ResolveFaultDialog
        open={Boolean(resolveFault)}
        fault={resolveFault?.fault}
        assetName={resolveFault?.name ?? ''}
        onClose={() => setResolveFault(undefined)}
      />
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*  Trainer — what is on my floor, and reporting what I just found broken     */
/* -------------------------------------------------------------------------- */

function TrainerEquipment() {
  const { roleMeta } = useApp()
  const [reportFor, setReportFor] = React.useState<Equipment | undefined>()

  // The role switcher names the person; match them to a real staff row so the
  // fault log records who filed it rather than "trainer".
  const me = React.useMemo(
    () => staff.find((s) => s.name === roleMeta.person) ?? staff.find((s) => s.role === 'trainer'),
    [roleMeta.person],
  )
  const myLocations = React.useMemo(() => new Set(me?.locations ?? []), [me])

  const mine = React.useMemo(
    () =>
      equipment
        .filter((e) => isOnFloor(e) && (myLocations.size === 0 || myLocations.has(e.location)))
        .sort((a, b) => a.zone.localeCompare(b.zone) || a.name.localeCompare(b.name)),
    [myLocations],
  )

  const down = mine.filter((e) => e.status === 'out-of-service')
  const flagged = mine.filter((e) => e.status === 'needs-service')

  const byZone = React.useMemo(() => {
    const map = new Map<string, Equipment[]>()
    for (const e of mine) {
      const list = map.get(e.zone) ?? []
      list.push(e)
      map.set(e.zone, list)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [mine])

  return (
    <>
      <PageHeader
        title="Equipment"
        crumbs={[{ label: 'FlexFit Studio', href: '/my-schedule' }, { label: 'Equipment' }]}
        meta={
          <>
            <span>{me?.name ?? 'Trainer'}</span>
            <span aria-hidden>·</span>
            <span className="tnum">{num(mine.length)} assets on your floor</span>
            {down.length > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span className="tnum text-danger">{num(down.length)} out of service</span>
              </>
            ) : null}
          </>
        }
        sticky={false}
      />

      <PageBody>
        {down.length > 0 || flagged.length > 0 ? (
          <Card>
            <CardHeader
              title="Do not use / watch"
              description="Tell members before they walk over. Anything unsafe is already off the floor."
            />
            <div className="divide-y divide-border">
              {[...down, ...flagged].map((e) => {
                const faults = openFaultsFor(e.id)
                return (
                  <div key={e.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                    <StatusChip tone={STATUS_META[e.status].tone} label={STATUS_META[e.status].label} />
                    <span className="text-sm font-medium text-foreground">{e.name}</span>
                    <span className="text-micro text-muted-foreground">
                      {e.assetTag} · {e.zone}
                    </span>
                    {faults[0] ? (
                      <span className="text-micro text-muted-foreground">— {faults[0].summary}</span>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </Card>
        ) : null}

        {byZone.map(([zone, assets]) => (
          <Card key={zone} className="overflow-hidden">
            <CardHeader title={zone} description={`${assets.length} assets`} />
            <TableWrap>
              <Table>
                <Thead>
                  <tr>
                    <SerialTh />
                    <Th>Asset</Th>
                    <Th align="right" width={70}>Units</Th>
                    <Th width={130}>Status</Th>
                    <Th width={140}>Report</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {assets.map((e, i) => (
                    <Tr key={e.id}>
                      <SerialTd index={i} />
                      <Td>
                        <CellStack primary={e.name} secondary={`${e.assetTag} · ${e.make} ${e.model}`} />
                      </Td>
                      <Td align="right" className="tnum">
                        {num(e.quantity)}
                      </Td>
                      <Td>
                        <StatusChip tone={STATUS_META[e.status].tone} label={STATUS_META[e.status].label} />
                      </Td>
                      <Td>
                        <Button size="xs" variant="secondary" onClick={() => setReportFor(e)}>
                          <AlertTriangle className="size-3" />
                          Report fault
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableWrap>
          </Card>
        ))}
      </PageBody>

      <ReportFaultDialog
        open={Boolean(reportFor)}
        asset={reportFor}
        onClose={() => setReportFor(undefined)}
        reporterId={me?.id ?? 'staff-t1'}
        reporterLabel={me?.name ?? 'Trainer'}
      />
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*  Member — what is working, and booking the reservable kit                  */
/* -------------------------------------------------------------------------- */

function MemberEquipment() {
  const { roleMeta } = useApp()
  const { mutate, busy } = useStudio()
  const [reserveFor, setReserveFor] = React.useState<Equipment | undefined>()
  const [reportFor, setReportFor] = React.useState<Equipment | undefined>()

  const me = React.useMemo(
    () => members.find((m) => m.name === roleMeta.person) ?? members.find((m) => m.status === 'active')!,
    [roleMeta.person],
  )

  const atMyGym = React.useMemo(
    () => equipment.filter((e) => e.location === me.homeLocation && isOnFloor(e)),
    [me.homeLocation],
  )
  const bookable = atMyGym.filter((e) => e.bookable && isAvailable(e))
  const down = atMyGym.filter((e) => e.status === 'out-of-service')
  const mine = React.useMemo(() => upcomingReservations(me.id), [me.id])
  const homeName = locations.find((l) => l.id === me.homeLocation)?.shortName ?? me.homeLocation

  async function cancel(reservationId: string, label: string) {
    await mutate(() => api.equipment.cancelReservation.mutate({ reservationId }), {
      success: () => ({ title: 'Reservation cancelled', detail: label }),
    })
  }

  return (
    <>
      <PageHeader
        title="Equipment"
        crumbs={[{ label: 'FlexFit Studio', href: '/portal' }, { label: 'Equipment' }]}
        meta={
          <>
            <span>{homeName}</span>
            <span aria-hidden>·</span>
            <span className="tnum">{num(atMyGym.length)} assets</span>
            <span aria-hidden>·</span>
            <span className="tnum">{num(mine.length)} upcoming booking{mine.length === 1 ? '' : 's'}</span>
          </>
        }
        sticky={false}
      />

      <PageBody>
        <Card className="overflow-hidden">
          <CardHeader
            title="Your bookings"
            description={`Reservations you hold at ${homeName}.`}
          />
          {mine.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Nothing booked yet"
              description="Reserve a court, reformer or the sauna below — everything else is walk-up."
            />
          ) : (
            <TableWrap>
              <Table>
                <Thead>
                  <tr>
                    <SerialTh />
                    <Th>What</Th>
                    <Th width={130}>Date</Th>
                    <Th width={110}>Time</Th>
                    <Th width={110}>Length</Th>
                    <Th width={100} />
                  </tr>
                </Thead>
                <Tbody>
                  {mine.map((r, i) => {
                    const asset = atMyGym.find((e) => e.id === r.equipmentId)
                    return (
                      <Tr key={r.id}>
                        <SerialTd index={i} />
                        <Td>
                          <CellStack primary={asset?.name ?? r.equipmentId} secondary={asset?.zone} />
                        </Td>
                        <Td className="tnum">{fullDate(r.date)}</Td>
                        <Td className="tnum">{r.startTime}</Td>
                        <Td className="tnum" muted>
                          {r.durationMin} min
                        </Td>
                        <Td>
                          <Button
                            size="xs"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => cancel(r.id, `${asset?.name ?? ''} · ${r.date} ${r.startTime}`)}
                          >
                            Cancel
                          </Button>
                        </Td>
                      </Tr>
                    )
                  })}
                </Tbody>
              </Table>
            </TableWrap>
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Reservable"
            description="Everything else in the gym is first come, first served."
          />
          <TableWrap>
            <Table>
              <Thead>
                <tr>
                  <SerialTh />
                  <Th>What</Th>
                  <Th width={140}>Where</Th>
                  <Th align="right" width={80}>Units</Th>
                  <Th width={110}>Slot</Th>
                  <Th width={120}>Status</Th>
                  <Th width={110} />
                </tr>
              </Thead>
              <Tbody>
                {bookable.map((e, i) => (
                  <Tr key={e.id}>
                    <SerialTd index={i} />
                    <Td>
                      <CellStack primary={e.name} secondary={`${e.make} ${e.model}`} />
                    </Td>
                    <Td muted>{e.zone}</Td>
                    <Td align="right" className="tnum">
                      {num(e.quantity)}
                    </Td>
                    <Td className="tnum" muted>
                      {e.slotMinutes} min
                    </Td>
                    <Td>
                      <StatusChip tone={STATUS_META[e.status].tone} label={STATUS_META[e.status].label} />
                    </Td>
                    <Td>
                      <Button size="xs" variant="primary" onClick={() => setReserveFor(e)}>
                        Reserve
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableWrap>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="On the floor"
            description="Anything out of service is being fixed — spot something wrong and you can report it."
          />
          <TableWrap>
            <Table>
              <Thead>
                <tr>
                  <SerialTh />
                  <Th>What</Th>
                  <Th width={150}>Where</Th>
                  <Th align="right" width={80}>Units</Th>
                  <Th width={130}>Status</Th>
                  <Th width={130} />
                </tr>
              </Thead>
              <Tbody>
                {atMyGym.map((e, i) => (
                  <Tr key={e.id}>
                    <SerialTd index={i} />
                    <Td>
                      <CellStack primary={e.name} secondary={EQUIPMENT_CATEGORY_LABELS[e.category]} />
                    </Td>
                    <Td muted>{e.zone}</Td>
                    <Td align="right" className="tnum">
                      {num(e.quantity)}
                    </Td>
                    <Td>
                      <StatusChip tone={STATUS_META[e.status].tone} label={STATUS_META[e.status].label} />
                    </Td>
                    <Td>
                      <Button size="xs" variant="ghost" onClick={() => setReportFor(e)}>
                        Report a problem
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableWrap>
          {down.length > 0 ? (
            <div className="border-t border-border bg-subtle px-4 py-2 text-micro text-muted-foreground">
              {num(down.length)} item{down.length === 1 ? ' is' : 's are'} out of service today.
            </div>
          ) : null}
        </Card>
      </PageBody>

      <ReserveDialog
        open={Boolean(reserveFor)}
        asset={reserveFor}
        onClose={() => setReserveFor(undefined)}
        memberId={me.id}
        memberName={me.name}
      />
      <ReportFaultDialog
        open={Boolean(reportFor)}
        asset={reportFor}
        onClose={() => setReportFor(undefined)}
        reporterId={me.id}
        reporterLabel={me.name}
      />
    </>
  )
}

// Referenced by the verification suite's import graph check; keeps the
// utilisation formula reachable from exactly one place.
export { utilizationTrailing, memberName }
export type { LocationId }
