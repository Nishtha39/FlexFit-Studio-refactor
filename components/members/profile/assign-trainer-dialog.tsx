'use client'

import * as React from 'react'
import { api } from '@/lib/api/client'
import { useDataVersion, useStudio } from '@/lib/store/studio-store'
import { ConfirmDialog } from '@/components/ui/modal'
import { Field, Select } from '@/components/ui/input'
import { activeTrainers, getStaff } from '@/lib/data/staff'
import { members as allMembers } from '@/lib/data/members'
import { num } from '@/lib/format'
import type { Member } from '@/lib/types'

/** Live client load, counted off the roster rather than a stored column. */
function clientCount(trainerId: string): number {
  return allMembers.filter((m) => m.assignedTrainerId === trainerId && m.status !== 'cancelled').length
}

/**
 * Assign or reassign the trainer who owns a member relationship.
 *
 * The list is active trainers only. Assigning somebody to a departed trainer is
 * how a member ends up with nobody actually watching their attendance — which is
 * the whole reason this field exists — and the server refuses it anyway.
 *
 * "Unassign" is offered explicitly rather than hidden, because leaving a
 * departed trainer attached is worse than an honest gap: an empty field shows up
 * on the retention queue, a stale name does not.
 */
export function AssignTrainerDialog({
  open,
  onClose,
  member,
}: {
  open: boolean
  onClose: () => void
  member: Member
}) {
  const { mutate, connection, busy } = useStudio()
  const version = useDataVersion()
  const current = member.assignedTrainerId ? getStaff(member.assignedTrainerId) : null
  const [trainerId, setTrainerId] = React.useState<string>('')

  const trainers = React.useMemo(() => activeTrainers, [version])

  React.useEffect(() => {
    if (!open) return
    // Default to keeping the current trainer if they are still here, otherwise
    // to whoever carries the fewest clients — the reassignment after a departure
    // is the common case, and spreading the load is the sensible default.
    const stillHere = trainers.some((t) => t.id === member.assignedTrainerId)
    if (stillHere && member.assignedTrainerId) {
      setTrainerId(member.assignedTrainerId)
      return
    }
    const lightest = [...trainers].sort((a, b) => clientCount(a.id) - clientCount(b.id))[0]
    setTrainerId(lightest?.id ?? '')
  }, [open, member.assignedTrainerId, trainers])

  const changed = trainerId !== (member.assignedTrainerId ?? '')
  const next = trainerId ? getStaff(trainerId) : null

  function submit() {
    if (!changed || connection !== 'live') return
    void mutate(
      () =>
        api.ops.assignTrainer.mutate({
          memberId: member.id,
          trainerId: trainerId === '' ? null : trainerId,
        }),
      {
        success: () => ({
          title: next ? `${member.name} assigned to ${next.name}` : `${member.name} unassigned`,
          detail: next
            ? `${next.name} now carries ${num(clientCount(next.id))} clients.`
            : 'Nobody owns this relationship now — they will show on the retention queue as unassigned.',
        }),
      },
    ).then((r) => {
      if (r) onClose()
    })
  }

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={submit}
      title={current ? `Reassign ${member.name}` : `Assign a trainer to ${member.name}`}
      description={current ? `Currently with ${current.name}` : 'Nobody owns this relationship yet.'}
      destructive={false}
      confirmDisabled={!changed || busy || connection !== 'live'}
      confirmLabel={busy ? 'Saving…' : trainerId ? 'Assign' : 'Unassign'}
      consequenceTone={current && !current.active ? 'danger' : 'info'}
      consequence={
        current && !current.active
          ? `${current.name} has left. Members reassigned late after a departure are the largest churn cohort in this data — do it before their next session.`
          : 'The trainer sees them on their client list and is accountable for noticing when they stop coming.'
      }
    >
      <Field
        label="Trainer"
        htmlFor="assign-trainer"
        help="Client counts update the moment this is saved."
      >
        <Select
          id="assign-trainer"
          value={trainerId}
          onChange={(e) => setTrainerId(e.currentTarget.value)}
        >
          <option value="">Nobody — leave unassigned</option>
          {trainers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} — {num(clientCount(t.id))} clients · {t.specialties.join(', ')}
            </option>
          ))}
        </Select>
      </Field>
    </ConfirmDialog>
  )
}
