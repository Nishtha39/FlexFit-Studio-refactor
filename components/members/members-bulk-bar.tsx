'use client'

import * as React from 'react'
import { Mail, UserPlus, Snowflake, Tag as TagIcon, Download } from 'lucide-react'
import { BulkActionBar } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, ConsequenceNotice } from '@/components/ui/modal'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { api } from '@/lib/api/client'
import { useStudio } from '@/lib/store/studio-store'
import type { Member } from '@/lib/types'
import { activeTrainers, getStaff } from '@/lib/data/staff'
import { getPlan } from '@/lib/data/plans'
import { compactMoney, num, pluralize } from '@/lib/format'
import { datedFilename, downloadCsv } from '@/lib/export'

/**
 * Bulk actions on the directory. Each one states its consequence before the
 * confirm button — including the money involved, because "freeze 14 members"
 * and "pause ₹48,600 of monthly revenue" are the same action described honestly.
 *
 * All five now write. Four of them loop the selection one member at a time
 * rather than sending a batch, which is deliberate: the API has no bulk
 * endpoint, and one row per member means a refusal on member 9 leaves members
 * 1-8 correctly changed instead of rolling back work that succeeded. The toast
 * reports both numbers when they differ, so a partial run is never presented as
 * a clean one.
 */

type Action = 'message' | 'assign' | 'freeze' | 'tag' | 'export'

interface RunResult {
  ok: number
  failed: number
}

