'use client'

import * as React from 'react'
import Link from 'next/link'
import { Monitor, UserPlus, PenLine } from 'lucide-react'
import type { ID } from '@/lib/types'
import { num, money } from '@/lib/format'
import { PageHeader, PageBody } from '@/components/shell/page-header'
import { RequireScreen } from '@/components/shell/app-shell'
import { Button } from '@/components/ui/button'
import { Card, KpiTile } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { CheckinFeed } from './checkin-feed'
import { CheckinLookup } from './checkin-lookup'
import { CheckinRoster } from './checkin-roster'
import { KioskGuestDialog } from '../kiosk/kiosk-guest'
import { useKioskSession, unsignedWaiverCount } from '../kiosk/kiosk-session'

/**
 * Front-desk console. The staff-facing counterpart to the kiosk: same engine,
 * same verdicts, different density. Three panes because the desk does three
 * things — watch the door, look someone up, and know who is expected.
 */
export function CheckinConsole() {
  const session = useKioskSession()
  const { toast } = useToast()
  const [guestOpen, setGuestOpen] = React.useState(false)

  // Who is already inside — drives the roster's arrived/expected split.
  const arrived = React.useMemo<Set<ID>>(() => {
    const set = new Set<ID>()
    for (const e of session.feed) {
      if (e.memberId && e.outcome !== 'red') set.add(e.memberId)
    }
    return set
  }, [session.feed])

  const held = session.feed.filter((e) => e.outcome !== 'green').length
  const collected = session.feed.reduce((sum, e) => sum + (e.amount ?? 0), 0)
  const waivers = React.useMemo(() => unsignedWaiverCount(), [])

  return (
    <RequireScreen screen="check_in">
      <PageHeader
        title="Check-in"
        crumbs={[{ label: 'FlexFit Studio', href: '/dashboard' }, { label: 'Check-in' }]}
        meta={
          <>
            <span className="tnum">{num(arrived.size)} in the building</span>
            <span aria-hidden>·</span>
            <span className="tnum">{num(held)} needed attention</span>
            <span aria-hidden>·</span>
            <span>Downtown · Bay 1 kiosk online</span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setGuestOpen(true)}>
              <UserPlus className="size-3.5" />
              Visitor
            </Button>
            <Link
              href="/kiosk"
              className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
            >
              <Monitor className="size-3.5" />
              Launch kiosk
            </Link>
          </>
        }
        sticky={false}
      />

      <PageBody>
        <Card className="grid grid-cols-2 lg:grid-cols-4">
          <KpiTile
            label="In the building"
            value={num(arrived.size)}
            footnote="Checked in and not signed out"
          />
          <KpiTile
            label="Held at the door"
            value={num(held)}
            footnote={held > 0 ? 'Resolve from the feed' : 'Nothing outstanding'}
          />
          <KpiTile
            label="Taken at the door"
            value={money(collected)}
            footnote="Day passes and recovered payments"
          />
          <KpiTile
            label="Unsigned waivers"
            value={num(waivers)}
            footnote="Capture on their next visit"
          />
        </Card>

        <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-h-0 flex-col gap-4">
            <CheckinFeed events={session.feed} />
            <CheckinRoster arrived={arrived} />
          </div>

          <div className="flex flex-col gap-4">
            <CheckinLookup
              evaluate={session.evaluate}
              // No toast here. `session.admit` and `session.resolveAndAdmit`
              // write through the store, which reports the real outcome — a
              // second toast fired from this screen would say "checked in"
              // whether or not the write landed, which is the failure this whole
              // change set exists to remove.
              onAdmit={(m, d) => session.admit(m, d, d.admitted ? undefined : 'Admitted by staff override')}
              onResolve={(m, d) => session.resolveAndAdmit(m, d)}
            />

            <Card className="p-4">
              <p className="text-sm font-semibold text-foreground">Waivers outstanding</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {`${waivers} members have no waiver on file. The kiosk captures a signature automatically on their next visit, so there is no list to work through here.`}
              </p>
              <Link
                href="/members?view=unsigned-waiver"
                className="mt-2.5 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-2 hover:underline"
              >
                <PenLine className="size-3.5" />
                Review who is affected
              </Link>
            </Card>
          </div>
        </div>
      </PageBody>

      <KioskGuestDialog
        open={guestOpen}
        initialMode="day-pass"
        onClose={() => setGuestOpen(false)}
        onComplete={(name, amount) => {
          setGuestOpen(false)
          session.admitGuest(name, amount)
          // A guest has no member row, and every write in this app is keyed to
          // one — a payment included. So this genuinely only reaches the door
          // feed, and the toast says exactly that rather than implying the cash
          // has been booked somewhere it has not.
          toast({
            tone: amount ? 'warn' : 'neutral',
            title: `${name} admitted`,
            detail: amount
              ? `${money(amount)} day pass — on the door feed only. Guests have no member record, so ring it through the till and raise an invoice if it needs to be on the books.`
              : 'Guest pass noted on the door feed against the host.',
          })
        }}
      />
    </RequireScreen>
  )
}
