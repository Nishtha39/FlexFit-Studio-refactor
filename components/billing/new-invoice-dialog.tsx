'use client'

import * as React from 'react'
import { useDataVersion } from '@/lib/store/studio-store'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
import { MemberStatus } from '@/components/ui/status-chip'
import { TakePaymentDialog } from '@/components/members/profile/member-actions'
import { lookup } from '@/components/kiosk/kiosk-engine'
import { getPlan } from '@/lib/data/plans'
import type { Member } from '@/lib/types'

/**
 * "New invoice" — pick who it is for, then take the payment.
 *
 * There is no invoices table, and that is on purpose: an invoice IS the set of
 * payment rows that share an invoiceId, which is what makes gross, refunds and
 * net reconcile by replaying the ledger. So "new invoice" cannot be a row
 * insert into something called invoices; it is a charge against a member, and
 * the server mints the invoice id with it.
 *
 * This is therefore a member picker in front of the same Take-payment dialog the
 * desk and the member profile use. One code path for taking money, so a charge
 * raised here and one taken at the desk cannot behave differently.
 */
export function NewInvoiceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const version = useDataVersion()
  const [query, setQuery] = React.useState('')
  const [chosen, setChosen] = React.useState<Member | null>(null)

  React.useEffect(() => {
    if (open) {
      setQuery('')
      setChosen(null)
    }
  }, [open])

  const results = React.useMemo(
    () => (query.trim().length > 0 ? lookup(query, 8) : []),
    [query, version],
  )

  if (chosen) {
    return (
      <TakePaymentDialog
        open
        onClose={() => {
          setChosen(null)
          onClose()
        }}
        member={chosen}
      />
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New invoice"
      description="Charge a member. The invoice number is issued with the payment."
      footer={
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Member" htmlFor="invoice-member" help="Search by name, phone or member PIN.">
          <Input
            id="invoice-member"
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            placeholder="e.g. Priya, 98200, 4417"
          />
        </Field>

        {query.trim().length > 0 && results.length === 0 ? (
          <EmptyState
            title="Nobody matches that"
            description="Try a surname or the last four digits of their phone number."
          />
        ) : (
          <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {results.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setChosen(m)}
                  className="flex w-full items-center justify-between gap-3 rounded-md border border-border px-2.5 py-2 text-left transition-colors duration-150 hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">{m.name}</span>
                    <span className="block truncate text-micro text-muted-foreground">
                      {getPlan(m.planId)?.name ?? m.planId} · {m.email}
                    </span>
                  </span>
                  <MemberStatus status={m.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
