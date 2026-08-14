'use client'

import * as React from 'react'
import { Mail, Phone } from 'lucide-react'
import { Sheet, ConsequenceNotice } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Field, Select, Textarea } from '@/components/ui/input'
import { AgingChip, StatusChip } from '@/components/ui/status-chip'
import { DataPoint } from '@/components/ui/card'
import { fullDate, money } from '@/lib/format'
import type { LeadStage } from '@/lib/types'
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
  const [note, setNote] = React.useState('')
  const [reason, setReason] = React.useState<string>(LOSS_REASONS[0])

  React.useEffect(() => {
    setNote('')
    setReason(LOSS_REASONS[0])
  }, [lead?.id])

  if (!lead) return null
  const meta = stageMeta.get(lead.stage)

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
            <Button variant="primary">Open member record</Button>
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
            <Button variant="secondary" size="xs">
              <Phone />
              Call
            </Button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm text-foreground">{lead.email}</span>
            <Button variant="secondary" size="xs">
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

        <Field label="Note" htmlFor="lead-note" help="Visible to whoever picks this lead up next.">
          <Textarea
            id="lead-note"
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
            placeholder="What they asked for, what you promised, when to follow up."
          />
        </Field>
      </div>
    </Sheet>
  )
}
