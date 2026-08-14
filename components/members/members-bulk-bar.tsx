'use client'

import * as React from 'react'
import { Mail, UserPlus, Snowflake, Tag as TagIcon, Download } from 'lucide-react'
import { BulkActionBar } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/modal'
import { Field, Select } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import type { Member } from '@/lib/types'
import { activeTrainers } from '@/lib/data/staff'
import { compactMoney, num, pluralize } from '@/lib/format'

/**
 * Bulk actions on the directory. Each one states its consequence before the
 * confirm button — including the money involved, because "freeze 14 members"
 * and "pause ₹48,600 of monthly revenue" are the same action described honestly.
 */

type Action = 'message' | 'assign' | 'freeze' | 'tag' | 'export'

export function MembersBulkBar({
  selectedMembers,
  onClear,
}: {
  selectedMembers: Member[]
  onClear: () => void
}) {
  const { toast } = useToast()
  const [action, setAction] = React.useState<Action | null>(null)
  const [trainerId, setTrainerId] = React.useState(activeTrainers[0]?.id ?? '')
  const [tag, setTag] = React.useState('follow-up')

  const count = selectedMembers.length
  const monthlyTotal = selectedMembers.reduce((sum, m) => sum + m.metrics.monthlyValue, 0)
  const reachable = selectedMembers.filter((m) => m.status !== 'cancelled').length
  const label = pluralize(count, 'member')

  const close = () => setAction(null)

  const run = (title: string, detail: string) => {
    toast({ tone: 'good', title, detail, action: { label: 'Undo', onClick: () => {} } })
    onClear()
  }

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
        onConfirm={() =>
          run('Message queued', `Sending to ${pluralize(reachable, 'member')} in the next batch.`)
        }
        title={`Message ${label}`}
        destructive={false}
        confirmLabel={`Send to ${num(reachable)}`}
        consequenceTone={reachable === count ? 'info' : 'warn'}
        consequence={
          reachable === count
            ? `All ${num(count)} selected members will receive this message.`
            : `${num(count - reachable)} of ${num(count)} are cancelled and will be skipped — ${num(reachable)} will receive it.`
        }
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          Composing the message body is part of the broadcast composer. This queues the audience.
        </p>
      </ConfirmDialog>

      {/* Assign trainer — reassignment overwrites an existing assignment. */}
      <ConfirmDialog
        open={action === 'assign'}
        onClose={close}
        onConfirm={() => {
          const name = activeTrainers.find((t) => t.id === trainerId)?.name ?? 'trainer'
          run('Trainer assigned', `${label} now assigned to ${name}.`)
        }}
        title={`Assign trainer to ${label}`}
        destructive={false}
        confirmLabel="Assign"
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
        onConfirm={() => run('Tag applied', `"${tag}" added to ${label}.`)}
        title={`Tag ${label}`}
        destructive={false}
        confirmLabel="Apply tag"
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
        onConfirm={() =>
          run('Memberships frozen', `${label} frozen. ${compactMoney(monthlyTotal)}/mo paused.`)
        }
        title={`Freeze ${label}`}
        confirmLabel={`Freeze ${num(count)}`}
        consequenceTone="danger"
        consequence={`Billing stops and access is revoked for ${label} — ${compactMoney(monthlyTotal)} of monthly revenue is paused.`}
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
        onConfirm={() => run('Export ready', `${label} exported as CSV.`)}
        title={`Export ${label}`}
        destructive={false}
        confirmLabel="Download CSV"
        consequenceTone="warn"
        consequence="The file includes names, emails, phone numbers and payment history — personal data leaving the system."
      />
    </>
  )
}
