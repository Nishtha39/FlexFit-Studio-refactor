/**
 * Replaces the build-time seed data with the database's copy, in place.
 *
 * The problem this solves: every screen derives its numbers from module-level
 * arrays that were computed when the bundle loaded. Before this existed, a
 * button could write to D1 and the screen would keep rendering the value it had
 * at page load — which is exactly why the action buttons appeared not to work.
 *
 * How it works: the entity modules export `let` bindings rather than `const`.
 * Those are ESM **live bindings** — when `setMembers()` reassigns the export,
 * every module that wrote `import { members } from '@/lib/data/members'` sees
 * the new array immediately, with no call-site change anywhere. The derived
 * modules (dashboard, billing, retention, …) then recompute themselves through
 * their own `rebuild()`.
 *
 * ORDER IS LOAD-BEARING. Entities first, derivations second: `rebuild()` in
 * dashboard-data reads `activeMembers`, so setting the members has to happen
 * before it runs, or the dashboard would recompute from the data it is
 * replacing and produce a number that matches neither.
 *
 * This runs only in the browser. The static export is built against the seed —
 * which is what `generateStaticParams` enumerates the 481 pages from — and the
 * seed is exactly what the database was loaded with, so the pre-rendered HTML
 * and the hydrated state agree on everything nobody has changed yet.
 */

import type {
  AppNotification,
  Company,
  DailyAttendance,
  Equipment,
  EquipmentFault,
  EquipmentReservation,
  EquipmentService,
  GymClass,
  Lead,
  Member,
  MemberNote,
  Payment,
  Plan,
  Location,
  Staff,
  WorkItem,
} from '../types'

import { setLocations } from './index'
import { setDailyAttendance } from './attendance'
import { setMembers } from './members'
import { setStaff } from './staff'
import { setPlans } from './plans'
import { setCompanies } from './companies'
import { setClasses } from './classes'
import { setPayments } from './payments'
import { setLeads } from './leads'
import { setNotifications } from './notifications'
import { setEquipmentData } from './equipment'
import { setMemberNotes } from './notes'
import { setWorkItems } from './work-items'
import { setClassMoves } from './class-moves'
import type { ClassMove } from '@/components/schedule/schedule-engine'

import * as dashboardData from '@/components/dashboard/dashboard-data'
import * as billingData from '@/components/billing/billing-data'
import * as corporateData from '@/components/corporate/corporate-data'
import * as leadsData from '@/components/leads/leads-data'
import * as retentionData from '@/components/retention/retention-data'
import * as trainersData from '@/components/trainers/trainers-data'
import * as reportsData from '@/components/reports/reports-data'

export interface StudioSnapshot {
  locations: Location[]
  members: Member[]
  staff: Staff[]
  plans: Plan[]
  companies: Company[]
  classes: GymClass[]
  payments: Payment[]
  leads: Lead[]
  notifications: AppNotification[]
  dailyAttendance: DailyAttendance[]
  equipment: Equipment[]
  equipmentFaults: EquipmentFault[]
  equipmentServices: EquipmentService[]
  equipmentReservations: EquipmentReservation[]
  memberNotes: MemberNote[]
  workItems: WorkItem[]
  classMoves: ClassMove[]
}

/** Recompute every screen's derived numbers from the current entity arrays. */
export function rebuildDerived(): void {
  // Order within this list does not matter — each module reads entities, not
  // another module's derivations — but each one must run, because a module that
  // is skipped keeps rendering pre-mutation values while its neighbours move on.
  dashboardData.rebuild()
  billingData.rebuild()
  corporateData.rebuild()
  leadsData.rebuild()
  retentionData.rebuild()
  trainersData.rebuild()
  reportsData.rebuild()
}

/** Swap in the database's copy of everything, then recompute the derivations. */
export function hydrate(snapshot: StudioSnapshot): void {
  // Locations first: staff, classes and check-ins all key off a location id,
  // and several derivations print the name beside them.
  setLocations(snapshot.locations)
  setPlans(snapshot.plans)
  setStaff(snapshot.staff)
  setCompanies(snapshot.companies)
  setMembers(snapshot.members)
  setClasses(snapshot.classes)
  setPayments(snapshot.payments)
  setLeads(snapshot.leads)
  setNotifications(snapshot.notifications)
  setDailyAttendance(snapshot.dailyAttendance)
  setEquipmentData({
    equipment: snapshot.equipment,
    faults: snapshot.equipmentFaults,
    services: snapshot.equipmentServices,
    reservations: snapshot.equipmentReservations,
  })
  setMemberNotes(snapshot.memberNotes)
  setWorkItems(snapshot.workItems)
  setClassMoves(snapshot.classMoves)

  rebuildDerived()
}
