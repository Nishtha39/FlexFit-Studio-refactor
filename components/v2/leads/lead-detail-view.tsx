import { AlertTriangle, Check, Mail, Phone, X } from 'lucide-react'
import type { Lead, LeadStage, Staff } from '@/lib/v2/types'
import { dateStamp, money } from '@/lib/v2/format'
import { Badge } from '@/components/v2/ui/badge'
import { Button } from '@/components/v2/ui/button'
import { DetailPanel, DetailShell, type DetailStat } from '@/components/v2/shared/detail-shell'
import { cn } from '@/lib/v2/utils'

/** The happy path, in order. `lost` is deliberately not a step — see below. */
const PIPELINE: Exclude<LeadStage, 'lost'>[] = [
  'new',
  'contacted',
  'tour-booked',
  'trial',
  'won',
]

const STAGE_LABELS: Record<LeadStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  'tour-booked': 'Tour booked',
  trial: 'Trial',
  won: 'Won',
  lost: 'Lost',
}

const SOURCE_LABELS: Record<Lead['source'], string> = {
  'walk-in': 'Walk-in',
  referral: 'Referral',
  website: 'Website',
  instagram: 'Instagram',
  google: 'Google',
  corporate: 'Corporate',
}

/**
 * Horizontal pipeline. `lost` is not a position on the rail — a lost lead exited
 * from wherever it happened to be, so the rail renders inert and the outcome is
 * carried by the badge instead of faking a final step.
 */
function StageRail({ stage }: { stage: LeadStage }) {
  const lost = stage === 'lost'
  const currentIndex = lost ? -1 : PIPELINE.indexOf(stage as Exclude<LeadStage, 'lost'>)

  return (
    <ol className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {PIPELINE.map((s, i) => {
        const done = !lost && i < currentIndex
        const active = !lost && i === currentIndex
        return (
          <li key={s} className="flex flex-1 items-center gap-3">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  'grid size-7 shrink-0 place-items-center rounded-full border text-xs font-medium tabular-nums transition-colors',
                  done && 'border-transparent bg-lime text-ink',
                  active && 'border-transparent bg-brand text-white',
                  !done && !active && 'border-border bg-card text-muted-foreground',
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
              </span>
              <span
                className={cn(
                  'whitespace-nowrap text-sm',
                  active ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
                {STAGE_LABELS[s]}
                {active ? <span className="sr-only"> (current stage)</span> : null}
              </span>
            </div>
            {i < PIPELINE.length - 1 ? (
              <span
                className={cn(
                  'hidden h-px flex-1 sm:block',
                  done ? 'bg-lime' : 'bg-border',
                )}
                aria-hidden="true"
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

export function LeadDetailView({
  lead,
  owner,
  planName,
  isStale,
}: {
  lead: Lead
  owner?: Staff
  planName?: string
  isStale: boolean
}) {
  const closed = lead.stage === 'won' || lead.stage === 'lost'

  const stats: DetailStat[] = [
    {
      label: 'Est. monthly value',
      value: money(lead.estValue),
      hint: planName ? `Interested in ${planName}` : 'No plan chosen yet',
      tone: lead.stage === 'won' ? 'positive' : 'default',
    },
    {
      label: 'Age',
      value: `${lead.ageDays}d`,
      hint: isStale ? 'Past the 7-day follow-up window' : 'Within follow-up window',
      tone: isStale ? 'critical' : 'default',
    },
    { label: 'Source', value: SOURCE_LABELS[lead.source], hint: `Created ${dateStamp(lead.createdDate)}` },
    { label: 'Owner', value: owner?.name ?? 'Unassigned', hint: owner ? owner.role.replace('-', ' ') : 'Needs an owner' },
  ]

  return (
    <DetailShell
      backHref="/leads"
      backLabel="Back to leads"
      eyebrow={`Lead · ${SOURCE_LABELS[lead.source]}`}
      title={lead.name}
      subtitle={lead.note}
      badges={
        <>
          {lead.stage === 'won' ? (
            <Badge className="bg-lime text-ink">
              <Check className="mr-1 size-3" aria-hidden="true" />
              Won
            </Badge>
          ) : lead.stage === 'lost' ? (
            <Badge variant="secondary" className="text-muted-foreground">
              <X className="mr-1 size-3" aria-hidden="true" />
              Lost
            </Badge>
          ) : (
            <Badge className="bg-accent text-accent-foreground">{STAGE_LABELS[lead.stage]}</Badge>
          )}
          {isStale && !closed ? (
            <Badge className="bg-destructive text-destructive-foreground">
              <AlertTriangle className="mr-1 size-3" aria-hidden="true" />
              Going stale
            </Badge>
          ) : null}
        </>
      }
      actions={
        <>
          <Button variant="outline" className="rounded-full bg-card">
            Log a call
          </Button>
          <Button
            className="rounded-full bg-brand text-white hover:bg-brand/90"
            disabled={closed}
          >
            {closed ? 'Closed' : 'Advance stage'}
          </Button>
        </>
      }
      stats={stats}
    >
      <DetailPanel
        title="Pipeline"
        description={
          lead.stage === 'lost'
            ? 'This lead exited the pipeline before converting.'
            : 'Where this lead sits on the way to a membership.'
        }
      >
        <StageRail stage={lead.stage} />
      </DetailPanel>

      <div className="grid gap-4 lg:grid-cols-3">
        <DetailPanel title="Contact" description="Reach out directly." className="lg:col-span-1">
          <ul className="flex flex-col gap-3 text-sm">
            <li className="flex items-center gap-2.5">
              <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <a
                href={`mailto:${lead.email}`}
                className="min-w-0 truncate text-brand transition-opacity hover:opacity-80"
              >
                {lead.email}
              </a>
            </li>
            <li className="flex items-center gap-2.5">
              <Phone className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <a
                href={`tel:${lead.phone.replace(/\s/g, '')}`}
                className="text-brand transition-opacity hover:opacity-80"
              >
                {lead.phone}
              </a>
            </li>
          </ul>
        </DetailPanel>

        <DetailPanel
          title="Notes"
          description="What the team has learned so far."
          className="lg:col-span-2"
        >
          <p className="text-sm leading-relaxed text-pretty">{lead.note}</p>
          {isStale && !closed ? (
            <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-destructive/25 bg-destructive/5 p-3.5">
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0 text-destructive"
                aria-hidden="true"
              />
              <p className="text-sm leading-relaxed">
                No contact for {lead.ageDays} days. Leads past the 7-day window convert at a
                fraction of the rate — worth a call today.
              </p>
            </div>
          ) : null}
        </DetailPanel>
      </div>
    </DetailShell>
  )
}
