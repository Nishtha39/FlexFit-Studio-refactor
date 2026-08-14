'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowUpRight, Download } from 'lucide-react'
import { PageHeader, PageBody } from '@/components/shell/page-header'
import { RequireScreen } from '@/components/shell/app-shell'
import { Card, KpiTile } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FilterBar, FilterTrigger } from '@/components/ui/filter-chip'
import { PaymentStatus, StatusChip } from '@/components/ui/status-chip'
import { EmptyState } from '@/components/ui/empty-state'
import {
  CellStack,
  Table,
  TableWrap,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  type SortDir,
} from '@/components/ui/table'
import { compactMoney, money, percent, shortDate } from '@/lib/format'
import { BillingTabs } from './billing-tabs'
import { billingTotals, dunningQueue, invoices, type Invoice } from './billing-data'

type StatusKey = 'all' | 'paid' | 'pending' | 'failed' | 'refunded'
type SortKey = 'issued' | 'member' | 'amount' | 'due'

const STATUS_FILTERS: { id: StatusKey; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'failed', label: 'Failed' },
  { id: 'pending', label: 'Pending' },
  { id: 'paid', label: 'Paid' },
  { id: 'refunded', label: 'Refunded' },
]

export function InvoiceList() {
  const [status, setStatus] = React.useState<StatusKey>('all')
  const [query, setQuery] = React.useState('')
  const [sort, setSort] = React.useState<{ key: SortKey; dir: SortDir }>({ key: 'issued', dir: 'desc' })

  const totals = React.useMemo(() => billingTotals(), [])
  const dunning = React.useMemo(() => dunningQueue(), [])

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    let out = invoices.filter((i) => (status === 'all' ? true : i.status === status))
    if (q) {
      out = out.filter(
        (i) => i.memberName.toLowerCase().includes(q) || i.id.toLowerCase().includes(q),
      )
    }
    const dir = sort.dir === 'asc' ? 1 : -1
    const cmp: Record<SortKey, (a: Invoice, b: Invoice) => number> = {
      issued: (a, b) => (a.issuedDate < b.issuedDate ? -1 : 1),
      due: (a, b) => (a.dueDate < b.dueDate ? -1 : 1),
      member: (a, b) => a.memberName.localeCompare(b.memberName),
      amount: (a, b) => a.amount - b.amount,
    }
    return [...out].sort((a, b) => cmp[sort.key](a, b) * dir)
  }, [status, query, sort])

  const toggleSort = (key: SortKey) =>
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' },
    )
  const dirFor = (key: SortKey): SortDir => (sort.key === key ? sort.dir : null)

  return (
    <RequireScreen screen="billing">
      <PageHeader
        title="Billing"
        crumbs={[{ label: 'FlexFit Studio', href: '/dashboard' }, { label: 'Billing' }]}
        meta={
          <>
            <span className="tnum">{invoices.length} invoices this cycle</span>
            <span aria-hidden>·</span>
            <span className="tnum">{compactMoney(totals.outstanding + totals.failed)} unsettled</span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" size="sm">
              <Download />
              Export
            </Button>
            <Button variant="primary" size="sm">
              New invoice
            </Button>
          </>
        }
        sticky={false}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <BillingTabs counts={{ '/billing': invoices.length, '/billing/dunning': dunning.length }} />
          <div className="w-full max-w-56">
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              placeholder="Member or invoice no."
              aria-label="Search invoices"
              className="h-7"
            />
          </div>
        </div>
      </PageHeader>

      <PageBody>
        <Card className="grid grid-cols-2 lg:grid-cols-4">
          <KpiTile label="Billed" value={compactMoney(totals.billed)} footnote={`${invoices.length} invoices`} />
          <KpiTile
            label="Collected"
            value={compactMoney(totals.collected)}
            footnote={`${percent(totals.collectionRate)} of billed`}
          />
          <KpiTile
            label="Outstanding"
            value={compactMoney(totals.outstanding)}
            footnote="Pending, not yet late"
          />
          <KpiTile
            label="Failed"
            value={compactMoney(totals.failed)}
            footnote={`${dunning.length} in the dunning ladder`}
          />
        </Card>

        <Card className="overflow-hidden">
          <FilterBar resultCount={rows.length} totalCount={invoices.length}>
            {STATUS_FILTERS.map((f) => (
              <FilterTrigger
                key={f.id}
                label={f.label}
                active={status === f.id}
                onClick={() => setStatus(f.id)}
              />
            ))}
          </FilterBar>

          {rows.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No invoices match these filters"
                description="Clear the status filter or search a different member."
                action={{ label: 'Show all invoices', onClick: () => { setStatus('all'); setQuery('') } }}
              />
            </div>
          ) : (
            <TableWrap className="max-h-[calc(100dvh-320px)]">
              <Table>
                <Thead>
                  <tr>
                    <Th sortable sortDir={dirFor('issued')} onSort={() => toggleSort('issued')} width={110}>
                      Issued
                    </Th>
                    <Th>Invoice</Th>
                    <Th sortable sortDir={dirFor('member')} onSort={() => toggleSort('member')}>
                      Member
                    </Th>
                    <Th>Plan</Th>
                    <Th sortable sortDir={dirFor('due')} onSort={() => toggleSort('due')} width={110}>
                      Due
                    </Th>
                    <Th align="right" sortable sortDir={dirFor('amount')} onSort={() => toggleSort('amount')} width={110}>
                      Amount
                    </Th>
                    <Th width={130}>Status</Th>
                    <Th width={40} />
                  </tr>
                </Thead>
                <Tbody>
                  {rows.map((invoice) => (
                    <Tr key={invoice.id}>
                      <Td muted className="tnum">{shortDate(invoice.issuedDate)}</Td>
                      <Td>
                        <Link
                          href={`/billing/invoices/${invoice.id}`}
                          className="font-mono text-micro text-primary underline-offset-2 hover:underline"
                        >
                          {invoice.id}
                        </Link>
                      </Td>
                      <Td>
                        <CellStack primary={invoice.memberName} secondary={invoice.description} />
                      </Td>
                      <Td muted>{invoice.planName}</Td>
                      <Td className="tnum">
                        {invoice.overdueDays > 0 ? (
                          <span className="text-danger">{invoice.overdueDays}d late</span>
                        ) : (
                          <span className="text-muted-foreground">{shortDate(invoice.dueDate)}</span>
                        )}
                      </Td>
                      <Td align="right" className="tnum font-medium">
                        {money(invoice.amount)}
                        {invoice.reversed !== 0 ? (
                          <span className="ml-1 text-micro text-muted-foreground">
                            {money(invoice.reversed)}
                          </span>
                        ) : null}
                      </Td>
                      <Td>
                        {invoice.status === 'refunded' ? (
                          <StatusChip tone="neutral" label="Refunded" title="Original row retained, reversal row paired" />
                        ) : (
                          <PaymentStatus status={invoice.status} />
                        )}
                      </Td>
                      <Td>
                        <Link
                          href={`/billing/invoices/${invoice.id}`}
                          aria-label={`Open ${invoice.id}`}
                          className="flex size-6 items-center justify-center rounded-sm text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100"
                        >
                          <ArrowUpRight className="size-3.5" />
                        </Link>
                      </Td>
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
