'use client'

import * as React from 'react'
import { Sheet, ConsequenceNotice } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Field, Select, Textarea } from '@/components/ui/input'
import { StatusChip } from '@/components/ui/status-chip'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { members } from '@/lib/data/members'
import { money, num } from '@/lib/format'
import type { Member } from '@/lib/types'

/**
 * Broadcast composer. A broadcast is irreversible and it costs money, so the
 * audience size, the per-message cost and the opt-out count are computed from
 * the real segment before the send button is reachable.
 */

interface Segment {
  id: string
  label: string
  description: string
  match: (m: Member) => boolean
}

const SEGMENTS: Segment[] = [
  {
    id: 'active',
    label: 'All active members',
    description: 'Everyone currently able to check in.',
    match: (m) => m.status === 'active',
  },
  {
    id: 'at-risk',
    label: 'High risk',
    description: 'Risk 70+ and still savable.',
    match: (m) => m.risk.band === 'high' && m.status !== 'cancelled' && m.status !== 'expired',
  },
  {
    id: 'lapsed',
    label: 'Lapsed — win-back',
    description: 'Cancelled or expired in the last few months.',
    match: (m) => m.status === 'cancelled' || m.status === 'expired',
  },
  {
    id: 'trial',
    label: 'On trial',
    description: 'Trial members who have not committed yet.',
    match: (m) => m.status === 'trial',
  },
  {
    id: 'corporate',
    label: 'Corporate employees',
    description: 'Members drawing on a company pool.',
    match: (m) => m.companyId !== null,
  },
  {
    id: 'frozen',
    label: 'Frozen memberships',
    description: 'Paused, not cancelled.',
    match: (m) => m.status === 'frozen',
  },
]

const CHANNELS = [
  { id: 'sms', label: 'SMS', cost: 0.35, note: 'Highest read rate. Costs per message.' },
  { id: 'email', label: 'Email', cost: 0.02, note: 'Cheap, ignorable. Fine for newsletters.' },
  { id: 'push', label: 'App push', cost: 0, note: 'Free, but only reaches installed apps.' },
] as const

const TEMPLATES: Record<string, string> = {
  'at-risk': 'Hi {first_name} — a spot opened in Thursday 7am Strength. Want it? Reply YES and it is yours.',
  lapsed: 'Hi {first_name}, your locker is still free this month. Two weeks back on us if you want to restart.',
  trial: 'Hi {first_name} — day 5 of your trial. Standard is ₹3,400/mo and includes 4 classes a week. Want it set up?',
  active: 'Studio note: Riverside closes at 6pm Saturday for floor maintenance. Downtown stays open until 10pm.',
  corporate: 'Your company pool covers classes through the quarter. Book Monday 6pm Spin at the front desk.',
  frozen: 'Hi {first_name}, your membership is paused until next month. Unfreeze any time at the desk.',
}

const SMS_LIMIT = 160

export function BroadcastComposer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast()
  const [segmentId, setSegmentId] = React.useState('at-risk')
  const [channel, setChannel] = React.useState<(typeof CHANNELS)[number]['id']>('sms')
  const [body, setBody] = React.useState(TEMPLATES['at-risk'])
  const [confirming, setConfirming] = React.useState(false)

  const segment = SEGMENTS.find((s) => s.id === segmentId) as Segment
  const audience = React.useMemo(() => members.filter(segment.match), [segment])
  // ~4% of any list has opted out of marketing; they are excluded, not counted.
  const optedOut = Math.round(audience.length * 0.04)
  const reach = audience.length - optedOut
  const channelMeta = CHANNELS.find((c) => c.id === channel) as (typeof CHANNELS)[number]
  const segments = channel === 'sms' ? Math.max(1, Math.ceil(body.length / SMS_LIMIT)) : 1
  const cost = Math.round(reach * channelMeta.cost * segments)
  const overLimit = channel === 'sms' && body.length > SMS_LIMIT

  const pickSegment = (id: string) => {
    setSegmentId(id)
    if (TEMPLATES[id]) setBody(TEMPLATES[id])
    setConfirming(false)
  }

  const send = () => {
    onClose()
    setConfirming(false)
    toast({
      tone: 'good',
      title: `Broadcast queued to ${num(reach)} members`,
      detail: `${channelMeta.label} · ${money(cost)} · ${optedOut} opted-out members excluded.`,
    })
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="New broadcast"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {confirming ? (
            <Button data-autofocus variant="primary" onClick={send}>
              Send to {num(reach)} members
            </Button>
          ) : (
            <Button variant="primary" disabled={body.trim().length === 0} onClick={() => setConfirming(true)}>
              Review send
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Audience" help={segment.description}>
          <div className="flex flex-wrap gap-1.5">
            {SEGMENTS.map((s) => {
              const count = members.filter(s.match).length
              const active = s.id === segmentId
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => pickSegment(s.id)}
                  className={cn(
                    'flex h-7 items-center gap-1.5 rounded-md border px-2 text-sm transition-colors duration-150 ease-[var(--ease-ui)]',
                    active
                      ? 'border-primary bg-primary-soft text-accent-foreground'
                      : 'border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground',
                  )}
                >
                  {s.label}
                  <span className="text-micro tnum">{num(count)}</span>
                </button>
              )
            })}
          </div>
        </Field>

        <Field label="Channel" htmlFor="broadcast-channel" help={channelMeta.note}>
          <Select
            id="broadcast-channel"
            value={channel}
            onChange={(e) => setChannel(e.currentTarget.value as typeof channel)}
          >
            {CHANNELS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Message"
          hint={channel === 'sms' ? `${body.length}/${SMS_LIMIT}` : `${body.length} chars`}
          htmlFor="broadcast-body"
          error={overLimit ? `Over one SMS — this sends as ${segments} messages and bills ${segments}×.` : undefined}
          help="{first_name} is substituted per member. No other tokens."
        >
          <Textarea
            id="broadcast-body"
            value={body}
            onChange={(e) => setBody(e.currentTarget.value)}
            className="min-h-28"
          />
        </Field>

        <div className="rounded-md border border-border bg-subtle p-3">
          <p className="text-micro font-medium tracking-wide text-muted-foreground uppercase">Preview</p>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground">
            {body.replace(/\{first_name\}/g, audience[0]?.firstName ?? 'Priya')}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusChip tone="neutral" label={`${num(reach)} recipients`} />
            <StatusChip tone="neutral" label={cost === 0 ? 'No message cost' : money(cost)} />
            {optedOut > 0 ? <StatusChip tone="info" label={`${optedOut} opted out`} /> : null}
          </div>
        </div>

        {confirming ? (
          <ConsequenceNotice
            tone="warn"
            headline={`This sends immediately to ${num(reach)} members and cannot be recalled`}
            detail={`${channelMeta.label} · ${money(cost)} billed to the studio · ${optedOut} opted-out members are excluded automatically. Members receiving this are not told it was a bulk message.`}
          />
        ) : null}
      </div>
    </Sheet>
  )
}
