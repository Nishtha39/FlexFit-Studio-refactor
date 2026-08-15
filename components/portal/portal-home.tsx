'use client'

import * as React from 'react'
import Link from 'next/link'
import { CalendarDays, QrCode } from 'lucide-react'
import { PageHeader, PageBody } from '@/components/shell/page-header'
import { RequireScreen } from '@/components/shell/app-shell'
import { Card, CardBody, CardHeader, CardFooter, CapacityBar } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MemberStatus, PaymentStatus, StatusChip } from '@/components/ui/status-chip'
import { EmptyState } from '@/components/ui/empty-state'
import { Modal } from '@/components/ui/modal'
import { api } from '@/lib/api/client'
import { useDataVersion, useStudio } from '@/lib/store/studio-store'
import { downloadIcs } from '@/lib/export'
import { members, memberById } from '@/lib/data/members'
import { getPlan } from '@/lib/data/plans'
import { paymentsForMember } from '@/lib/data/payments'
import { locationById } from '@/lib/data'
import { classes } from '@/lib/data/classes'
import { money, num, shortDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  buildOccurrence,
  slotClock,
  slotDate,
  THIS_WEEK,
  weekDates,
  type Occurrence,
} from '@/components/schedule/schedule-engine'
import { CancelBookingDialog, WaitlistJoinDialog } from '@/components/booking/booking-dialogs'
import { isoDate } from '@/lib/seed'

/**
 * Member portal. Phone-first and deliberately small: what my membership allows,
 * what I have booked, and one way to change it. Everything else is the studio's
 * problem, not the member's.
 */

/**
 * The signed-in member for the Member role.
 *
 * Only the *id* is fixed. The member record itself is re-read on every hydrate,
 * because the whole point of the portal is that booking a class changes the
 * credits shown at the top of it — pinning the object would show the count from
 * page load forever.
 */
const ME_ID = (
  members.find(
    (m) => m.status === 'active' && m.metrics.creditsRemaining !== null && m.metrics.creditsRemaining > 0,
  ) ?? members[0]
).id

