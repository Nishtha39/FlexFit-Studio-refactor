'use client'

import * as React from 'react'
import { NotebookPen, Pin, PinOff, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, Select, Textarea, Checkbox } from '@/components/ui/input'
import { StatusChip } from '@/components/ui/status-chip'
import { ViewToggle } from '@/components/ui/tabs'
import { EmptyState } from '@/components/ui/empty-state'
import { ConfirmDialog } from '@/components/ui/modal'
import { api } from '@/lib/api/client'
import { useDataVersion, useStudio } from '@/lib/store/studio-store'
import type { Member, MemberNote, NoteKind } from '@/lib/types'
import { NOW } from '@/lib/seed'
import { clock, daysAgo, fullDate } from '@/lib/format'
import { getStaff } from '@/lib/data/staff'
import { NOTE_META, notesFor } from '@/lib/data/notes'

/**
 * Notes tab. A pinned note is an operational instruction, not a comment — it is
 * what the kiosk surfaces to the front desk, so pinning is the one decision this
 * screen makes explicit.
 *
 * Notes used to live in React state seeded from a generator, which meant the
 * injury warning a trainer wrote survived exactly as long as the tab stayed
 * open — and the kiosk, reading its own copy, never saw it at all. They are rows
 * now, and this screen reads them back from the database like everything else.
 */

const KIND_ORDER: NoteKind[] = ['note', 'call', 'injury', 'goal', 'complaint']

