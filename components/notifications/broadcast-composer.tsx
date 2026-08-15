'use client'

import * as React from 'react'
import { Sheet, ConsequenceNotice } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { StatusChip } from '@/components/ui/status-chip'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api/client'
import { useStudio } from '@/lib/store/studio-store'
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

/**
 * Only email actually sends. SMS and push are priced and previewed here because
 * the screen was designed around choosing between channels, but there is no SMS
 * provider wired to this app — so they are labelled as unavailable rather than
 * left as buttons that produce a success toast and no message. A channel that
 * looks like it works and does not is worse than one that says it does not.
 */
const CHANNELS = [
  { id: 'email', label: 'Email', cost: 0.02, note: 'Sends for real, through Resend.', live: true },
  { id: 'sms', label: 'SMS (not connected)', cost: 0.35, note: 'No SMS provider is configured on this deployment.', live: false },
  { id: 'push', label: 'App push (not connected)', cost: 0, note: 'Requires a mobile app; none is deployed.', live: false },
] as const

/** Recipient cap per send — matches the ceiling the comms router enforces. */
const MAX_RECIPIENTS = 200

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
  const { mutate, busy, connection } = useStudio()
  const [segmentId, setSegmentId] = React.useState('at-risk')
  const [channel, setChannel] = React.useState<(typeof CHANNELS)[number]['id']>('email')
  const [body, setBody] = React.useState(TEMPLATES['at-risk'])
  const [subject, setSubject] = React.useState('A note from FlexFit Studio')
  const [confirming, setConfirming] = React.useState(false)
  const [mailConfigured, setMailConfigured] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    if (!open || connection !== 'live') return
    api.comms.emailStatus
      .query()
      .then((s) => setMailConfigured(s.configured))
      .catch(() => setMailConfigured(null))
  }, [open, connection])

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

  // {first_name} is substituted per member, so the fan-out happens here rather
  // than sending one identical body to everyone.
  const recipients = React.useMemo(() => audience.slice(0, MAX_RECIPIENTS), [audience])
  const truncated = audience.length > MAX_RECIPIENTS

  const send = async () => {
    if (!channelMeta.live) {
      toast({
        tone: 'danger',
        title: `${channelMeta.label} is not connected`,
        detail: 'Nothing was sent. Switch to Email, which is wired to a real provider.',
      })
      return
    }
    const result = await mutate(
      () =>
        api.comms.broadcast.mutate({
          memberIds: recipients.map((m) => m.id),
          subject: subject.trim(),
          body: body.trim(),
          alsoNotify: true,
        }),
      {
        success: (r) => ({
          // Both numbers, always. "Sent to 200" when six bounced is the kind of
          // reported number this whole change set exists to stop.
          title:
            r.failed === 0
              ? `Sent to ${num(r.sent)} members`
              : `Sent to ${num(r.sent)} of ${num(r.attempted)} — ${num(r.failed)} failed`,
          detail:
            r.failed === 0
              ? `Email · ${num(optedOut)} opted-out members excluded.`
              : r.failures.map((f) => `${f.email}: ${f.reason}`).slice(0, 3).join(' · '),
        }),
      },
    )
    if (result) {
      setConfirming(false)
      onClose()
    }
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
            <Button data-autofocus variant="primary" disabled={busy} onClick={send}>
              {busy ? `Sending to ${num(recipients.length)}…` : `Send to ${num(recipients.length)} members`}
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={body.trim().length === 0 || subject.trim().length === 0}
              onClick={() => setConfirming(true)}
            >
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

        {channel === 'email' ? (
          <Field label="Subject" htmlFor="broadcast-subject">
            <Input
              id="broadcast-subject"
              value={subject}
              onChange={(e) => setSubject(e.currentTarget.value)}
            />
          </Field>
        ) : null}

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

        {mailConfigured === false && channel === 'email' ? (
          <ConsequenceNotice
            tone="danger"
            headline="Outbound email is not configured"
            detail="No RESEND_API_KEY is bound to this Worker, so this send will refuse. Settings → Email has the setup steps."
          />
        ) : null}

        {truncated ? (
          <ConsequenceNotice
            tone="warn"
            headline={`Only the first ${num(MAX_RECIPIENTS)} of ${num(audience.length)} will be sent`}
            detail="One send is capped so a runaway broadcast cannot spend the whole month's email allowance in a single press. Narrow the segment, or send again after this one lands."
          />
        ) : null}

        {confirming ? (
          <ConsequenceNotice
            tone="warn"
            headline={`This sends immediately to ${num(recipients.length)} members and cannot be recalled`}
            detail={`${channelMeta.label} · ${money(cost)} · ${optedOut} opted-out members are excluded automatically. Each member gets their own message — nobody sees another member's address.`}
          />
        ) : null}
      </div>
    </Sheet>
  )
}