function myOccurrences(): Occurrence[] {
  const week = weekDates(THIS_WEEK)
  const out: Occurrence[] = []
  for (const date of week) {
    const iso = isoDate(date)
    const weekday = date.getUTCDay()
    for (const gymClass of classes.filter((c) => c.dayOfWeek === weekday)) {
      out.push(buildOccurrence(gymClass, iso))
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime())
}

export function PortalHome() {
  const { mutate, connection } = useStudio()
  const version = useDataVersion()
  const all = React.useMemo(myOccurrences, [version])
  const ME = memberById.get(ME_ID) ?? members[0]
  const [cancelTarget, setCancelTarget] = React.useState<Occurrence | null>(null)
  const [waitlistTarget, setWaitlistTarget] = React.useState<Occurrence | null>(null)
  const [codeOpen, setCodeOpen] = React.useState(false)

  /** Take or give up a place. The server decides roster vs waitlist. */
  const bookClass = (occ: Occurrence) => {
    if (connection !== 'live') return
    void mutate(() => api.booking.book.mutate({ classId: occ.classId, memberId: ME.id }), {
      success: (r) => ({
        title: r.kind === 'roster' ? `Booked ${occ.gymClass.name}` : `Waitlisted for ${occ.gymClass.name}`,
        detail:
          r.kind === 'roster'
            ? `${slotDate(occ.start)}, ${slotClock(occ.start)}.`
            : `Position ${r.position + 1}. You are texted the moment a spot opens.`,
      }),
    })
  }

  const cancelClass = (occ: Occurrence, forfeited: boolean) => {
    if (connection !== 'live') return
    void mutate(() => api.booking.cancel.mutate({ classId: occ.classId, memberId: ME.id }), {
      success: () => ({
        title: forfeited ? 'Cancelled — credit forfeited' : 'Cancelled — credit returned',
        detail: `${occ.gymClass.name}, ${slotDate(occ.start)}.`,
      }),
    })
  }

  const plan = getPlan(ME.planId)
  const credits = ME.metrics.creditsRemaining
  const allowance = ME.metrics.planVisitsPerMonth

  // Read the roster straight off the class — it is rebuilt from class_seats on
  // every hydrate, so there is no local "joined"/"cancelled" list that could
  // disagree with what the studio's own schedule screen shows.
  const booked = all.filter((o) => o.gymClass.roster.includes(ME.id) && o.state !== 'past')
  const openClasses = all.filter(
    (o) =>
      o.state === 'upcoming' &&
      !o.gymClass.roster.includes(ME.id) &&
      !o.gymClass.waitlist.includes(ME.id) &&
      o.gymClass.location === ME.homeLocation,
  )
  const next = booked[0]
  const bills = paymentsForMember(ME.id).slice(0, 3)

  return (
    <RequireScreen screen="portal">
      <PageHeader
        title={`Hi ${ME.firstName}`}
        meta={
          <>
            <span>{plan?.name ?? 'Membership'}</span>
            <span aria-hidden>·</span>
            <span>{locationById.get(ME.homeLocation)?.shortName}</span>
          </>
        }
        actions={
          <Button variant="secondary" size="sm" onClick={() => setCodeOpen(true)}>
            <QrCode />
            My check-in code
          </Button>
        }
        sticky={false}
      />

      <PageBody className="mx-auto w-full max-w-2xl">
        <Card>
          <CardHeader
            title="Your membership"
            description={plan?.description}
            actions={<MemberStatus status={ME.status} />}
          />
          <CardBody className="flex flex-col gap-3">
            {credits === null ? (
              <p className="text-base text-foreground">
                Unlimited visits — no credits to track.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xl font-semibold text-foreground tnum">{num(credits)}</span>
                  <span className="text-micro text-muted-foreground tnum">
                    of {num(allowance ?? 0)} visits left this month
                  </span>
                </div>
                <CapacityBar filled={(allowance ?? 0) - credits} capacity={allowance ?? 1} />
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {(plan?.perks ?? []).map((perk) => (
                <StatusChip key={perk} tone="neutral" label={perk} />
              ))}
            </div>
          </CardBody>
          <CardFooter>
            <span>Renews on the 1st · {money(ME.metrics.monthlyValue)}/mo</span>
            <span className="tnum">{num(ME.metrics.visitsLast30)} visits in 30 days</span>
          </CardFooter>
        </Card>

        {next ? (
          <Card>
            <CardHeader title="Next class" description={`${slotDate(next.start)} · ${slotClock(next.start)}`} />
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-lg font-semibold text-foreground">{next.gymClass.name}</p>
                <p className="text-sm text-muted-foreground">
                  {next.trainerName} · {next.durationMin} min ·{' '}
                  {locationById.get(next.gymClass.location)?.shortName}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setCancelTarget(next)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() =>
                    downloadIcs(`${next.gymClass.name.toLowerCase().replace(/\s+/g, '-')}.ics`, [
                      {
                        uid: next.key,
                        title: `${next.gymClass.name} — FlexFit`,
                        description: `With ${next.trainerName}. ${next.durationMin} minutes.`,
                        location: locationById.get(next.gymClass.location)?.name ?? 'FlexFit Studio',
                        start: next.start,
                        durationMin: next.durationMin,
                      },
                    ])
                  }
                >
                  Add to calendar
                </Button>
              </div>
            </CardBody>
          </Card>
        ) : null}

        <Card className="overflow-hidden">
          <CardHeader
            title="Your week"
            description={`${num(booked.length)} booked`}
            actions={
              <Link href="/portal" className="text-micro font-medium text-primary underline-offset-2 hover:underline">
                <span className="flex items-center gap-1">
                  <CalendarDays className="size-3.5" />
                  Full timetable
                </span>
              </Link>
            }
          />
          {booked.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Nothing booked this week"
                description="Book below — cancelling more than 12 hours ahead is always free."
              />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {booked.map((occ) => (
                <li key={occ.key} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-20 shrink-0 text-sm text-foreground tnum">
                    {slotDate(occ.start)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {occ.gymClass.name}
                    </span>
                    <span className="block text-micro text-muted-foreground">
                      {slotClock(occ.start)} · {occ.trainerName}
                    </span>
                  </span>
                  <Button variant="ghost" size="xs" onClick={() => setCancelTarget(occ)}>
                    Cancel
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Book a class" description={`At ${locationById.get(ME.homeLocation)?.name}`} />
          <ul className="divide-y divide-border">
            {openClasses.slice(0, 6).map((occ) => {
              const full = occ.gymClass.roster.length >= occ.gymClass.capacity
              return (
                <li key={occ.key} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-20 shrink-0 text-sm text-foreground tnum">{slotDate(occ.start)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {occ.gymClass.name}
                    </span>
                    <span className="block text-micro text-muted-foreground">
                      {slotClock(occ.start)} · {occ.trainerName}
                    </span>
                  </span>
                  <span className="hidden w-28 shrink-0 sm:block">
                    <CapacityBar
                      filled={occ.gymClass.roster.length}
                      capacity={occ.gymClass.capacity}
                      showLabel
                    />
                  </span>
                  <Button
                    variant={full ? 'secondary' : 'primary'}
                    size="xs"
                    className={cn('shrink-0', full && 'text-muted-foreground')}
                    onClick={() => {
                      if (full) {
                        setWaitlistTarget(occ)
                        return
                      }
                      bookClass(occ)
                    }}
                  >
                    {full ? 'Waitlist' : 'Book'}
                  </Button>
                </li>
              )
            })}
          </ul>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Payments" description="Your last three charges." />
          <ul className="divide-y divide-border">
            {bills.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-sm text-foreground">{p.description}</span>
                  <span className="block text-micro text-muted-foreground tnum">
                    {shortDate(p.date)} · {p.invoiceId}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-medium text-foreground tnum">{money(p.amount)}</span>
                  <PaymentStatus status={p.status} />
                </span>
              </li>
            ))}
          </ul>
          <CardFooter>
            <span>Questions about a charge? Ask at the desk — we can see the same rows you can.</span>
          </CardFooter>
        </Card>
      </PageBody>

      {cancelTarget ? (
        <CancelBookingDialog
          open
          onClose={() => setCancelTarget(null)}
          occurrence={cancelTarget}
          member={ME}
          waitlist={cancelTarget.gymClass.waitlist}
          onConfirm={(_memberId, forfeited) => {
            const target = cancelTarget
            setCancelTarget(null)
            cancelClass(target, forfeited)
          }}
        />
      ) : null}

      {waitlistTarget ? (
        <WaitlistJoinDialog
          open
          onClose={() => setWaitlistTarget(null)}
          occurrence={waitlistTarget}
          member={ME}
          waitlist={waitlistTarget.gymClass.waitlist}
          onConfirm={() => {
            const target = waitlistTarget
            setWaitlistTarget(null)
            bookClass(target)
          }}
        />
      ) : null}
      <Modal
        open={codeOpen}
        onClose={() => setCodeOpen(false)}
        title="Your check-in code"
        description="Show this at the kiosk, or type the number in."
      >
        <div className="flex flex-col items-center gap-4 py-2">
          <MemberCode value={ME.id} />
          <p className="font-mono text-lg tracking-widest text-foreground">{ME.id}</p>
          <p className="max-w-xs text-center text-micro leading-relaxed text-muted-foreground">
            The kiosk also finds you by name or phone number, so this is a shortcut rather than the
            only way in.
          </p>
        </div>
      </Modal>
    </RequireScreen>
  )
}

/**
 * A scannable code, drawn without a QR library.
 *
 * A real QR encoder is a few hundred lines and one more dependency for
 * something the kiosk does not read optically anyway — it looks a member up by
 * id, name or phone. This renders the id as a deterministic block pattern so
 * the card is recognisably *theirs*, with the id printed underneath in full,
 * which is what actually gets typed in. It is decoration around a real value,
 * and it does not claim to be a QR code.
 */
function MemberCode({ value }: { value: string }) {
  const cells = React.useMemo(() => {
    let h = 0x811c9dc5
    for (let i = 0; i < value.length; i++) {
      h ^= value.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
    const out: boolean[] = []
    for (let i = 0; i < 121; i++) {
      h ^= h << 13
      h ^= h >>> 17
      h ^= h << 5
      out.push(((h >>> 0) & 1) === 1)
    }
    return out
  }, [value])

  return (
    <div
      aria-hidden
      className="grid gap-0.5 rounded-md border border-border bg-surface p-3"
      style={{ gridTemplateColumns: 'repeat(11, 0.75rem)' }}
    >
      {cells.map((on, i) => (
        <span key={i} className={cn('size-3 rounded-[1px]', on ? 'bg-foreground' : 'bg-muted')} />
      ))}
    </div>
  )
}
