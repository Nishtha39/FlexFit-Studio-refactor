'use client'

import * as React from 'react'
import { GripVertical, Plus } from 'lucide-react'
import { PageHeader, PageBody } from '@/components/shell/page-header'
import { RequireScreen } from '@/components/shell/app-shell'
import { Card, KpiTile } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AgingChip, StatusChip } from '@/components/ui/status-chip'
import { Field, Select, Textarea } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api/client'
import { useDataVersion, useStudio } from '@/lib/store/studio-store'
import { AddLeadDialog } from './add-lead-dialog'
import { compactMoney, money, num, percent } from '@/lib/format'
import type { LeadStage } from '@/lib/types'
import { LeadPanel } from './lead-panel'
import {
  conversionRate,
  groupByStage,
  leadCards,
  openPipelineValue,
  SOURCE_LABELS,
  STAGES,
  type LeadCard,
} from './leads-data'

/** The reasons the loss-reason breakdown is grouped on. */
const LOST_REASONS = [
  'Price',
  'Location / commute',
  'Went to a competitor',
  'Timing — not now',
  'Never responded',
  'Not a fit',
]

/**
 * Lead board. Stage is a commitment, so moving a card is a real action with a
 * consequence — dragging is the fast path, the card menu is the accessible one,
 * and both go through the same handler.
 *
 * The move writes to the database. It used to be `setCards` and a toast, which
 * meant a stage change survived exactly as long as the tab did — and the
 * pipeline value it moved was recomputed from cards nobody else could see.
 */
