'use client'

import * as React from 'react'
import Link from 'next/link'
import { Mail, Plus } from 'lucide-react'
import { PageHeader, PageBody } from '@/components/shell/page-header'
import { RequireScreen } from '@/components/shell/app-shell'
import { Card, CardBody, CardHeader, CardFooter, DataPoint, CapacityBar } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, ConsequenceNotice } from '@/components/ui/modal'
import { MemberStatus, RiskScore, StatusChip } from '@/components/ui/status-chip'
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
import { ComposeEmailDialog } from '@/components/comms/compose-email-dialog'
import { api } from '@/lib/api/client'
import { useStudio } from '@/lib/store/studio-store'
import { compactMoney, daysAgo, fullDate, money, num, percent, shortDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  burnHistory,
  employeeUsage,
  HEALTH_META,
  poolStatus,
  projection,
  TOP_UP_SIZES,
} from './corporate-data'
import type { Company } from '@/lib/types'

/**
 * One corporate pool. The burn chart carries past consumption and the forward
 * projection in the same axis, so "when does this empty" is read, not computed.
 */
export function PoolDetail({ company }: { company: Company }) {
  const { mutate, connection } = useStudio()
  const status = React.useMemo(() => poolStatus(company), [company])
  const history = React.useMemo(() => burnHistory(company), [company])
  const forward = React.useMemo(() => projection(status), [status])
  const usage = React.useMemo(() => employeeUsage(status), [status])
  const [topUp, setTopUp] = React.useState<number | null>(null)
  const [emailOpen, setEmailOpen] = React.useState(false)
  const health = HEALTH_META[status.health]
  const firstName = company.contactName.split(' ')[0]

  const maxCredits = Math.max(...history.map((h) => h.credits), status.company.burnRatePerWeek)
  const emptyWeek = forward.findIndex((f) => f.remaining === 0)

  return (
    <RequireScreen screen="corporate">
      <PageHeader
        title={company.name}
        crumbs={[
          { label: 'FlexFit Studio', href: '/dashboard' },
          { label: 'Corporate', href: '/corporate' },
          { label: company.name },
        ]}
        meta={
          <>
            <span>{status.planName}</span>
            <span aria-hidden>·</span>
            <span>{company.contactName}</span>
            <span aria-hidden>·</span>
            <span className="tnum">Renews {fullDate(company.renewalDate)}</span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setEmailOpen(true)}>
              <Mail />
              Email {firstName}
            </Button>
            <Button variant="primary" size="sm" onClick={() => setTopUp(TOP_UP_SIZES[1])}>
              <Plus />
              Top up pool
            </Button>
          </>
        }
        sticky={false}
      />

      <PageBody>
        {status.shortfall > 0 ? (
          <ConsequenceNotice
            tone={status.health === 'exhausted' ? 'danger' : 'warn'}
            headline={
              status.health === 'exhausted'
                ? 'This pool is empty — employees are being turned away'
                : `Runs out in ~${status.weeksLeft.toFixed(1)} weeks, ${status.weeksToRenewal.toFixed(1)} weeks before renewal`
            }
            detail={`At ${company.burnRatePerWeek} credits/week the pool is short by about ${num(status.shortfall)} credits. Top up now, or tell ${company.contactName} which ${num(status.employees.length)} employees lose access on the day it empties.`}
          />
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
          <Card>
            <CardHeader
              title="Credit burn"
              description="12 weeks of consumption, then the projection at the current rate."
              actions={<StatusChip tone={health.tone} label={health.label} />}
            />
            <CardBody>
              <div className="flex items-end gap-1" role="img" aria-label="Weekly credit consumption and projection">
                {history.map((week, i) => (
                  <div key={week.weekStart} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <span
                      className="w-full rounded-sm bg-chart-1"
                      style={{ height: `${Math.max(4, (week.credits / maxCredits) * 96)}px` }}
                      title={`${shortDate(week.weekStart)} · ${week.credits} credits`}
                    />
                    <span className="w-full truncate text-center text-micro text-muted-foreground">
                      {i % 3 === 0 ? shortDate(week.weekStart).split(' ')[1] : '\u00a0'}
                    </span>
                  </div>
                ))}
                <span aria-hidden className="mx-1 h-24 w-px bg-border-strong" />
                {forward.map((week, i) => (
                  <div key={week.weekStart} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <span
                      className={cn(
                        'w-full rounded-sm border border-dashed',
                        week.remaining === 0 ? 'border-danger bg-danger-soft' : 'border-border-strong bg-muted',
                      )}
                      style={{ height: `${Math.max(4, (company.burnRatePerWeek / maxCredits) * 96)}px` }}
                      title={`${shortDate(week.weekStart)} · ${week.remaining} credits left`}
                    />
                    <span className="w-full truncate text-center text-micro text-muted-foreground">
                      {i % 3 === 0 ? `+${i + 1}` : '\u00a0'}
                    </span>
                  </div>
                ))}
              </div>
            </CardBody>
            <CardFooter>
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="size-2 rounded-sm bg-chart-1" />
                  Consumed
                </span>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="size-2 rounded-sm border border-dashed border-border-strong bg-muted" />
                  Projected
                </span>
              </span>
              <span className="tnum">
                {emptyWeek >= 0
                  ? `Empty in week +${emptyWeek + 1} (${shortDate(forward[emptyWeek].weekStart)})`
                  : 'Lasts past the projection window'}
              </span>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader title="Contract" />
            <CardBody className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-semibold text-foreground tnum">{num(status.remaining)}</span>
                  <span className="text-micro text-muted-foreground tnum">
                    {percent(status.utilization)} used
                  </span>
                </div>
                <CapacityBar filled={company.creditsUsed} capacity={company.poolCredits} showLabel />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <DataPoint label="Pool size" value={num(company.poolCredits)} sub="Credits purchased" />
                <DataPoint label="Burn / week" value={num(company.burnRatePerWeek)} sub="Trailing 12 weeks" />
                <DataPoint label="Started" value={shortDate(company.startDate)} sub={daysAgo(company.startDate)} />
                <DataPoint label="Renews" value={shortDate(company.renewalDate)} sub={`${status.weeksToRenewal.toFixed(0)} weeks`} />
                <DataPoint label="Credit price" value={money(status.costPerCredit)} sub="Blended" />
                <DataPoint
                  label="Contract value"
                  value={compactMoney(status.costPerCredit * company.poolCredits)}
                  sub="Per term"
                />
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-sm font-medium text-foreground">{company.contactName}</p>
                <p className="text-micro text-muted-foreground">{company.contactEmail}</p>
              </div>
            </CardBody>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHeader
            title="Employees on this pool"
            description={`${num(status.employees.length)} covered · ${num(status.activeEmployees)} used a credit in the last 30 days`}
          />
          <TableWrap className="max-h-96">
            <Table>
              <Thead>
                <tr>
                  <SerialTh />
                  <Th>Employee</Th>
                  <Th width={130}>Status</Th>
                  <Th align="right" width={110}>Credits used</Th>
                  <Th width={130}>Last visit</Th>
                  <Th width={120}>Risk</Th>
                  <Th align="right" width={120}>Monthly value</Th>
                </tr>
              </Thead>
              <Tbody>
                {usage.map(({ member, credits, lastVisit }, i) => (
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
                    <Td align="right" className="tnum">{num(credits)}</Td>
                    <Td muted className="tnum">{lastVisit ? daysAgo(lastVisit) : 'never'}</Td>
                    <Td><RiskScore score={member.risk.score} /></Td>
                    <Td align="right" className="tnum">{money(member.metrics.monthlyValue)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableWrap>
        </Card>
      </PageBody>

      <ConfirmDialog
        open={topUp !== null}
        onClose={() => setTopUp(null)}
        onConfirm={() => {
          const credits = topUp ?? 0
          if (connection !== 'live' || credits <= 0) return
          void mutate(() => api.ops.topUpPool.mutate({ companyId: company.id, credits }), {
            success: () => ({
              title: `${num(credits)} credits added`,
              detail: `${company.name} now has ${num(status.remaining + credits)} credits — about ${((status.remaining + credits) / company.burnRatePerWeek).toFixed(1)} weeks at the current rate.`,
            }),
          })
        }}
        title="Top up the credit pool"
        description={`${company.name} · ${status.planName}`}
        consequenceTone="info"
        consequence={`${num(topUp ?? 0)} credits · ${money((topUp ?? 0) * status.costPerCredit)} invoiced to ${company.contactName}, due in 14 days.`}
        confirmLabel="Add credits"
        destructive={false}
      >
        <div className="flex flex-col gap-2">
          <p className="text-micro font-medium tracking-wide text-muted-foreground uppercase">Amount</p>
          <div className="flex gap-1.5">
            {TOP_UP_SIZES.map((size) => (
              <Button
                key={size}
                variant={topUp === size ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setTopUp(size)}
              >
                {size} credits
              </Button>
            ))}
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Credits are added immediately so employees keep checking in; the invoice follows.
          </p>
        </div>
      </ConfirmDialog>

      <ComposeEmailDialog
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        to={company.contactEmail}
        toName={company.contactName}
        title={`Email ${company.contactName}`}
        send={({ subject, body }) =>
          api.comms.emailCompanyContact.mutate({ companyId: company.id, subject, body })
        }
        templates={[
          {
            label: status.shortfall > 0 ? 'Pool running out' : 'Usage update',
            subject:
              status.shortfall > 0
                ? `${company.name} — your FlexFit credit pool is running low`
                : `${company.name} — FlexFit usage update`,
            body:
              status.shortfall > 0
                ? `Hi ${firstName},\n\n${company.name} has ${num(status.remaining)} credits left on the ${status.planName}. At the current ${num(company.burnRatePerWeek)} credits a week that runs out in about ${status.weeksLeft.toFixed(1)} weeks — ${status.weeksToRenewal.toFixed(1)} weeks before renewal on ${fullDate(company.renewalDate)}.\n\nWhen it empties, the ${num(status.employees.length)} employees on the pool stop being able to check in. Shall I add credits now and invoice as usual?\n\nThanks,\nFlexFit Studio`
                : `Hi ${firstName},\n\nA quick update on ${company.name}'s FlexFit pool: ${num(status.remaining)} of ${num(company.poolCredits)} credits remain (${percent(status.utilization)} used), with ${num(status.activeEmployees)} of ${num(status.employees.length)} employees active in the last 30 days.\n\nRenewal is ${fullDate(company.renewalDate)}. Happy to walk through the numbers whenever suits.\n\nThanks,\nFlexFit Studio`,
          },
          {
            label: 'Encourage sign-ups',
            subject: `${company.name} — get more of your team using FlexFit`,
            body: `Hi ${firstName},\n\n${num(status.employees.length - status.activeEmployees)} of the ${num(status.employees.length)} employees on your pool have not used a credit in the last 30 days.\n\nIf it helps, we can run an on-site intro session or send a short sign-up guide to your team. The credits are already paid for either way.\n\nThanks,\nFlexFit Studio`,
          },
        ]}
      />
    </RequireScreen>
  )
}
