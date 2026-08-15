'use client'

import * as React from 'react'
import Link from 'next/link'
import { CornerDownRight, Download } from 'lucide-react'
import { PageHeader, PageBody } from '@/components/shell/page-header'
import { RequireScreen } from '@/components/shell/app-shell'
import { Card, CardBody, CardHeader, KpiTile } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Field, Select } from '@/components/ui/input'
import { FilterBar, FilterTrigger } from '@/components/ui/filter-chip'
import { Modal, ConsequenceNotice } from '@/components/ui/modal'
import { PaymentStatus, StatusChip } from '@/components/ui/status-chip'
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
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api/client'
import { useDataVersion, useStudio } from '@/lib/store/studio-store'
import { datedFilename, downloadCsv } from '@/lib/export'
import { payments as seedPayments } from '@/lib/data/payments'
import { clock, compactMoney, money, num, percent, shortDate } from '@/lib/format'
import type { Payment, PaymentMethod, PaymentStatus as PayStatus } from '@/lib/types'
import {
  ledgerRows,
  ledgerTotals,
  methodSplit,
  METHOD_LABELS,
  REFUND_REASONS,
} from './payments-data'

type StatusKey = 'all' | PayStatus
type MethodKey = 'all' | PaymentMethod

const STATUS_FILTERS: { id: StatusKey; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'paid', label: 'Paid' },
  { id: 'pending', label: 'Pending' },
  { id: 'failed', label: 'Failed' },
  { id: 'refunded', label: 'Refunded' },
]

const METHOD_FILTERS: MethodKey[] = ['all', 'card', 'upi', 'cash', 'transfer']

/**
 * Payments. One rule drives the whole screen: the ledger is append-only.
 * A refund never edits the original row — it inserts a negative reversal row
 * directly beneath it, so the two always read as a pair.
 */
