'use client'

import * as React from 'react'
import { api } from '@/lib/api/client'
import { useDataVersion, useStudio } from '@/lib/store/studio-store'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/input'
import { ConsequenceNotice, Modal } from '@/components/ui/modal'
import { StatusChip } from '@/components/ui/status-chip'
import { EmptyState } from '@/components/ui/empty-state'
import { ComposeEmailDialog } from '@/components/comms/compose-email-dialog'
import { memberById } from '@/lib/data/members'
import { staff as allStaff } from '@/lib/data/staff'
import { num } from '@/lib/format'
import { isoDate, NOW } from '@/lib/seed'
import type { Staff } from '@/lib/types'
import { slotClock, slotDate, type Occurrence } from '@/components/schedule/schedule-engine'

/**
 * Mark who actually turned up.
 *
 * A booking is an intention; a check-in is the fact, and the risk model, the
 * heatmap and every visit count are built on check-ins. So this writes real
 * check-ins for the members ticked, one per member — the same call the kiosk
 * makes, which is why a member who already walked past the desk is not counted
 * twice (the id is deterministic on member + instant, and the server counts only
 * rows it actually inserted).
 *
 * Members whose membership is not live are shown but cannot be ticked: the
 * server refuses their check-in, and a tick that silently fails is worse than a
 * disabled one that says why.
 */
export function MarkAttendanceDialog({
  open,
  onClose,
  occurrence,
}: {
  open: boolean
  onClose: () => void
  occurrence: Occurrence
}) {
  const { mutate, connection, busy } = useStudio()
  const version = useDataVersion()
  const [ticked, setTicked] = React.useState<Set<string>>(new Set())

  const roster = React.useMemo(
    () =>
      occurrence.gymClass.roster
        .map((id) => memberById.get(id))
        .filter((m): m is NonNullable<typeof m> => m !== undefined),
    [occurrence, version],
  )

  const eligible = React.useMemo(
    () => roster.filter((m) => m.status === 'active' || m.status === 'trial'),
    [roster],
  )

  React.useEffect(() => {
    if (!open) return
    // Default to everybody who can be marked. A full class turning up is the
    // normal case, so the quick path is untick-the-absentees.
    setTicked(new Set(eligible.map((m) => m.id)))
  }, [open, eligible])

  // A past class is the only one worth marking — the trainer does it after the
  // session, and marking a class that has not run yet records attendance for
  // something nobody attended.
  const notYet = occurrence.isoDate > isoDate(NOW)

  const toggle = (id: string) =>
    setTicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  function submit() {
    if (connection !== 'live' || ticked.size === 0) return
    const present = eligible.filter((m) => ticked.has(m.id))
    void mutate(
      async () => {
        let recorded = 0
        let already = 0
        for (const m of present) {
          const r = await api.ops.checkIn.mutate({
            memberId: m.id,
            location: occurrence.gymClass.location,
            classId: occurrence.classId,
          })
          if (r.duplicate) already += 1
          else recorded += 1
        }
        return { recorded, already }
      },
      {
        success: (r) => ({
          title: `${num(r.recorded)} marked present`,
          detail:
            r.already > 0
              ? `${num(r.already)} had already checked in at the desk and were not counted twice. ${num(eligible.length - present.length)} marked absent.`
              : `${num(eligible.length - present.length)} marked absent. Their visit counts and risk scores update from this.`,
        }),
      },
    ).then((r) => {
      if (r) onClose()
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Attendance — ${occurrence.gymClass.name}`}
      description={`${slotDate(occurrence.start)} at ${slotClock(occurrence.start)} · ${num(roster.length)} booked`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={ticked.size === 0 || busy || notYet || connection !== 'live'}
            onClick={submit}
          >
            {busy ? 'Recording…' : `Mark ${num(ticked.size)} present`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {notYet ? (
          <ConsequenceNotice
            tone="warn"
            headline="This class has not run yet"
            detail="Attendance is recorded after the session — marking it now would put visits on the record for a class nobody has attended."
          />
        ) : null}

        {roster.length === 0 ? (
          <EmptyState title="Nobody is booked" description="There is no roster to mark." />
        ) : (
          <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {roster.map((m) => {
              const blocked = m.status !== 'active' && m.status !== 'trial'
              return (
                <li key={m.id}>
                  <label
                    className={`flex items-center gap-2.5 rounded-md border border-border px-2.5 py-2 ${
                      blocked ? 'bg-subtle' : ''
                    }`}
                  >
                    <Checkbox
                      checked={ticked.has(m.id)}
                      disabled={blocked || notYet}
                      onChange={() => toggle(m.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-foreground">{m.name}</span>
                      {blocked ? (
                        <span className="block text-micro text-muted-foreground">
                          Membership is {m.status} — check-in is blocked
                        </span>
                      ) : null}
                    </span>
                    {blocked ? <StatusChip tone="warn" label={m.status} /> : null}
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Modal>
  )
}

/**
 * Ask for cover.
 *
 * There is no cover-request entity and inventing one would be a bigger claim
 * than this screen can honour — nothing would process it. What actually happens
 * in a studio is that the trainer messages whoever runs the rota, so that is
 * what this does: a real email to a real manager, prefilled with the class,
 * the date and the number of members affected.
 */
export function RequestCoverDialog({
  open,
  onClose,
  occurrence,
  trainer,
}: {
  open: boolean
  onClose: () => void
  occurrence: Occurrence
  trainer: Staff
}) {
  const version = useDataVersion()

  // Whoever owns the rota: the manager if there is one, else the owner.
  const recipient = React.useMemo(() => {
    const active = allStaff.filter((s) => s.active)
    return active.find((s) => s.role === 'manager') ?? active.find((s) => s.role === 'owner') ?? null
  }, [version])

  if (!recipient) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Request cover"
        description="Nobody to send this to."
        footer={
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        }
      >
        <ConsequenceNotice
          tone="warn"
          headline="No manager or owner is on the active staff list"
          detail="A cover request goes to whoever runs the rota. Add a manager in Settings → Staff and this will have somewhere to go."
        />
      </Modal>
    )
  }

  const when = `${slotDate(occurrence.start)} at ${slotClock(occurrence.start)}`
  const booked = occurrence.gymClass.roster.length

  return (
    <ComposeEmailDialog
      open={open}
      onClose={onClose}
      to={recipient.email}
      toName={recipient.name}
      title={`Request cover — ${occurrence.gymClass.name}`}
      send={({ subject, body }) =>
        api.comms.emailStaff.mutate({ staffId: recipient.id, subject, body })
      }
      templates={[
        {
          label: 'Cover request',
          subject: `Cover needed: ${occurrence.gymClass.name}, ${when}`,
          body: `Hi ${recipient.firstName},\n\nI need cover for ${occurrence.gymClass.name} on ${when} at ${occurrence.gymClass.location.replace('-', ' ')}.\n\n${booked} member${booked === 1 ? ' is' : 's are'} booked in, so it needs somebody rather than cancelling if possible.\n\nThanks,\n${trainer.name}`,
        },
        {
          label: 'Ask to cancel',
          subject: `${occurrence.gymClass.name} on ${when} — cancel?`,
          body: `Hi ${recipient.firstName},\n\nI cannot make ${occurrence.gymClass.name} on ${when} and I have not found cover.\n\n${booked} member${booked === 1 ? ' is' : 's are'} booked in. Can we cancel it and let them know, or is there somebody free?\n\nThanks,\n${trainer.name}`,
        },
      ]}
    />
  )
}
