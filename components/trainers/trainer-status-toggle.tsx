'use client'

import * as React from 'react'
import { api } from '@/lib/api/client'
import { useStudio } from '@/lib/store/studio-store'
import { Button } from '@/components/ui/button'
import { StatusChip } from '@/components/ui/status-chip'
import { Field, Input } from '@/components/ui/input'
import { ConsequenceNotice, Modal } from '@/components/ui/modal'
import { fullDate, num } from '@/lib/format'
import { isoDate, NOW } from '@/lib/seed'
import type { Staff } from '@/lib/types'

/**
 * The trainer Active / Inactive control.
 *
 * This was a read-only chip: it rendered the flag and there was no way to
 * change it, which is why it "did not work". It is now a real toggle, and the
 * two things it has to get right are:
 *
 *  1. **`active` and `activeTo` move together.** `active` is defined as "has no
 *     departure date" — that is how lib/data/staff.ts builds the seed. Setting
 *     one without the other produces a row that says Active and Left 21 Mar
 *     2025 at the same time.
 *  2. **It does not silently reassign their work.** The dialog reports how many
 *     classes and clients are still pointing at this person, because that is a
 *     decision for a human. Auto-reassigning would also erase the evidence for
 *     the March attendance step-down the dashboard explains.
 */
export function TrainerStatusCell({ trainer }: { trainer: Staff }) {
  const [open, setOpen] = React.useState(false)
  const { busy } = useStudio()

  return (
    <>
      <span className="flex items-center gap-1.5">
        {trainer.active ? (
          <StatusChip tone="good" label="Active" />
        ) : (
          <StatusChip
            tone="neutral"
            label={trainer.activeTo ? `Left ${fullDate(trainer.activeTo)}` : 'Inactive'}
            title="Departure drives the March attendance step-down"
          />
        )}
        <Button
          size="xs"
          variant="ghost"
          disabled={busy}
          aria-label={`${trainer.active ? 'Deactivate' : 'Reactivate'} ${trainer.name}`}
          onClick={() => setOpen(true)}
        >
          {trainer.active ? 'Deactivate' : 'Reactivate'}
        </Button>
      </span>
      <TrainerStatusDialog trainer={trainer} open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export function TrainerStatusDialog({
  trainer,
  open,
  onClose,
}: {
  trainer: Staff
  open: boolean
  onClose: () => void
}) {
  const { mutate, busy } = useStudio()
  const goingInactive = trainer.active
  const [leaveDate, setLeaveDate] = React.useState(isoDate(NOW))

  React.useEffect(() => {
    if (open) setLeaveDate(isoDate(NOW))
  }, [open])

  async function confirm() {
    const result = await mutate(
      () =>
        api.ops.setStaffActive.mutate({
          staffId: trainer.id,
          active: !trainer.active,
          ...(goingInactive ? { activeTo: leaveDate } : {}),
        }),
      {
        success: (r) => ({
          title: r.active ? `${r.name} is active again` : `${r.name} marked inactive`,
          detail: r.active
            ? 'They count toward active trainers and seat-fill again.'
            : `${num(r.classesStillAssigned)} classes and ${num(r.clientsStillAssigned)} clients are still assigned to them.`,
        }),
      },
    )
    if (result) onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={goingInactive ? `Mark ${trainer.name} inactive` : `Reactivate ${trainer.name}`}
      description={trainer.email}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-autofocus
            variant={goingInactive ? 'danger' : 'primary'}
            disabled={busy}
            onClick={confirm}
          >
            {busy ? 'Saving…' : goingInactive ? 'Mark inactive' : 'Reactivate'}
          </Button>
        </>
      }
    >
      {goingInactive ? (
        <>
          <ConsequenceNotice
            tone="warn"
            headline="Their classes and clients are NOT reassigned"
            detail="They stay on the roster and keep their schedule so the gap is visible. Cover has to be arranged on the schedule screen — this only records that they have left."
          />
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            They stop counting toward active trainers, weekly contact hours and the seat-fill denominator on
            this screen, and drop out of report recipients.
          </p>
          <Field label="Last day" htmlFor="leave-date" className="mt-4 max-w-48">
            <Input
              id="leave-date"
              type="date"
              value={leaveDate}
              onChange={(e) => setLeaveDate(e.currentTarget.value)}
            />
          </Field>
        </>
      ) : (
        <p className="text-sm leading-relaxed text-muted-foreground">
          Their departure date is cleared and they return to the active roster, counting again toward contact
          hours, seat fill and the assigned-members total.
        </p>
      )}
    </Modal>
  )
}
