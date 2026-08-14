'use client'

import * as React from 'react'
import Link from 'next/link'
import { Printer, RefreshCw, Send } from 'lucide-react'
import { PageHeader, PageBody } from '@/components/shell/page-header'
import { RequireScreen } from '@/components/shell/app-shell'
import { Card, CardBody, CardHeader, CardFooter, DataPoint } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, ConsequenceNotice } from '@/components/ui/modal'
import { PaymentStatus, StatusChip } from '@/components/ui/status-chip'
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { clock, fullDate, money, shortDate } from '@/lib/format'
import { DUNNING_LADDER, paymentsForInvoice, type Invoice } from './billing-data'

/**
 * One invoice. Two rules the whole billing surface obeys:
 * a refund never edits history (it adds a paired reversal row), and every
 * recovery action states what the member will experience before you send it.
 */
export function InvoiceDetail({ invoice }: { invoice: Invoice }) {
  const { toast } = useToast()
  const [refundOpen, setRefundOpen] = React.useState(false)
  const [retried, setRetried] = React.useState(false)
  const rows = React.useMemo(() => paymentsForInvoice(invoice), [invoice])
  const unsettled = invoice.status === 'failed' || invoice.status === 'pending'
  const step = DUNNING_LADDER.find((s) => invoice.overdueDays >= s.onDay)

  return (
    <RequireScreen screen="billing">
      <PageHeader
        title={invoice.id}
        crumbs={[
          { label: 'FlexFit Studio', href: '/dashboard' },
          { label: 'Billing', href: '/billing' },
          { label: invoice.id },
        ]}
        meta={
          <>
            <span>{invoice.planName}</span>
            <span aria-hidden>·</span>
            <span className="tnum">Issued {fullDate(invoice.issuedDate)}</span>
            <span aria-hidden>·</span>
            <span className="tnum">Due {fullDate(invoice.dueDate)}</span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" size="sm">
              <Printer />
              Print
            </Button>
            {invoice.status === 'paid' ? (
              <Button variant="danger" size="sm" onClick={() => setRefundOpen(true)}>
                Refund
              </Button>
            ) : unsettled ? (
              <Button
                variant="primary"
                size="sm"
                disabled={retried}
                onClick={() => {
                  setRetried(true)
                  toast({
                    tone: 'info',
                    title: 'Card retry queued',
                    detail: `${invoice.memberName} will be charged ${money(invoice.amount)} within a minute. They get one SMS if it fails again.`,
                  })
                }}
              >
                <RefreshCw />
                {retried ? 'Retry queued' : 'Retry card'}
              </Button>
            ) : null}
          </>
        }
        sticky={false}
      />

      <PageBody>
        {invoice.overdueDays > 0 ? (
          <ConsequenceNotice
            tone={invoice.overdueDays >= 18 ? 'danger' : 'warn'}
            headline={`${invoice.overdueDays} days past due — ${step?.label ?? 'Retry card'} is the current step`}
            detail={
              <>
                {step?.action} Access is paused on day 18, not cancelled.{' '}
                <Link href="/billing/dunning" className="font-medium underline underline-offset-2">
                  Open the dunning queue
                </Link>
                .
              </>
            }
          />
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader
              title="Line items"
              description={`${invoice.description} · ${invoice.method.toUpperCase()}`}
              actions={<PaymentStatus status={invoice.status} />}
            />
            <TableWrap>
              <Table>
                <Thead>
                  <tr>
                    <Th>Item</Th>
                    <Th align="right" width={70}>Qty</Th>
                    <Th align="right" width={110}>Unit</Th>
                    <Th align="right" width={120}>Amount</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {invoice.lines.map((line) => (
                    <Tr key={line.label}>
                      <Td>
                        <span className="font-medium text-foreground">{line.label}</span>
                        <span className="ml-2 text-micro text-muted-foreground">{line.detail}</span>
                      </Td>
                      <Td align="right" muted className="tnum">{line.qty}</Td>
                      <Td align="right" muted className="tnum">{money(line.unit, { paise: true })}</Td>
                      <Td align="right" className="tnum font-medium">{money(line.amount, { paise: true })}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableWrap>
            <CardFooter>
              <span>Net {money(invoice.netAmount, { paise: true })} + GST {money(invoice.taxAmount, { paise: true })}</span>
              <span className="text-base font-semibold text-foreground tnum">
                {money(invoice.amount, { paise: true })}
              </span>
            </CardFooter>
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader title="Billed to" />
              <CardBody className="grid grid-cols-2 gap-4">
                <DataPoint
                  label="Member"
                  value={
                    <Link
                      href={`/members/${invoice.memberId}`}
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {invoice.memberName}
                    </Link>
                  }
                  sub={invoice.memberId}
                />
                <DataPoint label="Method" value={invoice.method.toUpperCase()} sub="Saved instrument" />
                <DataPoint label="Plan" value={invoice.planName} sub={invoice.planId ?? '—'} />
                <DataPoint label="Cycle" value={shortDate(invoice.issuedDate)} sub={`Due ${shortDate(invoice.dueDate)}`} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Ledger"
                description="Reversals are appended, never overwritten."
              />
              <CardBody className="flex flex-col gap-2.5">
                {rows.map((row) => (
                  <div key={row.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {row.reversalOf ? 'Reversal' : 'Charge'}
                        <span className="ml-1.5 font-mono text-micro text-muted-foreground">{row.id}</span>
                      </p>
                      <p className="text-micro text-muted-foreground tnum">
                        {shortDate(row.date)} · {clock(row.date)} · {row.method.toUpperCase()}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-medium text-foreground tnum">{money(row.amount)}</span>
                      {row.reversalOf ? (
                        <StatusChip tone="info" label="Reversal" />
                      ) : (
                        <PaymentStatus status={row.status} />
                      )}
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
        </div>
      </PageBody>

      <ConfirmDialog
        open={refundOpen}
        onClose={() => setRefundOpen(false)}
        onConfirm={() =>
          toast({
            tone: 'info',
            title: `Reversal row added to ${invoice.id}`,
            detail: `${money(invoice.amount)} back to the original ${invoice.method.toUpperCase()} instrument in 5–7 days.`,
          })
        }
        title={`Refund ${money(invoice.amount)}?`}
        description={`${invoice.memberName} · ${invoice.planName}`}
        consequence={`This adds a −${money(invoice.amount)} reversal row. ${invoice.id} stays on record as paid.`}
        confirmLabel="Refund to source"
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          Membership access is unaffected. If you meant to end the membership instead, cancel it from
          the member profile — a refund alone leaves the plan active.
        </p>
        <Button variant="ghost" size="sm" className="mt-1 gap-1.5">
          <Send />
          Also email the member a credit note
        </Button>
      </ConfirmDialog>
    </RequireScreen>
  )
}
