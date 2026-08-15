'use client'

import * as React from 'react'
import { api } from '@/lib/api/client'
import { useStudio } from '@/lib/store/studio-store'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { Modal, ConsequenceNotice } from '@/components/ui/modal'
import { money } from '@/lib/format'
import { EQUIPMENT_CATEGORY_LABELS } from '@/lib/data/equipment'
import { locations } from '@/lib/data'
import { isoDate, NOW } from '@/lib/seed'
import { EQUIPMENT_CATEGORIES, slotsForDay, unitsFreeAt } from './equipment-data'
import type { Equipment, EquipmentFault } from '@/lib/types'

/**
 * Every equipment write goes through one of these. They all follow the same
 * shape — collect input, call the procedure through `mutate`, let the store
 * re-read and re-render — so a failure surfaces the server's own reason and a
 * success cannot be shown over a change that did not happen.
 */

/** Add or edit an asset. Status is absent on purpose: the fault log owns it. */
export function EquipmentFormDialog({
  open,
  onClose,
  asset,
}: {
  open: boolean
  onClose: () => void
  asset?: Equipment
}) {
  const { mutate, busy } = useStudio()
  const editing = Boolean(asset)

  const [form, setForm] = React.useState(() => defaults(asset))
  // Re-seed the form whenever a different asset is opened; without this the
  // dialog would keep the previous asset's values on second open.
  React.useEffect(() => {
    if (open) setForm(defaults(asset))
  }, [open, asset])

  const set = <K extends keyof ReturnType<typeof defaults>>(key: K, value: ReturnType<typeof defaults>[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const total = form.unitCost * form.quantity

  async function submit() {
    const result = await mutate(
      () =>
        api.equipment.save.mutate({
          ...(asset ? { id: asset.id } : {}),
          name: form.name.trim(),
          category: form.category,
          make: form.make.trim(),
          model: form.model.trim(),
          assetTag: form.assetTag.trim(),
          location: form.location,
          zone: form.zone.trim(),
          quantity: form.quantity,
          purchaseDate: form.purchaseDate,
          unitCost: form.unitCost,
          usefulLifeMonths: form.usefulLifeMonths,
          serviceIntervalDays: form.serviceIntervalDays,
          bookable: form.bookable,
          slotMinutes: form.slotMinutes,
          notes: form.notes.trim(),
        }),
      {
        success: (r) => ({
          title: r.created ? 'Equipment added' : 'Equipment updated',
          detail: `${form.name} · ${form.assetTag} · ${form.quantity} unit${form.quantity === 1 ? '' : 's'}`,
        }),
      },
    )
    if (result) onClose()
  }

  const valid = form.name.trim().length > 0 && form.assetTag.trim().length > 0 && form.zone.trim().length > 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? `Edit ${asset!.name}` : 'Add equipment'}
      description={
        editing
          ? 'Status is not editable here — it follows the open fault log. Use “Take off floor” to change it.'
          : 'The purchase is logged as the first service entry, so lifetime spend on this asset starts correct.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!valid || busy} onClick={submit}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Add equipment'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="eq-name" className="sm:col-span-2">
          <Input id="eq-name" value={form.name} onChange={(e) => set('name', e.currentTarget.value)} />
        </Field>
        <Field label="Category" htmlFor="eq-cat">
          <Select
            id="eq-cat"
            value={form.category}
            onChange={(e) => set('category', e.currentTarget.value as Equipment['category'])}
          >
            {EQUIPMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EQUIPMENT_CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Asset tag" htmlFor="eq-tag" help="Stencilled on the frame — what staff read off the machine.">
          <Input
            id="eq-tag"
            value={form.assetTag}
            className="font-mono"
            onChange={(e) => set('assetTag', e.currentTarget.value)}
          />
        </Field>
        <Field label="Make" htmlFor="eq-make">
          <Input id="eq-make" value={form.make} onChange={(e) => set('make', e.currentTarget.value)} />
        </Field>
        <Field label="Model" htmlFor="eq-model">
          <Input id="eq-model" value={form.model} onChange={(e) => set('model', e.currentTarget.value)} />
        </Field>
        <Field label="Location" htmlFor="eq-loc">
          <Select
            id="eq-loc"
            value={form.location}
            onChange={(e) => set('location', e.currentTarget.value as Equipment['location'])}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.shortName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Zone" htmlFor="eq-zone" help="Where on the floor: Rig 1, Cardio deck, Studio B.">
          <Input id="eq-zone" value={form.zone} onChange={(e) => set('zone', e.currentTarget.value)} />
        </Field>

        <Field
          label="Quantity"
          htmlFor="eq-qty"
          help="Identical units on one line. 8 treadmills = quantity 8, not 8 rows."
        >
          <Input
            id="eq-qty"
            type="number"
            min={1}
            className="tnum"
            value={form.quantity}
            onChange={(e) => set('quantity', Math.max(1, Number(e.currentTarget.value) || 1))}
          />
        </Field>
        <Field label="Unit cost (₹)" htmlFor="eq-cost" help={`${money(total)} total for ${form.quantity}`}>
          <Input
            id="eq-cost"
            type="number"
            min={0}
            className="tnum"
            value={form.unitCost}
            onChange={(e) => set('unitCost', Math.max(0, Number(e.currentTarget.value) || 0))}
          />
        </Field>
        <Field label="Purchased" htmlFor="eq-date">
          <Input
            id="eq-date"
            type="date"
            value={form.purchaseDate}
            onChange={(e) => set('purchaseDate', e.currentTarget.value)}
          />
        </Field>
        <Field
          label="Useful life (months)"
          htmlFor="eq-life"
          help="Straight-line depreciation to zero over this period."
        >
          <Input
            id="eq-life"
            type="number"
            min={1}
            className="tnum"
            value={form.usefulLifeMonths}
            onChange={(e) => set('usefulLifeMonths', Math.max(1, Number(e.currentTarget.value) || 1))}
          />
        </Field>
        <Field label="Service every (days)" htmlFor="eq-svc" help="Drives the next-service date and the overdue queue.">
          <Input
            id="eq-svc"
            type="number"
            min={1}
            className="tnum"
            value={form.serviceIntervalDays}
            onChange={(e) => set('serviceIntervalDays', Math.max(1, Number(e.currentTarget.value) || 1))}
          />
        </Field>

        <div className="sm:col-span-2 rounded-md border border-border bg-subtle p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={form.bookable}
              onChange={(e) => set('bookable', e.currentTarget.checked)}
              className="size-3.5 accent-[var(--color-primary)]"
            />
            Members can reserve this
          </label>
          <p className="mt-1 text-micro text-muted-foreground">
            Courts, reformers, saunas and sled lanes. Free-weight racks and treadmills are usually walk-up.
          </p>
          {form.bookable ? (
            <Field label="Slot length (minutes)" htmlFor="eq-slot" className="mt-3 max-w-40">
              <Select
                id="eq-slot"
                value={String(form.slotMinutes)}
                onChange={(e) => set('slotMinutes', Number(e.currentTarget.value))}
              >
                {[15, 30, 45, 60, 90].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
        </div>

        <Field label="Notes" htmlFor="eq-notes" className="sm:col-span-2">
          <Textarea id="eq-notes" value={form.notes} onChange={(e) => set('notes', e.currentTarget.value)} />
        </Field>
      </div>
    </Modal>
  )
}

function defaults(asset?: Equipment) {
  return {
    name: asset?.name ?? '',
    category: asset?.category ?? ('cardio' as Equipment['category']),
    make: asset?.make ?? '',
    model: asset?.model ?? '',
    assetTag: asset?.assetTag ?? '',
    location: asset?.location ?? ('downtown' as Equipment['location']),
    zone: asset?.zone ?? '',
    quantity: asset?.quantity ?? 1,
    purchaseDate: asset?.purchaseDate ?? isoDate(NOW),
    unitCost: asset?.unitCost ?? 0,
    usefulLifeMonths: asset?.usefulLifeMonths ?? 84,
    serviceIntervalDays: asset?.serviceIntervalDays ?? 90,
    bookable: asset?.bookable ?? false,
    slotMinutes: asset?.slotMinutes ?? 30,
    notes: asset?.notes ?? '',
  }
}

/**
 * Report a fault. Open to trainers and members as well as the owner — the
 * person who finds a frayed cable is whoever was standing next to it.
 */
export function ReportFaultDialog({
  open,
  onClose,
  asset,
  reporterId,
  reporterLabel,
}: {
  open: boolean
  onClose: () => void
  asset: Equipment | undefined
  reporterId: string
  reporterLabel: string
}) {
  const { mutate, busy } = useStudio()
  const [severity, setSeverity] = React.useState<'minor' | 'major' | 'unsafe'>('minor')
  const [summary, setSummary] = React.useState('')

  React.useEffect(() => {
    if (open) {
      setSeverity('minor')
      setSummary('')
    }
  }, [open])

  if (!asset) return null

  async function submit() {
    const result = await mutate(
      () =>
        api.equipment.reportFault.mutate({
          equipmentId: asset!.id,
          reportedBy: reporterId,
          severity,
          summary: summary.trim(),
        }),
      {
        success: (r) => ({
          title: 'Fault reported',
          detail:
            r.status === 'out-of-service'
              ? `${asset!.name} taken off the floor${r.cancelledReservations > 0 ? ` — ${r.cancelledReservations} reservation${r.cancelledReservations === 1 ? '' : 's'} cancelled` : ''}.`
              : `${asset!.name} flagged for service.`,
        }),
      },
    )
    if (result) onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Report a fault — ${asset.name}`}
      description={`${asset.assetTag} · ${asset.zone}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" disabled={summary.trim().length < 3 || busy} onClick={submit}>
            {busy ? 'Reporting…' : 'Report fault'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Severity" htmlFor="fault-sev">
          <Select
            id="fault-sev"
            value={severity}
            onChange={(e) => setSeverity(e.currentTarget.value as typeof severity)}
          >
            <option value="minor">Minor — usable, worth looking at</option>
            <option value="major">Major — degraded, needs a fix soon</option>
            <option value="unsafe">Unsafe — nobody should use it</option>
          </Select>
        </Field>

        {severity === 'unsafe' ? (
          <ConsequenceNotice
            tone="danger"
            headline="This takes the machine off the floor immediately"
            detail="Its status becomes Out of service and every upcoming reservation against it is cancelled. That happens on submit, not later."
          />
        ) : null}

        <Field label="What is wrong?" htmlFor="fault-summary" help={`Filed as ${reporterLabel}.`}>
          <Textarea
            id="fault-summary"
            value={summary}
            placeholder="Belt slipping under load above 12 km/h"
            onChange={(e) => setSummary(e.currentTarget.value)}
          />
        </Field>
      </div>
    </Modal>
  )
}

/** Resolve an open fault. A resolution note is required — that is the log. */
export function ResolveFaultDialog({
  open,
  onClose,
  fault,
  assetName,
}: {
  open: boolean
  onClose: () => void
  fault: EquipmentFault | undefined
  assetName: string
}) {
  const { mutate, busy } = useStudio()
  const [note, setNote] = React.useState('')

  React.useEffect(() => {
    if (open) setNote('')
  }, [open])

  if (!fault) return null

  async function submit() {
    const result = await mutate(
      () =>
        api.equipment.updateFault.mutate({
          faultId: fault!.id,
          status: 'resolved',
          resolutionNote: note.trim(),
        }),
      { success: () => ({ title: 'Fault resolved', detail: `${assetName} — ${note.trim()}` }) },
    )
    if (result) onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Resolve fault"
      description={fault.summary}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={note.trim().length < 3 || busy} onClick={submit}>
            {busy ? 'Saving…' : 'Mark resolved'}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
        Resolving the last open fault on this asset returns it to service automatically. If an unsafe fault is
        still open, it stays off the floor.
      </p>
      <Field label="What fixed it?" htmlFor="resolve-note">
        <Textarea
          id="resolve-note"
          value={note}
          placeholder="Belt replaced under warranty, re-tensioned and tested"
          onChange={(e) => setNote(e.currentTarget.value)}
        />
      </Field>
    </Modal>
  )
}

/** Log a service visit. This is the only thing that moves the service clock. */
export function LogServiceDialog({
  open,
  onClose,
  asset,
}: {
  open: boolean
  onClose: () => void
  asset: Equipment | undefined
}) {
  const { mutate, busy } = useStudio()
  const [kind, setKind] = React.useState<'routine' | 'repair' | 'inspection'>('routine')
  const [vendor, setVendor] = React.useState('')
  const [cost, setCost] = React.useState(0)
  const [note, setNote] = React.useState('')

  React.useEffect(() => {
    if (open) {
      setKind('routine')
      setVendor('')
      setCost(0)
      setNote('')
    }
  }, [open])

  if (!asset) return null

  async function submit() {
    const result = await mutate(
      () =>
        api.equipment.logService.mutate({
          equipmentId: asset!.id,
          kind,
          vendor: vendor.trim(),
          cost,
          note: note.trim(),
        }),
      {
        success: () => ({
          title: 'Service logged',
          detail: `${asset!.name} — next service due in ${asset!.serviceIntervalDays} days`,
        }),
      },
    )
    if (result) onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Log service — ${asset.name}`}
      description={`${asset.assetTag} · serviced every ${asset.serviceIntervalDays} days`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={vendor.trim().length === 0 || busy} onClick={submit}>
            {busy ? 'Saving…' : 'Log service'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kind" htmlFor="svc-kind">
          <Select id="svc-kind" value={kind} onChange={(e) => setKind(e.currentTarget.value as typeof kind)}>
            <option value="routine">Routine service</option>
            <option value="repair">Repair</option>
            <option value="inspection">Safety inspection</option>
          </Select>
        </Field>
        <Field label="Vendor" htmlFor="svc-vendor">
          <Input id="svc-vendor" value={vendor} placeholder="FitCare Maintenance" onChange={(e) => setVendor(e.currentTarget.value)} />
        </Field>
        <Field label="Cost (₹)" htmlFor="svc-cost" help="Counts toward maintenance spend, not book value.">
          <Input
            id="svc-cost"
            type="number"
            min={0}
            className="tnum"
            value={cost}
            onChange={(e) => setCost(Math.max(0, Number(e.currentTarget.value) || 0))}
          />
        </Field>
        <Field label="Note" htmlFor="svc-note" className="sm:col-span-2">
          <Textarea id="svc-note" value={note} onChange={(e) => setNote(e.currentTarget.value)} />
        </Field>
      </div>
    </Modal>
  )
}

/** Member (or staff on their behalf) reserves a slot. */
export function ReserveDialog({
  open,
  onClose,
  asset,
  memberId,
  memberName,
}: {
  open: boolean
  onClose: () => void
  asset: Equipment | undefined
  memberId: string
  memberName: string
}) {
  const { mutate, busy } = useStudio()
  const [date, setDate] = React.useState(isoDate(NOW))
  const [startTime, setStartTime] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setDate(isoDate(NOW))
      setStartTime(null)
    }
  }, [open])

  if (!asset) return null

  const slots = slotsForDay(asset)

  async function submit() {
    if (!startTime) return
    const result = await mutate(
      () =>
        api.equipment.reserve.mutate({
          equipmentId: asset!.id,
          memberId,
          date,
          startTime,
        }),
      {
        success: () => ({
          title: 'Reserved',
          detail: `${asset!.name} · ${date} at ${startTime} · ${asset!.slotMinutes} min`,
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
      title={`Reserve ${asset.name}`}
      description={`${asset.zone} · ${asset.slotMinutes}-minute slots · ${asset.quantity} unit${asset.quantity === 1 ? '' : 's'}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!startTime || busy} onClick={submit}>
            {busy ? 'Reserving…' : startTime ? `Reserve ${startTime}` : 'Pick a slot'}
          </Button>
        </>
      }
    >
      <Field label="Date" htmlFor="res-date" className="mb-4 max-w-48">
        <Input
          id="res-date"
          type="date"
          min={isoDate(NOW)}
          value={date}
          onChange={(e) => {
            setDate(e.currentTarget.value)
            setStartTime(null)
          }}
        />
      </Field>

      <p className="mb-2 text-micro font-medium tracking-wide text-muted-foreground uppercase">
        Available slots · booking as {memberName}
      </p>
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
        {slots.map((slot) => {
          // Same function the server enforces with, so a slot shown as free
          // cannot be refused as taken.
          const free = unitsFreeAt(asset, date, slot)
          const selected = startTime === slot
          return (
            <button
              key={slot}
              type="button"
              disabled={free === 0}
              onClick={() => setStartTime(slot)}
              aria-pressed={selected}
              className={[
                'flex flex-col items-center rounded-sm border px-1 py-1.5 text-micro tnum transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
                free === 0
                  ? 'cursor-not-allowed border-border bg-muted text-muted-foreground/60 line-through'
                  : selected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-surface text-foreground hover:border-border-strong',
              ].join(' ')}
            >
              <span className="font-medium">{slot}</span>
              {asset.quantity > 1 && free > 0 ? (
                <span className={selected ? 'opacity-80' : 'text-muted-foreground'}>{free} free</span>
              ) : null}
            </button>
          )
        })}
      </div>
    </Modal>
  )
}