export function PaymentsLedger() {
  const { toast } = useToast()
  const { mutate, busy } = useStudio()
  const version = useDataVersion()
  const [status, setStatus] = React.useState<StatusKey>('all')
  const [method, setMethod] = React.useState<MethodKey>('all')
  const [query, setQuery] = React.useState('')
  const [refundTarget, setRefundTarget] = React.useState<Payment | null>(null)
  const [reason, setReason] = React.useState<string>(REFUND_REASONS[0])

  // A member profile links here with ?q=<their name>, so "open in ledger" lands
  // on their rows rather than on seven years of everybody's.
  React.useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q')
    if (q) setQuery(q)
  }, [])

  const all = React.useMemo(() => {
    // Straight off the live binding — a refund is a real row now, so there is
    // no local `extra` list to merge and nothing that can disagree with the
    // member's lifetime value on the profile screen.
    const merged = [...seedPayments]
    // Reversals sit directly under their original, everything else newest first.
    const primaries = merged.filter((p) => p.reversalOf === null).sort((a, b) => (a.date < b.date ? 1 : -1))
    const out: Payment[] = []
    for (const p of primaries) {
      out.push(p)
      out.push(...merged.filter((r) => r.reversalOf === p.id))
    }
    return ledgerRows(out)
  }, [version])

  const totals = React.useMemo(() => ledgerTotals(all), [all])
  const split = React.useMemo(() => methodSplit(all), [all])

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter((row) => {
      if (status !== 'all' && row.payment.status !== status) return false
      if (method !== 'all' && row.payment.method !== method) return false
      if (!q) return true
      return (
        row.memberName.toLowerCase().includes(q) ||
        row.payment.invoiceId.toLowerCase().includes(q) ||
        row.payment.id.toLowerCase().includes(q)
      )
    })
  }, [all, status, method, query])

  const refund = async () => {
    if (!refundTarget) return
    const target = refundTarget
    setRefundTarget(null)
    await mutate(() => api.billing.refund.mutate({ paymentId: target.id, reason }), {
      success: (r) => ({
        title: 'Reversal row added',
        detail: `${money(Math.abs(r.amount))} against ${target.invoiceId}. The original row is untouched.`,
      }),
    })
  }

  /**
   * Export what is on screen, not the whole ledger — the filters above are the
   * question being asked, and an export that silently ignores them answers a
   * different one.
   */
  const exportCsv = () => {
    const n = downloadCsv(datedFilename('payments'), rows, [
      { header: 'S.no', value: (_r, i) => i + 1 },
      { header: 'Date', value: (r) => r.payment.date.slice(0, 10) },
      { header: 'Payment ID', value: (r) => r.payment.id },
      { header: 'Invoice', value: (r) => r.payment.invoiceId },
      { header: 'Member', value: (r) => r.memberName },
      { header: 'Member ID', value: (r) => r.payment.memberId },
      { header: 'Plan', value: (r) => r.planName },
      { header: 'Description', value: (r) => r.payment.description },
      { header: 'Method', value: (r) => METHOD_LABELS[r.payment.method] },
      { header: 'Status', value: (r) => r.payment.status },
      // Unformatted so a spreadsheet can sum the column; reversals stay negative.
      { header: 'Amount (INR)', value: (r) => r.payment.amount },
      { header: 'Reversal of', value: (r) => r.payment.reversalOf ?? '' },
    ])
    toast({
      tone: 'good',
      title: `Exported ${num(n)} rows`,
      detail: status === 'all' && method === 'all' && !query.trim() ? 'The whole ledger.' : 'Matching the filters on screen.',
    })
  }

  return (
    <RequireScreen screen="payments">
      <PageHeader
        title="Payments"
        crumbs={[{ label: 'FlexFit Studio', href: '/dashboard' }, { label: 'Payments' }]}
        meta={
          <>
            <span className="tnum">{num(totals.count)} rows</span>
            <span aria-hidden>·</span>
            <span className="tnum">{compactMoney(totals.net)} net</span>
            <span aria-hidden>·</span>
            <span>Append-only ledger</span>
          </>
        }
        actions={
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            <Download />
            Export CSV
          </Button>
        }
        sticky={false}
      />

      <PageBody>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
          <Card className="grid grid-cols-2 lg:grid-cols-4">
            <KpiTile label="Gross" value={compactMoney(totals.gross)} footnote="Charges, excl. reversals" />
            <KpiTile label="Refunded" value={compactMoney(Math.abs(totals.refunds))} footnote="Paired reversal rows" />
            <KpiTile label="Net" value={compactMoney(totals.net)} footnote="What actually landed" />
            <KpiTile label="Unsettled" value={compactMoney(totals.unsettled)} footnote="Failed or pending" />
          </Card>

          <Card>
            <CardHeader title="By method" description="Share of gross." />
            <CardBody className="flex flex-col gap-2.5">
              {split.map((m) => (
                <div key={m.method} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-sm text-foreground">{m.label}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-sm bg-muted">
                    <span
                      className="block h-full bg-chart-2"
                      style={{ width: `${Math.max(2, m.share)}%` }}
                    />
                  </span>
                  <span className="w-16 shrink-0 text-right text-micro text-muted-foreground tnum">
                    {percent(m.share)}
                  </span>
                  <span className="w-20 shrink-0 text-right text-sm text-foreground tnum">
                    {compactMoney(m.amount)}
                  </span>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <FilterBar resultCount={rows.length} totalCount={all.length}>
            {STATUS_FILTERS.map((f) => (
              <FilterTrigger
                key={f.id}
                label={f.label}
                active={status === f.id}
                onClick={() => setStatus(f.id)}
              />
            ))}
            <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
            {METHOD_FILTERS.map((m) => (
              <FilterTrigger
                key={m}
                label={m === 'all' ? 'Any method' : METHOD_LABELS[m]}
                active={method === m}
                onClick={() => setMethod(m)}
              />
            ))}
            <div className="w-48">
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.currentTarget.value)}
                placeholder="Member, invoice, txn id"
                aria-label="Search payments"
                className="h-6 text-micro"
              />
            </div>
          </FilterBar>

          {rows.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No payments match these filters"
                description="Payments are kept for 7 years — widen the filters to find older rows."
                action={{ label: 'Reset filters', onClick: () => { setStatus('all'); setMethod('all'); setQuery('') } }}
              />
            </div>
          ) : (
            <TableWrap className="max-h-[calc(100dvh-380px)]">
              <Table>
                <Thead>
                  <tr>
                    <SerialTh />
                    <Th width={130}>Date</Th>
                    <Th width={110}>Txn</Th>
                    <Th>Member</Th>
                    <Th width={120}>Invoice</Th>
                    <Th width={110}>Method</Th>
                    <Th align="right" width={120}>Amount</Th>
                    <Th width={120}>Status</Th>
                    <Th width={90} />
                  </tr>
                </Thead>
                <Tbody>
                  {rows.map((row, i) => (
                    <Tr key={row.payment.id} className={row.isReversal ? 'bg-subtle' : undefined}>
                      <SerialTd index={i} />
                      <Td muted className="tnum">
                        {shortDate(row.payment.date)}
                        <span className="ml-1.5 text-micro opacity-70">{clock(row.payment.date)}</span>
                      </Td>
                      <Td className="font-mono text-micro text-muted-foreground">{row.payment.id}</Td>
                      <Td>
                        {row.isReversal ? (
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <CornerDownRight className="size-3.5 shrink-0" />
                            <span className="truncate">{row.payment.description}</span>
                          </span>
                        ) : (
                          <CellStack
                            primary={
                              <Link href={`/members/${row.payment.memberId}`} className="hover:text-primary hover:underline">
                                {row.memberName}
                              </Link>
                            }
                            secondary={row.planName}
                          />
                        )}
                      </Td>
                      <Td>
                        <Link
                          href={`/billing/invoices/${row.payment.invoiceId.replace(/-R$/, '')}`}
                          className="font-mono text-micro text-primary underline-offset-2 hover:underline"
                        >
                          {row.payment.invoiceId}
                        </Link>
                      </Td>
                      <Td muted>{METHOD_LABELS[row.payment.method]}</Td>
                      <Td align="right" className="tnum font-medium">
                        <span className={row.isReversal ? 'text-danger' : undefined}>{money(row.payment.amount)}</span>
                      </Td>
                      <Td>
                        {row.isReversal ? (
                          <StatusChip tone="info" label="Reversal" title={`Reverses ${row.payment.reversalOf}`} />
                        ) : (
                          <PaymentStatus status={row.payment.status} />
                        )}
                      </Td>
                      <Td align="right">
                        {!row.isReversal && row.payment.status === 'paid' && !row.reversedBy ? (
                          <Button
                            variant="ghost"
                            size="xs"
                            className="opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
                            onClick={() => setRefundTarget(row.payment)}
                          >
                            Refund
                          </Button>
                        ) : row.reversedBy ? (
                          <span className="text-micro text-muted-foreground">reversed</span>
                        ) : null}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      </PageBody>

      <Modal
        open={refundTarget !== null}
        onClose={() => setRefundTarget(null)}
        title={refundTarget ? `Refund ${money(refundTarget.amount)}?` : 'Refund'}
        description={refundTarget ? `${refundTarget.invoiceId} · ${METHOD_LABELS[refundTarget.method]}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRefundTarget(null)}>
              Cancel
            </Button>
            <Button data-autofocus variant="danger" disabled={busy} onClick={refund}>
              Add reversal row
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <ConsequenceNotice
            tone="warn"
            headline={refundTarget ? `A −${money(refundTarget.amount)} row is appended to the ledger` : ''}
            detail="The original charge stays exactly as it is. Both rows appear on the member's billing tab and in the next export."
          />
          <Field label="Reason" htmlFor="refund-reason" help="Recorded on the reversal row and on the credit note.">
            <Select id="refund-reason" value={reason} onChange={(e) => setReason(e.currentTarget.value)}>
              {REFUND_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Money reaches the member in 5–7 working days for card and UPI, immediately for cash.
            This does not cancel their membership.
          </p>
        </div>
      </Modal>
    </RequireScreen>
  )
}
