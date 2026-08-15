'use client'

import * as React from 'react'
import { api } from '@/lib/api/client'
import { useStudio } from '@/lib/store/studio-store'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { money } from '@/lib/format'
import { plans } from '@/lib/data/plans'
import { staff } from '@/lib/data/staff'
import type { LeadSource } from '@/lib/types'

const SOURCES: { id: LeadSource; label: string }[] = [
  { id: 'walk-in', label: 'Walk-in' },
  { id: 'referral', label: 'Referral' },
  { id: 'website', label: 'Website' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'google', label: 'Google' },
  { id: 'corporate', label: 'Corporate' },
]

/**
 * Add a lead to the board.
 *
 * Every lead starts in `new`. The board's SLA clock measures how long a lead
 * has sat in its stage, so letting someone enter one straight into `trial`
 * would start it with time nobody actually spent — and the "past SLA" count is
 * the number staff work from.
 *
 * The monthly value is asked for rather than assumed. Naming a plan fills it in
 * from the price, but the pipeline total is only worth reading if the figure
 * behind it is one somebody stands behind.
 */
export function AddLeadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutate, busy } = useStudio()
  const owners = staff.filter((s) => s.active && s.role !== 'trainer')
  const sellable = plans.filter((p) => p.active && !p.corporateOnly)

  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [source, setSource] = React.useState<LeadSource>('walk-in')
  const [ownerId, setOwnerId] = React.useState(owners[0]?.id ?? '')
  const [planId, setPlanId] = React.useState('')
  const [estValue, setEstValue] = React.useState(0)
  const [note, setNote] = React.useState('')

  React.useEffect(() => {
    if (!open) return
    setName('')
    setEmail('')
    setPhone('')
    setSource('walk-in')
    setOwnerId(owners[0]?.id ?? '')
    setPlanId('')
    setEstValue(0)
    setNote('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  /** Naming a plan offers its price; typing over it wins. */
  function pickPlan(id: string) {
    setPlanId(id)
    const p = sellable.find((x) => x.id === id)
    if (p) setEstValue(p.interval === 'annual' ? Math.round(p.price / 12) : p.price)
  }

  const emailLooksReal = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const valid =
    name.trim().length > 0 && emailLooksReal && phone.trim().length >= 4 && ownerId.length > 0 && estValue > 0

  async function submit() {
    const result = await mutate(
      () =>
        api.crm.createLead.mutate({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          source,
          ownerId,
          estValue,
          interestedPlanId: planId || null,
          note: note.trim(),
        }),
      {
        success: (r) => ({
          title: `${r.name} added to the board`,
          detail: `New · ${money(estValue)}/mo if they convert`,
        }),
      },
    )
    if (result) onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Add lead"
      description="Starts in New, owned by whoever is going to chase it."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!valid || busy} onClick={submit}>
            {busy ? 'Saving…' : 'Add lead'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Name" htmlFor="al-name">
          <Input id="al-name" value={name} onChange={(e) => setName(e.currentTarget.value)} autoFocus />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Email"
            htmlFor="al-email"
            error={email.length > 0 && !emailLooksReal ? 'That does not look like an email address.' : undefined}
          >
            <Input id="al-email" type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
          </Field>
          <Field label="Phone" htmlFor="al-phone">
            <Input id="al-phone" value={phone} onChange={(e) => setPhone(e.currentTarget.value)} placeholder="+91 98765 43210" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Source" htmlFor="al-source" help="Drives the source-mix report.">
            <Select id="al-source" value={source} onChange={(e) => setSource(e.currentTarget.value as LeadSource)}>
              {SOURCES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Owner" htmlFor="al-owner" help="The SLA clock runs against them.">
            <Select id="al-owner" value={ownerId} onChange={(e) => setOwnerId(e.currentTarget.value)}>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Interested in" htmlFor="al-plan" help="Optional. Fills in the value below.">
            <Select id="al-plan" value={planId} onChange={(e) => pickPlan(e.currentTarget.value)}>
              <option value="">Not sure yet</option>
              {sellable.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {money(p.price)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Value if they convert (₹/mo)"
            htmlFor="al-value"
            help="Counted in the pipeline total on the board."
          >
            <Input
              id="al-value"
              type="number"
              min={0}
              className="tnum"
              value={estValue}
              onChange={(e) => setEstValue(Math.max(0, Number(e.currentTarget.value) || 0))}
            />
          </Field>
        </div>

        <Field label="Note" htmlFor="al-note" help="What they came in for, what to say when you call.">
          <Textarea id="al-note" className="min-h-24" value={note} onChange={(e) => setNote(e.currentTarget.value)} />
        </Field>
      </div>
    </Modal>
  )
}
