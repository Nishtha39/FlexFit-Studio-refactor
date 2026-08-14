'use client'

import * as React from 'react'
import { Receipt, RotateCcw, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardBody, CardFooter, DataPoint } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PaymentStatus, StatusChip } from '@/components/ui/status-chip'
import { TableWrap, Table, Thead, Tbody, Th, Tr, Td } from '@/components/ui/table'
import { ConfirmDialog } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import type { Member, Payment } from '@/lib/types'
import { fullDate, money, num } from '@/lib/format'
import { paymentsForMember } from '@/lib/data/payments'
import { getPlan } from '@/lib/data/plans'

/**
 * Billing tab. Refunds are shown as paired reversal rows — the original charge
 * never disappears, so the ledger always reconciles and nobody has to guess
 * whether a negative number is a correction or a second transaction.
 */
export function BillingTab({ member }: { member: Member }) {
  const { toast } = useToast()
  const [refunding, setRefunding] = React.useState<Payment | null>(null)
  const rows = React.useMemo(() => paymentsForMember(member.id), [member.id])
  const plan = getPlan(member.planId)

  const collected = rows
    .filter((p) => p.status === 'paid' || p.status === 'refunded')
    .reduce((s, p) => s + p.amount, 0)
  const failed = rows.filter((p) => p.status === 'failed')
  const pending = rows.filter((p) => p.status === 'pending')
  const refunded = rows.filter((p) => p.reversalOf !== null)
  const outstanding = [...failed, ...pending].reduce((s, p) => s + p.amount, 0)

  // Reversal rows are attached to their original so the pair reads as one event.
  const reversalByOriginal = new Map(
    rows.filter((p) => p.reversalOf).map((p) => [p.reversalOf as string, p]),
  )
  const primaryRows = rows.filter((p) => p.reversalOf === null)

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader
            title="Payment history"
            description={`${num(primaryRows.length)} transactions on record`}
            actions={
              <Button variant="secondary" size="sm">
                <CreditCard className="size-3.5" />
                Take payment
              </Button>
            }
          />
          {primaryRows.length === 0 ? (
            <CardBody>
              <EmptyState
                icon={Receipt}
                title="No payments recorded"
                description={`${member.name} has no transactions on file. If they are training here, they may be on a corporate pool or a comped membership.`}
              />
            </CardBody>
          ) : (
            <TableWrap>
              <Table>
                <Thead>
                  <Tr className="bg-subtle hover:bg-subtle">
                    <Th>Invoice</Th>
                    <Th>Date</Th>
                    <Th>Method</Th>
                    <Th>Status</Th>
                    <Th align="right">Amount</Th>
                    <Th width={80} className="sr-only">
                      Actions
                    </Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {primaryRows.map((p) => {
                    const reversal = reversalByOriginal.get(p.id)
                    return (
                      <React.Fragment key={p.id}>
                        <Tr>
                          <Td className="font-mono text-micro">{p.invoiceId}</Td>
                          <Td muted>{fullDate(p.date)}</Td>
                          <Td className="uppercase">{p.method}</Td>
                          <Td>
                            <PaymentStatus status={p.status} />
                          </Td>
                          <Td align="right" className="font-medium tnum">
                            {money(p.amount, { paise: true })}
                          </Td>
                          <Td className="pl-0">
                            {p.status === 'paid' ? (
                              <Button
                                variant="ghost"
                                size="xs"
                                className="opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
                                onClick={() => setRefunding(p)}
                              >
                                <RotateCcw className="size-3" />
                                Refund
                              </Button>
                            ) : p.status === 'failed' ? (
                              <Button variant="ghost" size="xs">
                                Retry
                              </Button>
                            ) : null}
                          </Td>
                        </Tr>
                        {reversal ? (
                          <Tr className="bg-subtle hover:bg-subtle">
                            <Td className="pl-6 font-mono text-micro text-muted-foreground">
                              ↳ {reversal.invoiceId}
                            </Td>
                            <Td muted>{fullDate(reversal.date)}</Td>
                            <Td className="uppercase" muted>
                              {reversal.method}
                            </Td>
                            <Td>
                              <StatusChip tone="info" label="Reversal" />
                            </Td>
                            <Td align="right" className="font-medium text-danger tnum">
                              {money(reversal.amount, { paise: true })}
                            </Td>
                            <Td />
                          </Tr>
                        ) : null}
                      </React.Fragment>
                    )
                  })}
                </Tbody>
              </Table>
            </TableWrap>
          )}
          {primaryRows.length > 0 ? (
            <CardFooter>
              <span>Net collected across all transactions</span>
              <span className="font-medium text-foreground tnum">
                {money(collected, { paise: true })}
              </span>
            </CardFooter>
          ) : null}
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader title="Account standing" />
            <CardBody className="grid grid-cols-2 gap-4">
              <DataPoint label="Net collected" value={money(collected)} sub="Lifetime" />
              <DataPoint
                label="Outstanding"
                value={money(outstanding)}
                sub={`${num(failed.length + pending.length)} unsettled`}
                className={outstanding > 0 ? '[&>span:nth-child(2)]:text-danger' : undefined}
              />
              <DataPoint label="Failed" value={num(failed.length)} sub="Declines on record" />
              <DataPoint label="Refunded" value={num(refunded.length)} sub="Reversals issued" />
            </CardBody>
            {outstanding > 0 ? (
              <CardFooter className="border-danger-border bg-danger-soft text-danger">
                <span className="font-medium">
                  {money(outstanding)} needs collection before the next cycle
                </span>
              </CardFooter>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Current plan" />
            <CardBody className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-base font-medium text-foreground">{plan?.name}</span>
                <span className="text-base font-semibold text-foreground tnum">
                  {money(member.metrics.monthlyValue)}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{plan?.description}</p>
              <dl className="flex flex-col gap-1.5 border-t border-border pt-3 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Billing interval</dt>
                  <dd className="capitalize text-foreground">{plan?.interval}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Allowance</dt>
                  <dd className="text-foreground tnum">
                    {plan?.visitsPerMonth === null ? 'Unlimited' : `${plan?.visitsPerMonth} / mo`}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Credits left</dt>
                  <dd className="text-foreground tnum">
                    {member.metrics.creditsRemaining ?? 'n/a'}
                  </dd>
                </div>
              </dl>
            </CardBody>
            <CardFooter>
              <Button variant="secondary" size="xs">
                Change plan
              </Button>
              <Button variant="ghost" size="xs">
                Billing history
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={refunding !== null}
        onClose={() => setRefunding(null)}
        onConfirm={() =>
          toast({
            tone: 'info',
            title: 'Refund issued',
            detail: `${money(refunding?.amount ?? 0)} reversed on ${refunding?.invoiceId}`,
          })
        }
        title="Issue refund"
        confirmLabel={`Refund ${money(refunding?.amount ?? 0)}`}
        consequenceTone="danger"
        consequence={`${money(refunding?.amount ?? 0, { paise: true })} will be returned to the original ${refunding?.method.toUpperCase()} method. This cannot be undone from here.`}
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          The original charge stays on the ledger. A paired reversal row is added referencing{' '}
          <span className="font-mono text-foreground">{refunding?.invoiceId}</span>, so the account
          history remains auditable.
        </p>
      </ConfirmDialog>
    </div>
  )
}
