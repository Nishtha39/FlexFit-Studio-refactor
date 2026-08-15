/**
 * Outbound messaging. This is the only place in the app that sends real email.
 *
 * Three rules the procedures here enforce, all of them about not lying to the
 * operator about what left the building:
 *
 *  1. **A send is only reported as sent if the provider accepted it.** The
 *     provider's own refusal ("domain is not verified") is passed back
 *     verbatim, because that names the fix and a generic failure does not.
 *  2. **A broadcast is one message per recipient.** Putting 200 members in one
 *     `to:` field would publish every member's email address to every other
 *     member — a data leak, not a formatting choice.
 *  3. **Every send is written to the event log** whether it succeeded or not,
 *     so "did we actually email them?" has an answer that is not somebody's
 *     memory of a toast.
 */
import { z } from 'zod'
import { eq, inArray } from 'drizzle-orm'
import { publicProcedure, recordEvent, refuse, router } from '../init'
import { companies, leads, members, notifications, staff } from '../../db/schema'
import { emailStatus, sendEmail } from '../../email/send'
import { NOW, isoStamp } from '../../../lib/seed'

/** Resend's per-request ceiling is higher, but a runaway broadcast is worse than a slow one. */
const MAX_RECIPIENTS = 200

export const commsRouter = router({
  /**
   * Whether mail is configured, for the settings screen. Never returns the key —
   * only whether one is present, and which sender it would go out as.
   */
  emailStatus: publicProcedure.query(({ ctx }) => emailStatus(ctx.env)),

  /** Send to one member. The "Message" button on a member profile. */
  emailMember: publicProcedure
    .input(
      z.object({
        memberId: z.string().min(1),
        subject: z.string().min(1).max(200),
        body: z.string().min(1).max(5000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(members).where(eq(members.id, input.memberId))
      if (!rows[0]) refuse('NOT_FOUND', 'No member with that id.')
      const member = rows[0]

      const result = await sendEmail(ctx.env, {
        to: [{ email: member.email, name: member.name }],
        subject: input.subject,
        text: input.body,
      })

      await recordEvent(ctx, {
        kind: result.ok ? 'member.emailed' : 'member.email-failed',
        entityType: 'member',
        entityId: member.id,
        summary: result.ok
          ? `Emailed ${member.name} — "${input.subject}"`
          : `Email to ${member.name} FAILED — ${result.message}`,
        payload: { subject: input.subject, to: member.email, ok: result.ok },
      })

      // A provider refusal is a real answer, not a server fault, so it comes
      // back as a typed refusal the UI can show rather than a 500.
      if (!result.ok) refuse('BAD_REQUEST', result.message)

      return { id: result.id, to: member.email, name: member.name }
    }),

  /** Send to an arbitrary address — the settings screen's "send a test" button. */
  sendTest: publicProcedure
    .input(z.object({ to: z.string().email(), subject: z.string().max(200).optional() }))
    .mutation(async ({ ctx, input }) => {
      const status = emailStatus(ctx.env)
      const result = await sendEmail(ctx.env, {
        to: [{ email: input.to }],
        subject: input.subject ?? 'FlexFit Studio — test email',
        text: [
          'This is a test message from FlexFit Studio.',
          `If you are reading it, outbound email works: the Worker holds a valid Resend key and sent as ${status.from}.`,
          status.usingFallbackSender
            ? 'Note: this went out as Resend’s shared onboarding sender, which only delivers to the Resend account owner. Verify your own domain and set EMAIL_FROM to reach members.'
            : 'The sender domain is your own, so member mail will deliver normally.',
        ].join('\n\n'),
      })

      await recordEvent(ctx, {
        kind: result.ok ? 'email.test-sent' : 'email.test-failed',
        entityType: 'system',
        entityId: 'email',
        summary: result.ok ? `Test email sent to ${input.to}` : `Test email to ${input.to} FAILED — ${result.message}`,
      })

      if (!result.ok) refuse('BAD_REQUEST', result.message)
      return { id: result.id, to: input.to, from: status.from, usingFallbackSender: status.usingFallbackSender }
    }),

  /** Send to a staff member — used by the trainers screen. */
  emailStaff: publicProcedure
    .input(
      z.object({
        staffId: z.string().min(1),
        subject: z.string().min(1).max(200),
        body: z.string().min(1).max(5000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(staff).where(eq(staff.id, input.staffId))
      if (!rows[0]) refuse('NOT_FOUND', 'No staff member with that id.')
      const person = rows[0]

      const result = await sendEmail(ctx.env, {
        to: [{ email: person.email, name: person.name }],
        subject: input.subject,
        text: input.body,
      })

      await recordEvent(ctx, {
        kind: result.ok ? 'staff.emailed' : 'staff.email-failed',
        entityType: 'staff',
        entityId: person.id,
        summary: result.ok
          ? `Emailed ${person.name} — "${input.subject}"`
          : `Email to ${person.name} FAILED — ${result.message}`,
        payload: { subject: input.subject, to: person.email, ok: result.ok },
      })

      if (!result.ok) refuse('BAD_REQUEST', result.message)
      return { id: result.id, to: person.email, name: person.name }
    }),

  /** Send to a lead. The "Email" button on the lead panel. */
  emailLead: publicProcedure
    .input(
      z.object({
        leadId: z.string().min(1),
        subject: z.string().min(1).max(200),
        body: z.string().min(1).max(5000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(leads).where(eq(leads.id, input.leadId))
      if (!rows[0]) refuse('NOT_FOUND', 'That lead no longer exists.')
      const lead = rows[0]

      const result = await sendEmail(ctx.env, {
        to: [{ email: lead.email, name: lead.name }],
        subject: input.subject,
        text: input.body,
      })

      await recordEvent(ctx, {
        kind: result.ok ? 'lead.emailed' : 'lead.email-failed',
        entityType: 'lead',
        entityId: lead.id,
        summary: result.ok
          ? `Emailed ${lead.name} — "${input.subject}"`
          : `Email to ${lead.name} FAILED — ${result.message}`,
        payload: { subject: input.subject, to: lead.email, ok: result.ok },
      })

      if (!result.ok) refuse('BAD_REQUEST', result.message)
      return { id: result.id, to: lead.email, name: lead.name }
    }),

  /** Send to a corporate account's named contact. */
  emailCompanyContact: publicProcedure
    .input(
      z.object({
        companyId: z.string().min(1),
        subject: z.string().min(1).max(200),
        body: z.string().min(1).max(5000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(companies).where(eq(companies.id, input.companyId))
      if (!rows[0]) refuse('NOT_FOUND', 'No company with that id.')
      const company = rows[0]

      const result = await sendEmail(ctx.env, {
        to: [{ email: company.contactEmail, name: company.contactName }],
        subject: input.subject,
        text: input.body,
      })

      await recordEvent(ctx, {
        kind: result.ok ? 'company.emailed' : 'company.email-failed',
        entityType: 'company',
        entityId: company.id,
        summary: result.ok
          ? `Emailed ${company.contactName} at ${company.name} — "${input.subject}"`
          : `Email to ${company.contactName} FAILED — ${result.message}`,
        payload: { subject: input.subject, to: company.contactEmail, ok: result.ok },
      })

      if (!result.ok) refuse('BAD_REQUEST', result.message)
      return { id: result.id, to: company.contactEmail, name: company.contactName }
    }),

  /**
   * Broadcast to a list of members, one message each.
   *
   * Partial success is the normal case at this size — one bad address should
   * not fail the other 199 — so this returns counts and the failures rather
   * than throwing, and the caller reports both numbers. Claiming "sent to 200"
   * when 6 bounced is the kind of number this whole task is about.
   */
  broadcast: publicProcedure
    .input(
      z.object({
        memberIds: z.array(z.string().min(1)).min(1).max(MAX_RECIPIENTS),
        subject: z.string().min(1).max(200),
        body: z.string().min(1).max(5000),
        /** Also drop it in the in-app notification centre. */
        alsoNotify: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const status = emailStatus(ctx.env)
      if (!status.configured) {
        refuse(
          'BAD_REQUEST',
          'No RESEND_API_KEY is bound to this Worker, so nothing was sent. Set it with `npx wrangler secret put RESEND_API_KEY`.',
        )
      }

      const rows = await ctx.db.select().from(members).where(inArray(members.id, input.memberIds))
      if (rows.length === 0) refuse('NOT_FOUND', 'None of those members exist.')

      const failures: { memberId: string; email: string; reason: string }[] = []
      let sent = 0

      // Sequential on purpose. Resend rate-limits, and a Worker has a CPU budget
      // per request — firing 200 concurrent fetches is the reliable way to get
      // a partial send with no record of where it stopped.
      for (const member of rows) {
        const result = await sendEmail(ctx.env, {
          to: [{ email: member.email, name: member.name }],
          subject: input.subject,
          text: input.body,
        })
        if (result.ok) sent += 1
        else failures.push({ memberId: member.id, email: member.email, reason: result.message })
      }

      if (input.alsoNotify) {
        await ctx.db.insert(notifications).values({
          id: `notif-bcast-${Date.now().toString(36)}`,
          kind: 'system',
          severity: failures.length > 0 ? 'warning' : 'info',
          title: input.subject,
          body:
            failures.length > 0
              ? `Broadcast sent to ${sent} of ${rows.length} members. ${failures.length} failed.`
              : `Broadcast sent to ${sent} members.`,
          timestamp: isoStamp(NOW),
          read: false,
          entityType: null,
          entityId: null,
        })
      }

      await recordEvent(ctx, {
        kind: 'members.broadcast',
        entityType: 'member',
        entityId: '*',
        summary: `Broadcast "${input.subject}" — ${sent} sent, ${failures.length} failed`,
        payload: { attempted: rows.length, sent, failures: failures.slice(0, 20) },
      })

      return { attempted: rows.length, sent, failed: failures.length, failures: failures.slice(0, 20) }
    }),
})