export function NotesTab({ member }: { member: Member }) {
  const { mutate, connection, busy } = useStudio()
  const version = useDataVersion()
  const notes = React.useMemo(() => notesFor(member.id), [member.id, version])
  const [kindFilter, setKindFilter] = React.useState<NoteKind | 'all'>('all')
  const [confirmDelete, setConfirmDelete] = React.useState<MemberNote | null>(null)

  // Composer
  const [body, setBody] = React.useState('')
  const [kind, setKind] = React.useState<NoteKind>('note')
  const [pinned, setPinned] = React.useState(false)
  const [error, setError] = React.useState<string | undefined>()

  const counts = React.useMemo(() => {
    const map = new Map<NoteKind, number>()
    for (const n of notes) map.set(n.kind, (map.get(n.kind) ?? 0) + 1)
    return map
  }, [notes])

  const visible = kindFilter === 'all' ? notes : notes.filter((n) => n.kind === kindFilter)
  const pinnedCount = notes.filter((n) => n.pinned).length

  function submit() {
    const text = body.trim()
    if (text.length < 4) {
      setError('A note needs at least a few words — it is read by someone else at the desk.')
      return
    }
    setError(undefined)
    if (connection !== 'live') return
    const wasPinned = pinned
    void mutate(
      () => api.crm.addMemberNote.mutate({ memberId: member.id, kind, body: text, pinned: wasPinned }),
      {
        success: (note) => ({
          title: wasPinned ? 'Note added and pinned' : 'Note added',
          detail: wasPinned
            ? 'It will be shown at check-in until someone unpins it.'
            : `${NOTE_META[kind].label} on ${member.name}`,
          // Undo has to be a write now that the note is stored — removing it
          // from a local list would leave the row behind for everyone else.
          action: {
            label: 'Undo',
            onClick: () => {
              void mutate(() => api.crm.deleteMemberNote.mutate({ id: note.id }), {
                success: () => ({ title: 'Note removed' }),
              })
            },
          },
        }),
      },
    ).then((note) => {
      if (!note) return
      setBody('')
      setPinned(false)
    })
  }

  function togglePin(note: MemberNote) {
    if (connection !== 'live') return
    const next = !note.pinned
    void mutate(() => api.crm.setNotePinned.mutate({ id: note.id, pinned: next }), {
      success: () => ({
        title: next ? 'Pinned to check-in' : 'Unpinned',
        detail: next
          ? 'Front desk sees this before the door opens.'
          : 'It stays in the history but no longer interrupts check-in.',
      }),
    })
  }

  function remove(note: MemberNote) {
    if (connection !== 'live') return
    void mutate(() => api.crm.deleteMemberNote.mutate({ id: note.id }), {
      success: () => ({
        title: 'Note deleted',
        detail: `The ${NOTE_META[note.kind].label.toLowerCase()} entry is gone from ${member.name}'s record.`,
      }),
    }).then(() => setConfirmDelete(null))
  }

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-4">
        <ViewToggle
          value={kindFilter}
          onChange={(id) => setKindFilter(id as NoteKind | 'all')}
          items={[
            { id: 'all', label: `All ${notes.length}` },
            ...KIND_ORDER.filter((k) => (counts.get(k) ?? 0) > 0).map((k) => ({
              id: k,
              label: `${NOTE_META[k].label} ${counts.get(k)}`,
            })),
          ]}
          className="self-start"
        />

        {visible.length === 0 ? (
          <EmptyState
            icon={NotebookPen}
            title="Nothing recorded yet"
            description={
              kindFilter === 'all'
                ? 'Notes written here travel with the member — the desk, the trainer and the retention queue all read them.'
                : `No ${NOTE_META[kindFilter as NoteKind].label.toLowerCase()} entries on this member.`
            }
            action={
              kindFilter === 'all' ? undefined : { label: 'Show all notes', onClick: () => setKindFilter('all') }
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {visible.map((note) => {
              const meta = NOTE_META[note.kind]
              const author = getStaff(note.authorId)
              return (
                <li
                  key={note.id}
                  className={cn(
                    'rounded-md border bg-card p-3',
                    note.pinned ? 'border-danger-border' : 'border-border',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <StatusChip tone={meta.tone} label={meta.label} />
                      {note.pinned ? <StatusChip tone="warn" label="Shown at check-in" /> : null}
                      <span className="text-micro text-muted-foreground">
                        {author?.name ?? 'System'} · {fullDate(note.timestamp)} at{' '}
                        {clock(note.timestamp)}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={connection !== 'live'}
                        aria-label={note.pinned ? 'Unpin note' : 'Pin note to check-in'}
                        onClick={() => togglePin(note)}
                      >
                        {note.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={connection !== 'live'}
                        aria-label="Delete note"
                        onClick={() => setConfirmDelete(note)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground">{note.body}</p>
                  <p className="mt-1 text-micro text-muted-foreground">
                    {daysAgo(note.timestamp, NOW)}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <Card>
          <CardHeader title="Add a note" description="Visible to every staff member on this account." />
          <CardBody className="space-y-3">
            <Field label="Type" htmlFor="note-kind">
              <Select
                id="note-kind"
                value={kind}
                onChange={(e) => setKind(e.currentTarget.value as NoteKind)}
              >
                {KIND_ORDER.map((k) => (
                  <option key={k} value={k}>
                    {NOTE_META[k].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Note"
              htmlFor="note-body"
              error={error}
              help="Write what the next person needs to do, not what happened."
            >
              <Textarea
                id="note-body"
                value={body}
                onChange={(e) => setBody(e.currentTarget.value)}
                placeholder="e.g. Cleared for spin only until the physio signs off on 20 Sep."
                aria-invalid={error ? true : undefined}
              />
            </Field>
            <label className="flex items-start gap-2 rounded-md border border-border bg-subtle p-2.5">
              <Checkbox
                className="mt-0.5"
                checked={pinned}
                onChange={(e) => setPinned(e.currentTarget.checked)}
              />
              <span className="min-w-0 text-sm leading-relaxed text-foreground">
                Show at check-in
                <span className="block text-micro text-muted-foreground">
                  Interrupts the kiosk with this note before the door releases. Use it for injuries
                  and access holds only.
                </span>
              </span>
            </label>
          </CardBody>
          <CardFooter>
            <span>
              {pinnedCount === 0
                ? 'No notes currently interrupt check-in'
                : `${pinnedCount} note${pinnedCount > 1 ? 's' : ''} shown at check-in`}
            </span>
            <Button
              variant="primary"
              size="sm"
              disabled={busy || connection !== 'live'}
              onClick={submit}
            >
              Save note
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader title="How notes are used" />
          <CardBody>
            <ul className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Injury</span> — pinned by default and
                read out by the kiosk script at check-in.
              </li>
              <li>
                <span className="font-medium text-foreground">Call</span> — counted as an
                intervention on the retention effectiveness report.
              </li>
              <li>
                <span className="font-medium text-foreground">Complaint</span> — surfaces on the
                owner dashboard queue until it is resolved.
              </li>
            </ul>
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && remove(confirmDelete)}
        title="Delete this note?"
        description={confirmDelete ? `${NOTE_META[confirmDelete.kind].label} on ${member.name}` : ''}
        consequenceTone="danger"
        consequence={
          confirmDelete?.pinned
            ? 'This note currently interrupts check-in. Deleting it means the front desk stops being warned.'
            : 'The note is removed from the member record for every staff member. This cannot be undone.'
        }
        confirmLabel="Delete note"
        destructive
      >
        {confirmDelete ? (
          <p className="text-sm leading-relaxed text-muted-foreground">“{confirmDelete.body}”</p>
        ) : null}
      </ConfirmDialog>
    </div>
  )
}
