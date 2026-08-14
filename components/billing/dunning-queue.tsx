'use client'

import * as React from 'react'
import Link from 'next/link'
import { CheckCircle2, PhoneCall, RefreshCw } from 'lucide-react'
import { PageHeader, PageBody } from '@/components/shell/page-header'
import { RequireScreen } from '@/components/shell/app-shell'
import { Card, CardBody, CardHeader, KpiTile } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/modal'
import { RiskScore, StatusChip } from '@/components/ui/status-chip'
import { EmptyState } from '@/components/ui/empty-state'
import { CellStack, Table, TableWrap, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { compactMoney, money, num, shortDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { BillingTabs } from './billing-tabs'
import { DUNNING_LADDER, dunningQueue, invoices, type DunningItem } from './billing-data'

/**
 * Dunning is a recovery ladder, not a punishment queue. Every row shows which
 * rung it is on, what happens next, and what it is worth to recover — so staff
 * can spend their calls on the invoices that matter.
 */
export function DunningQueue() {
  const { toast } = useToast()
  const all = React.useMemo(() => dunningQueue(), [])
  const [resolved, setResolved] = React.useState<string[]>([])
  const [pauseTarget, setPauseTarget] = React.useState<DunningItem | null>(null)
  const [rung, setRung] = React.useState<string>('all')

  const open = all.filter((i) => !resolved.includes(i.invoice.id))
  const rows = rung === 'all' ? open : open.filter((i) => i.step.id === rung)
  const atStake = open.reduce((s, i) => s + i.invoice.amount, 0)
  const recoverable = open.reduce((s, i) => s + i.monthlyValue, 0)

  const resolve = (item: DunningItem, label: string, detail: string) => {
    setResolved((prev) => [...prev, item.invoice.id])
    toast({
      tone: 'good',
      title: label,
      detail,
      action: {
        label: 'Undo',
        onClick: () => setResolved((prev) => prev.filter((id) => id !== item.invoice.id)),
      },
    })
  }

  return (
    <RequireScreen screen="billing">
      <PageHeader
        title="Dunning"
        crumbs={[
          { label: 'FlexFit Studio', href: '/dashboard' },
          { label: 'Billing', href: '/billing' },
          { label: 'Dunning' },
        ]}
        meta={
          <>
            <span className="tnum">{num(open.length)} invoices in recovery</span>
            <span aria-hidden>·</span>
            <span className="tnum">{compactMoney(atStake)} unsettled</span>
          </>
        }
        sticky={false}
      >
        <BillingTabs counts={{ '/billing': invoices.length, '/billing/dunning': open.length }} />
      </PageHeader>

      <PageBody>
        <Card className="grid grid-cols-2 lg:grid-cols-4">
          <KpiTile label="In recovery" value={num(open.length)} footnote="Failed or late invoices" />
          <KpiTile label="Unsettled" value={compactMoney(atStake)} footnote="One cycle only" />
          <KpiTile
            label="Monthly value behind it"
            value={compactMoney(recoverable)}
            footnote="What lapses if recovery fails"
          />
          <KpiTile
            label="Cleared today"
            value={num(resolved.length)}
            footnote={resolved.length === 0 ? 'Nothing cleared yet' : 'Undo is available in the toast'}
          />
        </Card>

        <Card>
          <CardHeader
            title="The ladder"
            description="Fixed schedule from the first failure. Two rungs need a human; the rest run themselves."
          />
          <CardBody className="grid gap-2 sm:grid-cols-5">
            {DUNNING_LADDER.map((step) => {
              const count = open.filter((i) => i.step.id === step.id).length
              const active = rung === step.id
              return (
                <button
                  key={step.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setRung(active ? 'all' : step.id)}
                  className={cn(
                    'flex flex-col gap-1 rounded-md border p-2.5 text-left transition-colors duration-150 ease-[var(--ease-ui)]',
                    active
                      ? 'border-primary bg-primary-soft'
                      : 'border-border bg-surface hover:border-border-strong',
                  )}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-micro font-medium tracking-wide text-muted-foreground uppercase">
                      Day {step.onDay}
                    </span>
                    <span className="text-sm font-semibold text-foreground tnum">{count}</span>
                  </span>
                  <span className="text-sm font-medium text-foreground">{step.label}</span>
                  <span className="text-micro leading-relaxed text-muted-foreground">{step.action}</span>
                  <StatusChip
                    tone={step.automatic ? 'neutral' : 'warn'}
                    label={step.automatic ? 'Automatic' : 'Needs staff'}
                    className="mt-0.5 self-start"
                  />
                </button>
              )
            })}
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title={rung === 'all' ? 'All invoices in recovery' : `Rung: ${DUNNING_LADDER.find((s) => s.id === rung)?.label}`}
            description="Ordered by invoice amount plus the monthly value at risk behind it."
            actions={
              rung === 'all' ? null : (
                <Button variant="ghost" size="sm" onClick={() => setRung('all')}>
                  Show all rungs
                </Button>
              )
            }
          />
          {rows.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title={open.length === 0 ? 'Nothing in recovery' : 'No invoices on this rung'}
                description={
                  open.length === 0
                    ? 'Every failed invoice this cycle has been settled or written off.'
                    : 'Pick another rung, or show the whole queue.'
                }
                action={{ label: 'Show all rungs', onClick: () => setRung('all') }}
              />
            </div>
          ) : (
            <TableWrap>
              <Table>
                <Thead>
                  <tr>
                    <Th>Member</Th>
                    <Th width={110}>Invoice</Th>
                    <Th align="right" width={110}>Amount</Th>
                    <Th width={90}>Late</Th>
                    <Th width={150}>Current step</Th>
                    <Th width={110}>Next action</Th>
                    <Th width={110}>Risk</Th>
                    <Th width={220} />
                  </tr>
                </Thead>
                <Tbody>
                  {rows.map((item) => (
                    <Tr key={item.invoice.id}>
                      <Td>
                        <CellStack
                          primary={
                            <Link
                              href={`/members/${item.invoice.memberId}`}
                              className="hover:text-primary hover:underline"
                            >
                              {item.invoice.memberName}
                            </Link>
                          }
                          secondary={`${compactMoney(item.monthlyValue)}/mo · attempt ${item.attempts}`}
                        />
                      </Td>
                      <Td>
                        <Link
                          href={`/billing/invoices/${item.invoice.id}`}
                          className="font-mono text-micro text-primary underline-offset-2 hover:underline"
                        >
                          {item.invoice.id}
                        </Link>
                      </Td>
                      <Td align="right" className="tnum font-medium">{money(item.invoice.amount)}</Td>
                      <Td className="tnum">
                        <span className={item.invoice.overdueDays >= 12 ? 'text-danger' : 'text-muted-foreground'}>
                          {item.invoice.overdueDays}d
                        </span>
                      </Td>
                      <Td>
                        <StatusChip
                          tone={item.paused ? 'danger' : item.step.automatic ? 'info' : 'warn'}
                          label={item.step.label}
                        />
                      </Td>
                      <Td muted className="tnum">{shortDate(item.nextActionDate)}</Td>
                      <Td><RiskScore score={item.riskScore} /></Td>
                      <Td>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() =>
                              resolve(
                                item,
                                'Retry queued',
                                `${item.invoice.memberName} — ${money(item.invoice.amount)} on the saved ${item.invoice.method.toUpperCase()}.`,
                              )
                            }
                          >
                            <RefreshCw />
                            Retry
                          </Button>
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() =>
                              resolve(
                                item,
                                'Logged as called',
                                `Call logged against ${item.invoice.id}. Ladder pauses 48h while they fix the card.`,
                              )
                            }
                          >
                            <PhoneCall />
                            Called
                          </Button>
                          <Button
                            variant={item.paused ? 'danger' : 'ghost'}
                            size="xs"
                            onClick={() => setPauseTarget(item)}
                          >
                            Pause access
                          </Button>
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      </PageBody>

      <ConfirmDialog
        open={pauseTarget !== null}
        onClose={() => setPauseTarget(null)}
        onConfirm={() => {
          if (!pauseTarget) return
          resolve(
            pauseTarget,
            'Access paused',
            `${pauseTarget.invoice.memberName} can't check in until ${pauseTarget.invoice.id} clears. Membership is intact.`,
          )
        }}
        title="Pause check-in access?"
        description={pauseTarget ? `${pauseTarget.invoice.memberName} · ${pauseTarget.invoice.id}` : undefined}
        consequence={
          pauseTarget
            ? `The kiosk will show a RED result and the front desk gets the reason. ${money(pauseTarget.invoice.amount)} stays owed; the membership is not cancelled.`
            : undefined
        }
        confirmLabel="Pause access"
      >
        <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
          Access restores itself the moment the invoice is paid — no staff step needed.
        </p>
      </ConfirmDialog>
    </RequireScreen>
  )
}
