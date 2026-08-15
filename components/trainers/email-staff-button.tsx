'use client'

import * as React from 'react'
import { Mail } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useStudio } from '@/lib/store/studio-store'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/input'
import { ConsequenceNotice, Modal } from '@/components/ui/modal'
import type { Staff } from '@/lib/types'

/** Email a staff member for real. Same Resend pipeline as member messaging. */
export function EmailStaffButton({ staff }: { staff: Staff }) {
  const [open, setOpen] = React.useState(false)
  const { mutate, busy, connection } = useStudio()
  const [subject, setSubject] = React.useState('')
  const [body, setBody] = React.useState('')
  const [configured, setConfigured] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    if (!open) return
    setSubject('')
    setBody(`Hi ${staff.firstName},\n\n\n\nFlexFit Studio`)
    if (connection === 'live') {
      api.comms.emailStatus
        .query()
        .then((s) => setConfigured(s.configured))
        .catch(() => setConfigured(null))
    }
  }, [open, staff.firstName, connection])

  async function send() {
    const result = await mutate(
      () => api.comms.emailStaff.mutate({ staffId: staff.id, subject: subject.trim(), body: body.trim() }),
      { success: (r) => ({ title: `Email sent to ${r.name}`, detail: r.to }) },
    )
    if (result) setOpen(false)
  }

  return (
    <>
      <Button size="xs" variant="ghost" aria-label={`Email ${staff.name}`} onClick={() => setOpen(true)}>
        <Mail className="size-3" />
        Email
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={`Email ${staff.name}`}
        description={staff.email}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={subject.trim().length === 0 || body.trim().length === 0 || busy}
              onClick={send}
            >
              {busy ? 'Sending…' : 'Send email'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {configured === false ? (
            <ConsequenceNotice
              tone="danger"
              headline="Outbound email is not configured"
              detail="No RESEND_API_KEY is bound to this Worker, so sending will fail. Set it with `npx wrangler secret put RESEND_API_KEY`."
            />
          ) : null}
          <Field label="Subject" htmlFor={`staff-subj-${staff.id}`}>
            <Input
              id={`staff-subj-${staff.id}`}
              value={subject}
              onChange={(e) => setSubject(e.currentTarget.value)}
            />
          </Field>
          <Field label="Message" htmlFor={`staff-body-${staff.id}`}>
            <Textarea
              id={`staff-body-${staff.id}`}
              className="min-h-44"
              value={body}
              onChange={(e) => setBody(e.currentTarget.value)}
            />
          </Field>
        </div>
      </Modal>
    </>
  )
}
