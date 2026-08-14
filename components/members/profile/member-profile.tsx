'use client'

import * as React from 'react'
import { Tabs, TabPanel, type TabItem } from '@/components/ui/tabs'
import type { Member } from '@/lib/types'
import { checkInsByMember } from '@/lib/data/attendance'
import { paymentsForMember } from '@/lib/data/payments'
import { ProfileHeader } from './profile-header'
import { OverviewTab } from './overview-tab'
import { AttendanceTab } from './attendance-tab'
import { BillingTab } from './billing-tab'
import { ProgramsTab } from './programs-tab'
import { NotesTab } from './notes-tab'
import { TimelineTab } from './timeline-tab'
import { notesFor, programsFor, timelineFor } from './profile-data'

/**
 * Member profile composition. The header is always visible; the tabs only swap
 * the body, so the operational facts (status, risk, last visit, plan) never
 * scroll out of reach while someone is digging through history.
 */
export function MemberProfile({ member }: { member: Member }) {
  const [tab, setTab] = React.useState('overview')

  const items: TabItem[] = React.useMemo(() => {
    const visits = checkInsByMember.get(member.id)?.length ?? 0
    return [
      { id: 'overview', label: 'Overview' },
      { id: 'attendance', label: 'Attendance', count: visits },
      { id: 'billing', label: 'Billing', count: paymentsForMember(member.id).length },
      { id: 'programs', label: 'Programs', count: programsFor(member).length },
      { id: 'notes', label: 'Notes', count: notesFor(member).length },
      { id: 'timeline', label: 'Timeline', count: timelineFor(member).length },
    ]
  }, [member])

  return (
    <div className="flex min-w-0 flex-col">
      <ProfileHeader member={member} />
      <Tabs items={items} value={tab} onChange={setTab} className="sticky top-0 z-20 bg-background" />

      <TabPanel id="overview" active={tab === 'overview'}>
        <OverviewTab member={member} onTab={setTab} />
      </TabPanel>
      <TabPanel id="attendance" active={tab === 'attendance'}>
        <AttendanceTab member={member} />
      </TabPanel>
      <TabPanel id="billing" active={tab === 'billing'}>
        <BillingTab member={member} />
      </TabPanel>
      <TabPanel id="programs" active={tab === 'programs'}>
        <ProgramsTab member={member} />
      </TabPanel>
      <TabPanel id="notes" active={tab === 'notes'}>
        <NotesTab member={member} />
      </TabPanel>
      <TabPanel id="timeline" active={tab === 'timeline'}>
        <TimelineTab member={member} />
      </TabPanel>
    </div>
  )
}
