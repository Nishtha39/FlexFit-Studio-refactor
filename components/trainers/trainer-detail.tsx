'use client'

import * as React from 'react'
import Link from 'next/link'
import { CalendarDays, Mail, Phone } from 'lucide-react'
import { PageHeader, PageBody } from '@/components/shell/page-header'
import { RequireScreen } from '@/components/shell/app-shell'
import { Card, CardBody, CardHeader, CardFooter, DataPoint, CapacityBar } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MemberStatus, RiskScore, StatusChip } from '@/components/ui/status-chip'
import { EmptyState } from '@/components/ui/empty-state'
import { CellStack, Table, TableWrap, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table'
import { compactMoney, daysAgo, fullDate, money, num, percent } from '@/lib/format'
import { locationById } from '@/lib/data'
import { WEEKDAY_LABELS_FULL } from '@/lib/seed'
import type { TrainerLoad } from './trainers-data'
import { payroll, weeklySlots } from './trainers-data'

/** One trainer: what they teach, who they are responsible for, what they cost. */
export function TrainerDetail({ load }: { load: TrainerLoad }) {
  const slots = React.useMemo(() => weeklySlots(load), [load])
  const lines = React.useMemo(() => payroll(load), [load])
  const trainer = load.trainer

  return (
    <RequireScreen screen="trainers">
      <PageHeader
        title={trainer.name}
        crumbs={[
          { label: 'FlexFit Studio', href: '/dashboard' },
          { label: 'Trainers', href: '/trainers' },
          { label: trainer.name },
        ]}
        meta={
          <>
            <span>{trainer.specialties.join(' · ')}</span>
            <span aria-hidden>·</span>
            <span>{trainer.locations.map((id) => locationById.get(id)?.shortName ?? id).join(', ')}</span>
            <span aria-hidden>·</span>
            <span className="tnum">Since {fullDate(trainer.activeFrom)}</span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" size="sm">
              <Phone />
              Call
            </Button>
            <Button variant="secondary" size="sm">
              <Mail />
              Email
            </Button>
            <Button variant="primary" size="sm">
              <CalendarDays />
              Assign a class
            </Button>
          </>
        }
        sticky={false}
      />

      <PageBody>
        {!trainer.active ? (
          <div className="rounded-md border border-border bg-muted px-4 py-3">
            <p className="text-sm font-medium text-foreground">
              Left the studio on {fullDate(trainer.activeTo as string)}
            </p>
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">
              Kept on the roster because the record matters: their departure is the step-down visible
              in attendance from March 2025 onward, and {num(load.clients.length)} members still list
              them as their assigned trainer.
            </p>
          </div>
        ) : null}

        <Card className="grid grid-cols-2 lg:grid-cols-4">
          <DataPoint className="border-r border-border px-4 py-3" label="Weekly classes" value={num(load.classes.length)} sub={`${load.hours.toFixed(1)} contact hours`} />
          <DataPoint className="border-r border-border px-4 py-3" label="Seat fill" value={percent(load.fillRate)} sub={`${num(load.booked)} of ${num(load.seats)} seats`} />
          <DataPoint className="border-r border-border px-4 py-3" label="On waitlists" value={num(load.waitlisted)} sub="Demand above capacity" />
          <DataPoint className="px-4 py-3" label="Client value" value={compactMoney(load.monthlyValue)} sub={`${num(load.clients.length)} assigned members`} />
        </Card>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
          <Card className="overflow-hidden">
            <CardHeader
              title="Weekly schedule"
              description="Recurring classes. Changing one asks about the series."
              actions={
                <Link
                  href="/schedule"
                  className="text-micro font-medium text-primary underline-offset-2 hover:underline"
                >
                  Open schedule
                </Link>
              }
            />
            {slots.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No classes on the current schedule"
                  description="Assign a class from the schedule screen to put this trainer back on the floor."
                />
              </div>
            ) : (
              <div className="divide-y divide-border">
                {slots.map((row) => (
                  <div key={row.day} className="flex gap-4 px-4 py-3">
                    <p className="w-24 shrink-0 text-micro font-medium tracking-wide text-muted-foreground uppercase">
                      {WEEKDAY_LABELS_FULL[row.index]}
                    </p>
                    <ul className="flex min-w-0 flex-1 flex-col gap-2">
                      {row.slots.map((cls) => (
                        <li key={cls.id} className="flex flex-wrap items-center gap-3">
                          <span className="w-16 shrink-0 text-sm text-foreground tnum">{cls.startTime}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">{cls.name}</span>
                            <span className="block text-micro text-muted-foreground">
                              {cls.type} · {cls.durationMin} min · {locationById.get(cls.location)?.shortName}
                            </span>
                          </span>
                          <span className="w-40 shrink-0">
                            <CapacityBar filled={cls.roster.length} capacity={cls.capacity} showLabel />
                          </span>
                          {cls.waitlist.length > 0 ? (
                            <StatusChip tone="info" label={`${cls.waitlist.length} waiting`} />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Cost" description="Derived from scheduled hours and check-ins." />
            <CardBody className="flex flex-col gap-3">
              {lines.map((line, i) => (
                <div
                  key={line.label}
                  className={i === lines.length - 1 ? 'border-t border-border pt-3' : undefined}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={i === lines.length - 1 ? 'text-sm font-semibold text-foreground' : 'text-sm text-foreground'}>
                      {line.label}
                    </span>
                    <span className="text-sm font-medium text-foreground tnum">{money(line.amount)}</span>
                  </div>
                  <p className="text-micro text-muted-foreground">{line.detail}</p>
                </div>
              ))}
            </CardBody>
            <CardFooter>
              <span>Payroll is illustrative — no payroll provider is connected.</span>
            </CardFooter>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHeader
            title="Assigned members"
            description={`${num(load.clients.length)} members · ${num(load.atRiskClients)} in the high-risk band`}
            actions={
              <Link
                href="/retention"
                className="text-micro font-medium text-primary underline-offset-2 hover:underline"
              >
                Retention queue
              </Link>
            }
          />
          {load.clients.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Nobody assigned" description="Assign members from a member profile." />
            </div>
          ) : (
            <TableWrap className="max-h-96">
              <Table>
                <Thead>
                  <tr>
                    <Th>Member</Th>
                    <Th width={130}>Status</Th>
                    <Th align="right" width={110}>Visits / 30d</Th>
                    <Th width={130}>Last visit</Th>
                    <Th width={120}>Risk</Th>
                    <Th align="right" width={120}>Monthly</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {[...load.clients]
                    .sort((a, b) => b.risk.score - a.risk.score)
                    .map((member) => (
                      <Tr key={member.id}>
                        <Td>
                          <CellStack
                            primary={
                              <Link href={`/members/${member.id}`} className="hover:text-primary hover:underline">
                                {member.name}
                              </Link>
                            }
                            secondary={member.email}
                          />
                        </Td>
                        <Td><MemberStatus status={member.status} /></Td>
                        <Td align="right" className="tnum">{num(member.metrics.visitsLast30)}</Td>
                        <Td muted className="tnum">
                          {member.metrics.lastVisit ? daysAgo(member.metrics.lastVisit) : 'never'}
                        </Td>
                        <Td><RiskScore score={member.risk.score} /></Td>
                        <Td align="right" className="tnum">{money(member.metrics.monthlyValue)}</Td>
                      </Tr>
                    ))}
                </Tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      </PageBody>
    </RequireScreen>
  )
}