export function MembersBulkBar({
  selectedMembers,
  onClear,
}: {
  selectedMembers: Member[]
  onClear: () => void
}) {
  const { mutate, connection, busy } = useStudio()
  const [action, setAction] = React.useState<Action | null>(null)
  const [trainerId, setTrainerId] = React.useState(activeTrainers[0]?.id ?? '')
  const [tag, setTag] = React.useState('follow-up')
  const [subject, setSubject] = React.useState('')
  const [body, setBody] = React.useState('')
  const [mailReady, setMailReady] = React.useState<{ configured: boolean; from: string } | null>(null)

  const count = selectedMembers.length
  const monthlyTotal = selectedMembers.reduce((sum, m) => sum + m.metrics.monthlyValue, 0)
  // Cancelled members are skipped by every send: they have left, and mailing
  // them is the kind of mistake that gets a studio reported.
  const reachable = selectedMembers.filter((m) => m.status !== 'cancelled')
  const freezable = selectedMembers.filter((m) => m.status === 'active')
  const label = pluralize(count, 'member')

  const close = () => setAction(null)

  React.useEffect(() => {
    if (action !== 'message') return
    setSubject('')
    setBody('')
    if (connection === 'live') {
      api.comms.emailStatus
        .query()
        .then((s) => setMailReady({ configured: s.configured, from: s.from }))
        .catch(() => setMailReady(null))
    }
  }, [action, connection])

  /**
   * Apply a write to each member in turn, counting successes and failures
   * instead of aborting on the first refusal.
   */
  async function each(members: Member[], fn: (m: Member) => Promise<unknown>): Promise<RunResult> {
    let ok = 0
    let failed = 0
    for (const m of members) {
      try {
        await fn(m)
        ok += 1
      } catch {
        failed += 1
      }
    }
    return { ok, failed }
  }

  function partial(result: RunResult, verb: string): string {
    return result.failed === 0
      ? ''
      : ` ${num(result.failed)} could not be ${verb} and ${result.failed === 1 ? 'was' : 'were'} left unchanged.`
  }

  /* ---------------------------------------------------------------------- */

  const sendMessage = () => {
    if (connection !== 'live' || reachable.length === 0) return
    void mutate(
      () =>
        api.comms.broadcast.mutate({
          memberIds: reachable.map((m) => m.id),
          subject: subject.trim(),
          body: body.trim(),
        }),
      {
        success: (r) => ({
          title: r.failed > 0 ? `Sent to ${num(r.sent)} of ${num(reachable.length)}` : `Message sent to ${pluralize(r.sent, 'member')}`,
          detail:
            r.failed > 0
              ? `${num(r.failed)} did not go out — check the addresses on those members.`
              : 'Delivered individually, so nobody sees anybody else’s address.',
        }),
      },
    ).then((r) => {
      if (r) {
        close()
        onClear()
      }
    })
  }

  const assignTrainer = () => {
    if (connection !== 'live') return
    const name = getStaff(trainerId)?.name ?? 'the trainer'
    void mutate(
      () => each(selectedMembers, (m) => api.ops.assignTrainer.mutate({ memberId: m.id, trainerId })),
      {
        success: (r) => ({
          title: `${pluralize(r.ok, 'member')} assigned to ${name}`,
          detail: `Their client count moves by ${num(r.ok)}.${partial(r, 'assigned')}`,
        }),
      },
    ).then((r) => {
      if (r) {
        close()
        onClear()
      }
    })
  }

  const applyTag = () => {
    if (connection !== 'live') return
    void mutate(
      () =>
        each(selectedMembers, (m) =>
          // Tags are a set on the member, and the endpoint replaces the list —
          // so the existing ones are sent back with the new one appended rather
          // than being silently dropped.
          api.ops.setMemberTags.mutate({ memberId: m.id, tags: [...m.tags, tag] }),
        ),
      {
        success: (r) => ({
          title: `“${tag}” added to ${pluralize(r.ok, 'member')}`,
          detail: `They are now findable under that tag in the directory filters.${partial(r, 'tagged')}`,
        }),
      },
    ).then((r) => {
      if (r) {
        close()
        onClear()
      }
    })
  }

  const freeze = () => {
    if (connection !== 'live' || freezable.length === 0) return
    void mutate(
      () =>
        each(freezable, (m) => api.ops.setMemberStatus.mutate({ memberId: m.id, status: 'frozen' })),
      {
        success: (r) => ({
          title: `${pluralize(r.ok, 'membership')} frozen`,
          detail: `${compactMoney(freezable.reduce((s, m) => s + m.metrics.monthlyValue, 0))}/mo paused.${partial(r, 'frozen')}`,
        }),
      },
    ).then((r) => {
      if (r) {
        close()
        onClear()
      }
    })
  }

  /**
   * Export is the one action that does not touch the server — the rows are
   * already on this machine, so it builds the file here. That also means it is
   * the only one that still works with the API unreachable.
   */
  const exportCsv = () => {
    downloadCsv(datedFilename('members'), selectedMembers, [
      { header: 'S.no', value: (_m, i) => i + 1 },
      { header: 'Name', value: (m) => m.name },
      { header: 'Email', value: (m) => m.email },
      { header: 'Phone', value: (m) => m.phone },
      { header: 'Status', value: (m) => m.status },
      { header: 'Plan', value: (m) => getPlan(m.planId)?.name ?? m.planId },
      { header: 'Home location', value: (m) => m.homeLocation },
      { header: 'Joined', value: (m) => m.joinedDate },
      { header: 'Monthly value', value: (m) => m.metrics.monthlyValue },
      { header: 'Lifetime value', value: (m) => m.metrics.lifetimeValue },
      { header: 'Visits (30d)', value: (m) => m.metrics.visitsLast30 },
      { header: 'Last visit', value: (m) => m.metrics.lastVisit ?? '' },
      { header: 'Risk', value: (m) => m.risk.score },
      {
        header: 'Trainer',
        value: (m) => (m.assignedTrainerId ? (getStaff(m.assignedTrainerId)?.name ?? m.assignedTrainerId) : ''),
      },
      { header: 'Tags', value: (m) => m.tags.join(' ') },
    ])
    close()
    onClear()
  }

  const messageValid = subject.trim().length > 0 && body.trim().length > 0

  return (
    <>
      <BulkActionBar count={count} onClear={onClear}>
        <Button variant="ghost" size="xs" onClick={() => setAction('message')}>
          <Mail className="size-3.5" />
          Message
        </Button>
        <Button variant="ghost" size="xs" onClick={() => setAction('assign')}>
          <UserPlus className="size-3.5" />
          Assign trainer
        </Button>
        <Button variant="ghost" size="xs" onClick={() => setAction('tag')}>
          <TagIcon className="size-3.5" />
          Tag
        </Button>
        <Button variant="ghost" size="xs" onClick={() => setAction('freeze')}>
          <Snowflake className="size-3.5" />
          Freeze
        </Button>
        <Button variant="ghost" size="xs" onClick={() => setAction('export')}>
          <Download className="size-3.5" />
          Export
        </Button>
      </BulkActionBar>

      {/* Message — the consequence is who will NOT receive it. */}
      <ConfirmDialog
        open={action === 'message'}
        onClose={close}
        onConfirm={sendMessage}
        title={`Message ${label}`}
        destructive={false}
        confirmDisabled={!messageValid || busy || connection !== 'live' || reachable.length === 0}
        confirmLabel={busy ? 'Sending…' : `Send to ${num(reachable.length)}`}
        consequenceTone={reachable.length === count ? 'info' : 'warn'}
        consequence={
          reachable.length === count
            ? `All ${num(count)} selected members will receive this message, sent one at a time so nobody sees anybody else's address.`
            : `${num(count - reachable.length)} of ${num(count)} are cancelled and will be skipped — ${num(reachable.length)} will receive it.`
        }
      >
        <div className="flex flex-col gap-3">
          {mailReady && !mailReady.configured ? (
            <ConsequenceNotice
              tone="danger"
              headline="Outbound email is not configured"
              detail="No RESEND_API_KEY is bound to this Worker, so sending will fail. Set it with `npx wrangler secret put RESEND_API_KEY` and add EMAIL_FROM for your verified domain."
            />
          ) : mailReady ? (
            <p className="text-micro text-muted-foreground">
              Sends for real, from <span className="font-mono">{mailReady.from}</span>.
            </p>
          ) : null}
          <Field label="Subject" htmlFor="bulk-subject">
            <Input id="bulk-subject" value={subject} onChange={(e) => setSubject(e.currentTarget.value)} />
          </Field>
          <Field label="Message" htmlFor="bulk-body" help="Sent as written — there is no merge field here.">
            <Textarea
              id="bulk-body"
              className="min-h-40"
              value={body}
              onChange={(e) => setBody(e.currentTarget.value)}
            />
          </Field>
        </div>
      </ConfirmDialog>

      {/* Assign trainer — reassignment overwrites an existing assignment. */}
      <ConfirmDialog
        open={action === 'assign'}
        onClose={close}
        onConfirm={assignTrainer}
        title={`Assign trainer to ${label}`}
        destructive={false}
        confirmDisabled={busy || connection !== 'live' || !trainerId}
        confirmLabel={busy ? 'Assigning…' : 'Assign'}
        consequenceTone="warn"
        consequence={(() => {
          const already = selectedMembers.filter((m) => m.assignedTrainerId !== null).length
          return already > 0
            ? `${pluralize(already, 'member')} already has a trainer — this replaces that assignment.`
            : 'None of the selected members currently have a trainer.'
        })()}
      >
        <Field label="Trainer" htmlFor="bulk-trainer">
          <Select
            id="bulk-trainer"
            value={trainerId}
            onChange={(e) => setTrainerId(e.currentTarget.value)}
          >
            {activeTrainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {t.specialties.join(', ')}
              </option>
            ))}
          </Select>
        </Field>
      </ConfirmDialog>

      {/* Tag — additive and reversible, so this is the one non-destructive flow. */}
      <ConfirmDialog
        open={action === 'tag'}
        onClose={close}
        onConfirm={applyTag}
        title={`Tag ${label}`}
        destructive={false}
        confirmDisabled={busy || connection !== 'live' || tag.trim().length === 0}
        confirmLabel={busy ? 'Applying…' : 'Apply tag'}
        consequenceTone="info"
        consequence="Tags are additive and can be removed later. No billing or access changes."
      >
        <Field label="Tag" htmlFor="bulk-tag">
          <Select id="bulk-tag" value={tag} onChange={(e) => setTag(e.currentTarget.value)}>
            <option value="follow-up">follow-up</option>
            <option value="win-back">win-back</option>
            <option value="vip">vip</option>
            <option value="corporate">corporate</option>
            <option value="at-risk">at-risk</option>
          </Select>
        </Field>
      </ConfirmDialog>

      {/* Freeze — states the revenue paused, not just the row count. */}
      <ConfirmDialog
        open={action === 'freeze'}
        onClose={close}
        onConfirm={freeze}
        title={`Freeze ${label}`}
        confirmDisabled={busy || connection !== 'live' || freezable.length === 0}
        confirmLabel={busy ? 'Freezing…' : `Freeze ${num(freezable.length)}`}
        consequenceTone="danger"
        consequence={
          freezable.length === count
            ? `Billing stops and access is revoked for ${label} — ${compactMoney(monthlyTotal)} of monthly revenue is paused.`
            : `${num(count - freezable.length)} of ${num(count)} are not active memberships and will be skipped. ${num(freezable.length)} will be frozen, pausing ${compactMoney(freezable.reduce((s, m) => s + m.metrics.monthlyValue, 0))} a month.`
        }
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          Frozen members keep their remaining credits and tenure. Unfreezing restarts billing on the
          next cycle date, not today.
        </p>
      </ConfirmDialog>

      {/* Export — states exactly what leaves the building. */}
      <ConfirmDialog
        open={action === 'export'}
        onClose={close}
        onConfirm={exportCsv}
        title={`Export ${label}`}
        destructive={false}
        confirmLabel="Download CSV"
        consequenceTone="warn"
        consequence="The file includes names, emails and phone numbers — personal data leaving the system, onto this device."
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          One row per selected member with their plan, status, visit counts, risk score and tags. It
          downloads straight to this device; nothing is uploaded anywhere.
        </p>
      </ConfirmDialog>
    </>
  )
}