export function LeadsBoard() {
  const { mutate } = useStudio()
  const version = useDataVersion()
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [dragging, setDragging] = React.useState<string | null>(null)
  const [dropTarget, setDropTarget] = React.useState<LeadStage | null>(null)
  const [addOpen, setAddOpen] = React.useState(false)
  /** A move to `lost` is held here until a reason is given — the server needs it. */
  const [losing, setLosing] = React.useState<LeadCard | null>(null)
  const [lostReason, setLostReason] = React.useState(LOST_REASONS[0])
  const [lostNote, setLostNote] = React.useState('')

  // Read straight through the live binding rather than copying into state:
  // `rebuild()` refreshes it after every write, so there is only ever one
  // version of the board.
  const cards = React.useMemo(() => leadCards, [version])
  const selected = React.useMemo(() => cards.find((c) => c.id === selectedId) ?? null, [cards, selectedId])

  const columns = React.useMemo(() => groupByStage(cards), [cards])
  const open = cards.filter((c) => c.stage !== 'won' && c.stage !== 'lost')
  const late = open.filter((c) => c.late)

  async function commitMove(lead: LeadCard, stage: LeadStage, reason?: string) {
    await mutate(
      () => api.crm.moveStage.mutate({ leadId: lead.id, stage, lostReason: reason }),
      {
        success: () => ({
          title: `${lead.name} → ${STAGES.find((s) => s.id === stage)?.label}`,
          detail: stage === 'lost' ? reason : STAGES.find((s) => s.id === stage)?.nextAction,
        }),
      },
    )
  }

  const move = (lead: LeadCard, stage: LeadStage) => {
    if (lead.stage === stage) return
    // Losing a lead without a reason would leave a hole in the loss-reason
    // report, so the board asks before it writes rather than after.
    if (stage === 'lost') {
      setLostReason(LOST_REASONS[0])
      setLostNote('')
      setLosing(lead)
      return
    }
    void commitMove(lead, stage)
  }

  return (
    <RequireScreen screen="leads">
      <PageHeader
        title="Leads"
        crumbs={[{ label: 'FlexFit Studio', href: '/dashboard' }, { label: 'Leads' }]}
        meta={
          <>
            <span className="tnum">{num(open.length)} open</span>
            <span aria-hidden>·</span>
            <span className="tnum">{compactMoney(openPipelineValue(cards))}/mo in play</span>
            <span aria-hidden>·</span>
            <span className={cn('tnum', late.length > 0 && 'text-danger')}>{num(late.length)} past SLA</span>
          </>
        }
        actions={
          <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
            <Plus />
            Add lead
          </Button>
        }
        sticky={false}
      />

      <PageBody>
        <Card className="grid grid-cols-2 lg:grid-cols-4">
          <KpiTile label="Open leads" value={num(open.length)} footnote="Across four working stages" />
          <KpiTile label="Pipeline value" value={compactMoney(openPipelineValue(cards))} footnote="Monthly value if all convert" />
          <KpiTile label="Past SLA" value={num(late.length)} footnote="Sitting longer than the stage allows" />
          <KpiTile
            label="Close rate"
            value={percent(conversionRate(cards))}
            footnote={`${num(cards.filter((c) => c.stage === 'won').length)} won of closed`}
          />
        </Card>

        <div className="grid gap-3 lg:grid-cols-6">
          {STAGES.map((stage) => {
            const items = columns[stage.id]
            const value = items.reduce((s, c) => s + c.estValue, 0)
            const isTarget = dropTarget === stage.id
            return (
              <section
                key={stage.id}
                aria-label={`${stage.label}, ${items.length} leads`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDropTarget(stage.id)
                }}
                onDragLeave={() => setDropTarget((prev) => (prev === stage.id ? null : prev))}
                onDrop={() => {
                  const lead = cards.find((c) => c.id === dragging)
                  if (lead) move(lead, stage.id)
                  setDragging(null)
                  setDropTarget(null)
                }}
                className={cn(
                  'flex min-h-40 flex-col rounded-md border bg-subtle transition-colors duration-150 ease-[var(--ease-ui)]',
                  isTarget ? 'border-primary bg-primary-soft' : 'border-border',
                )}
              >
                <header className="flex items-center justify-between gap-2 border-b border-border px-2.5 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{stage.label}</p>
                    <p className="text-micro text-muted-foreground tnum">
                      {num(items.length)} · {compactMoney(value)}
                    </p>
                  </div>
                  {items.some((c) => c.late) ? (
                    <StatusChip tone="warn" label={`${items.filter((c) => c.late).length} late`} />
                  ) : null}
                </header>

                <ul className="flex flex-1 flex-col gap-1.5 p-1.5">
                  {items.map((lead) => (
                    <li key={lead.id}>
                      <article
                        draggable
                        onDragStart={() => setDragging(lead.id)}
                        onDragEnd={() => setDragging(null)}
                        className={cn(
                          'group/card flex flex-col gap-1.5 rounded-sm border border-border bg-surface p-2',
                          'transition-colors duration-150 ease-[var(--ease-ui)] hover:border-border-strong',
                          dragging === lead.id && 'opacity-50',
                        )}
                      >
                        <div className="flex items-start gap-1.5">
                          <GripVertical
                            aria-hidden
                            className="mt-px size-3.5 shrink-0 cursor-grab text-muted-foreground/60"
                          />
                          <button
                            type="button"
                            onClick={() => setSelectedId(lead.id)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <span className="block truncate text-sm font-medium text-foreground">{lead.name}</span>
                            <span className="block truncate text-micro text-muted-foreground">
                              {SOURCE_LABELS[lead.source]} · {lead.planName ?? 'no plan yet'}
                            </span>
                          </button>
                        </div>
                        <div className="flex items-center justify-between gap-1.5 pl-5">
                          <span className="text-micro text-foreground tnum">{money(lead.estValue)}/mo</span>
                          <span
                            aria-hidden
                            title={lead.ownerName}
                            className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-[9px] font-semibold text-muted-foreground"
                          >
                            {lead.ownerInitials}
                          </span>
                        </div>
                        {stage.open ? (
                          <div className="pl-5">
                            <AgingChip days={lead.ageDays} />
                          </div>
                        ) : null}
                      </article>
                    </li>
                  ))}
                  {items.length === 0 ? (
                    <li className="flex flex-1 items-center justify-center px-2 py-6 text-center text-micro leading-relaxed text-muted-foreground">
                      {stage.id === 'lost' ? 'Nothing lost this month.' : 'Drop a lead here.'}
                    </li>
                  ) : null}
                </ul>
              </section>
            )
          })}
        </div>
      </PageBody>

      <LeadPanel lead={selected} onClose={() => setSelectedId(null)} onMove={move} />

      <AddLeadDialog open={addOpen} onClose={() => setAddOpen(false)} />

      <Modal
        open={losing !== null}
        onClose={() => setLosing(null)}
        title={losing ? `Mark ${losing.name} lost` : 'Mark lost'}
        description="The reason is what the loss-reason breakdown is built from, so it is required."
        footer={
          <>
            <Button variant="secondary" onClick={() => setLosing(null)}>
              Cancel
            </Button>
            <Button
              data-autofocus
              variant="danger"
              onClick={async () => {
                const lead = losing
                if (!lead) return
                setLosing(null)
                await commitMove(lead, 'lost', lostNote.trim() ? `${lostReason} — ${lostNote.trim()}` : lostReason)
              }}
            >
              Mark lost
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Reason" htmlFor="lost-reason">
            <Select id="lost-reason" value={lostReason} onChange={(e) => setLostReason(e.currentTarget.value)}>
              {LOST_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Anything else" htmlFor="lost-note" help="Optional. Added to the reason on the record.">
            <Textarea
              id="lost-note"
              className="min-h-20"
              value={lostNote}
              onChange={(e) => setLostNote(e.currentTarget.value)}
            />
          </Field>
        </div>
      </Modal>
    </RequireScreen>
  )
}
