'use client'

import * as React from 'react'
import Link from 'next/link'
import { PageHeader, PageBody } from '@/components/shell/page-header'
import { RequireScreen } from '@/components/shell/app-shell'
import { Card, CardHeader, KpiTile, CapacityBar } from '@/components/ui/card'
import { StatusChip } from '@/components/ui/status-chip'
import { CellStack, Table, TableWrap, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table'
import { compactMoney, fullDate, num, percent } from '@/lib/format'
import { trainerLoads } from './trainers-data'

/**
 * Trainer roster. Fill rate says whether their classes sell; client retention
 * says whether the members assigned to them stay. Both, or the number lies.
 */
export function TrainerRoster() {
  const active = trainerLoads.filter((l) => l.trainer.active)
  const seats = active.reduce((s, l) => s + l.seats, 0)
  const booked = active.reduce((s, l) => s + l.booked, 0)
  const hours = active.reduce((s, l) => s + l.hours, 0)

  return (
    <RequireScreen screen="trainers">
      <PageHeader
        title="Trainers"
        crumbs={[{ label: 'FlexFit Studio', href: '/dashboard' }, { label: 'Trainers' }]}
        meta={
          <>
            <span className="tnum">{num(active.length)} active</span>
            <span aria-hidden>·</span>
            <span className="tnum">{hours.toFixed(1)} contact hours / week</span>
            <span aria-hidden>·</span>
            <span className="tnum">{percent((booked / Math.max(1, seats)) * 100)} of seats booked</span>
          </>
        }
        sticky={false}
      />

      <PageBody>
        <Card className="grid grid-cols-2 lg:grid-cols-4">
          <KpiTile label="Active trainers" value={num(active.length)} footnote={`${num(trainerLoads.length - active.length)} departed on record`} />
          <KpiTile label="Weekly hours" value={hours.toFixed(1)} footnote="Scheduled class time" />
          <KpiTile label="Seat fill" value={percent((booked / Math.max(1, seats)) * 100)} footnote={`${num(booked)} of ${num(seats)} seats`} />
          <KpiTile
            label="Members assigned"
            value={num(active.reduce((s, l) => s + l.clients.length, 0))}
            footnote={`${num(active.reduce((s, l) => s + l.atRiskClients, 0))} of them high risk`}
          />
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Roster"
            description="Departed trainers stay listed — their classes and clients still had to go somewhere."
          />
          <TableWrap>
            <Table>
              <Thead>
                <tr>
                  <Th>Trainer</Th>
                  <Th width={170}>Specialties</Th>
                  <Th align="right" width={90}>Classes</Th>
                  <Th align="right" width={90}>Hours</Th>
                  <Th width={170}>Seat fill</Th>
                  <Th align="right" width={100}>Clients</Th>
                  <Th align="right" width={110}>Low risk</Th>
                  <Th align="right" width={120}>Client value</Th>
                  <Th width={120}>Status</Th>
                </tr>
              </Thead>
              <Tbody>
                {trainerLoads.map((load) => (
                  <Tr key={load.trainer.id}>
                    <Td>
                      <CellStack
                        primary={
                          <Link href={`/trainers/${load.trainer.id}`} className="hover:text-primary hover:underline">
                            {load.trainer.name}
                          </Link>
                        }
                        secondary={load.trainer.email}
                      />
                    </Td>
                    <Td muted>{load.trainer.specialties.join(', ')}</Td>
                    <Td align="right" className="tnum">{num(load.classes.length)}</Td>
                    <Td align="right" className="tnum">{load.hours.toFixed(1)}</Td>
                    <Td>
                      <CapacityBar filled={load.booked} capacity={load.seats} showLabel />
                    </Td>
                    <Td align="right" className="tnum">{num(load.clients.length)}</Td>
                    <Td align="right" className="tnum">
                      {load.clients.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        percent(load.clientRetention)
                      )}
                    </Td>
                    <Td align="right" className="tnum">{compactMoney(load.monthlyValue)}</Td>
                    <Td>
                      {load.trainer.active ? (
                        <StatusChip tone="good" label="Active" />
                      ) : (
                        <StatusChip
                          tone="neutral"
                          label={`Left ${fullDate(load.trainer.activeTo as string)}`}
                          title="Departure drives the March attendance step-down"
                        />
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableWrap>
        </Card>
      </PageBody>
    </RequireScreen>
  )
}
