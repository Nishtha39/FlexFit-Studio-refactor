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
import { CallLink, ComposeEmailDialog } from '@/components/comms/compose-email-dialog'
import { api } from '@/lib/api/client'
import { useStudio } from '@/lib/store/studio-store'
import { compactMoney, daysAgo, fullDate, money, num, percent } from '@/lib/format'
import { locationById } from '@/lib/data'
import { WEEKDAY_LABELS_FULL } from '@/lib/seed'
import type { TrainerLoad } from './trainers-data'
import { payroll, weeklySlots } from './trainers-data'
import { AssignClassDialog } from './assign-class-dialog'

/** One trainer: what they teach, who they are responsible for, what they cost. */
export function TrainerDetail({ load }: { load: TrainerLoad }) {
  const { connection } = useStudio()
  const slots = React.useMemo(() => weeklySlots(load), [load])
  const lines = React.useMemo(() => payroll(load), [load])
  const trainer = load.trainer
  const [emailOpen, setEmailOpen] = React.useState(false)
  const [assignOpen, setAssignOpen] = React.useState(false)

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
            <CallLink phone={trainer.phone} className="h-7 px-2.5 text-sm">
              <Phone className="size-3.5" />
              Call
            </CallLink>
            <Button variant="secondary" size="sm" onClick={() => setEmailOpen(true)}>
              <Mail />
              Email
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!trainer.active || connection !== 'live'}
              title={trainer.active ? undefined : `${trainer.firstName} has left — classes cannot be assigned to them.`}
              onClick={() => setAssignOpen(true)}
            >
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
                    <SerialTh />
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
                    .map((member, i) => (
                      <Tr key={member.id}>
                        <SerialTd index={i} />
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

      <ComposeEmailDialog
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        to={trainer.email}
        toName={trainer.name}
        title={`Email ${trainer.name}`}
        send={({ subject, body }) =>
          api.comms.emailStaff.mutate({ staffId: trainer.id, subject, body })
        }
        templates={[
          {
            label: 'Cover request',
            subject: 'Can you cover a class this week?',
            body: `Hi ${trainer.firstName},\n\nWe need cover for a class this week and you are free in that slot. Could you take it?\n\nLet me know either way and I will confirm with the members booked in.\n\nThanks,\nFlexFit Studio`,
          },
          {
            label: 'Client check-in',
            subject: `Your clients — ${load.atRiskClients} to look at`,
            body: `Hi ${trainer.firstName},\n\n${load.atRiskClients} of your ${load.clients.length} clients are showing high churn risk — they have stopped coming as often as they were.\n\nCould you have a look through your list this week and reach out to the ones you know best? A message from their own trainer lands very differently from one from the desk.\n\nThanks,\nFlexFit Studio`,
          },
          {
            label: 'Blank',
            subject: '',
            body: `Hi ${trainer.firstName},\n\n\n\nFlexFit Studio`,
          },
        ]}
      />

      <AssignClassDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        trainer={trainer}
      />
    </RequireScreen>
  )
}
