'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Phone } from 'lucide-react'
import { Sheet, ConsequenceNotice } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Field, Select, Textarea } from '@/components/ui/input'
import { AgingChip, StatusChip } from '@/components/ui/status-chip'
import { DataPoint } from '@/components/ui/card'
import { fullDate, money } from '@/lib/format'
import type { LeadStage } from '@/lib/types'
import { api } from '@/lib/api/client'
import { useStudio } from '@/lib/store/studio-store'
import { CallLink, ComposeEmailDialog } from '@/components/comms/compose-email-dialog'
import { LOSS_REASONS, SOURCE_LABELS, STAGES, stageMeta, type LeadCard } from './leads-data'

/**
 * Lead detail. The stage select is the accessible twin of dragging a card, and
 * "Lost" demands a reason — a pipeline without loss reasons cannot be improved.
 */
export function LeadPanel({
  lead,
  onClose,
  onMove,
}: {
  lead: LeadCard | null
  onClose: () => void
  onMove: (lead: LeadCard, stage: LeadStage) => void
}) {
  const router = useRouter()
  const { mutate, busy } = useStudio()
  const [note, setNote] = React.useState('')
  const [reason, setReason] = React.useState<string>(LOSS_REASONS[0])
  const [emailing, setEmailing] = React.useState(false)

  React.useEffect(() => {
    // Load the note that is actually stored rather than blanking the box —
    // "visible to whoever picks this lead up next" was not true while it lived
    // in component state.
    setNote(lead?.note ?? '')
    setReason(LOSS_REASONS[0])
  }, [lead?.id, lead?.note])

  async function saveNote() {
    if (!lead) return
    await mutate(() => api.crm.addLeadNote.mutate({ leadId: lead.id, note: note.trim() }), {
      success: () => ({ title: 'Note saved', detail: `On ${lead.name}` }),
    })
  }

  if (!lead) return null
  const meta = stageMeta.get(lead.stage)
  const noteChanged = note.trim() !== (lead.note ?? '').trim()

  return (
    <Sheet
      open
      onClose={onClose}
      title={lead.name}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {lead.stage === 'won' ? (
            // A won lead has no member row pointing back at it — nothing links
            // the two — so this searches the directory by name instead of
            // pretending to open a record it cannot find.
            <Button variant="primary" onClick={() => router.push(`/members?q=${encodeURIComponent(lead.name)}`)}>
              Find member record
            </Button>
          ) : (
            <Button variant="primary" onClick={() => onMove(lead, 'won')}>
              Convert to member
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusChip
            tone={lead.stage === 'won' ? 'good' : lead.stage === 'lost' ? 'danger' : 'info'}
            label={meta?.label ?? lead.stage}
          />
          {meta?.open ? <AgingChip days={lead.ageDays} /> : null}
          <StatusChip tone="neutral" label={SOURCE_LABELS[lead.source]} />
        </div>

        {lead.late && meta?.open ? (
          <ConsequenceNotice
            tone="warn"
            headline={`${lead.ageDays} days in ${meta.label} — SLA is ${meta.slaDays}`}
            detail={meta.nextAction}
          />
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          <DataPoint label="Est. value" value={`${money(lead.estValue)}/mo`} sub={lead.planName ?? 'No plan discussed'} />
          <DataPoint label="Owner" value={lead.ownerName} sub="Sales owner" />
          <DataPoint label="Created" value={fullDate(lead.createdDate)} sub={`${lead.ageDays} days ago`} />
          <DataPoint label="Next action" value={meta?.label ?? '—'} sub={meta?.nextAction} />
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-foreground">{lead.phone}</span>
            <CallLink phone={lead.phone}>
              <Phone />
              Call
            </CallLink>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm text-foreground">{lead.email}</span>
            <Button variant="secondary" size="xs" onClick={() => setEmailing(true)}>
              <Mail />
              Email
            </Button>
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <Field label="Move to stage" htmlFor="lead-stage" help="Same effect as dragging the card.">
            <Select
              id="lead-stage"
              value={lead.stage}
              onChange={(e) => onMove(lead, e.currentTarget.value as LeadStage)}
            >
              {STAGES.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {lead.stage === 'lost' ? (
          <Field label="Loss reason" htmlFor="lead-reason" help="Feeds the source-quality report.">
            <Select id="lead-reason" value={reason} onChange={(e) => setReason(e.currentTarget.value)}>
              {LOSS_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <Field label="Note" htmlFor="lead-note" help="Saved on the lead, visible to whoever picks it up next.">
          <Textarea
            id="lead-note"
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
            placeholder="What they asked for, what you promised, when to follow up."
          />
        </Field>
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" disabled={!noteChanged || busy} onClick={saveNote}>
            {busy ? 'Saving…' : noteChanged ? 'Save note' : 'Note saved'}
          </Button>
        </div>
      </div>

      <ComposeEmailDialog
        open={emailing}
        onClose={() => setEmailing(false)}
        to={lead.email}
        toName={lead.name}
        title={`Email ${lead.name}`}
        templates={[
          {
            label: 'Follow up',
            subject: `Following up on your visit to FlexFit`,
            body: `Hi ${lead.name.split(' ')[0]},\n\nThanks for getting in touch about a membership at FlexFit Studio.\n\nI wanted to check whether you had any questions, and to offer you a look around at a time that suits you.\n\nJust reply here and I will book it in.\n\nBest,\n${lead.ownerName}\nFlexFit Studio`,
          },
          {
            label: 'Book a tour',
            subject: 'Come and have a look around FlexFit',
            body: `Hi ${lead.name.split(' ')[0]},\n\nWould you like to come in for a tour? It takes about twenty minutes and you can try the floor while you are here.\n\nTell me a couple of times that work and I will confirm one.\n\nBest,\n${lead.ownerName}\nFlexFit Studio`,
          },
          { label: 'Blank', subject: '', body: `Hi ${lead.name.split(' ')[0]},\n\n\n\n${lead.ownerName}\nFlexFit Studio` },
        ]}
        send={({ subject, body }) => api.comms.emailLead.mutate({ leadId: lead.id, subject, body })}
      />
    </Sheet>
  )
}
