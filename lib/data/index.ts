// FlexFit Studio — data engine barrel.
// Every later batch imports its data and types from here (or from the individual
// modules). Nothing in Batch 2 renders UI; this is the shared contract.

import type { Location } from "../types"

export const locations: Location[] = [
  { id: "downtown", name: "FlexFit Downtown", shortName: "Downtown", timezone: "Asia/Kolkata" },
  { id: "riverside", name: "FlexFit Riverside", shortName: "Riverside", timezone: "Asia/Kolkata" },
  { id: "north-loop", name: "FlexFit North Loop", shortName: "North Loop", timezone: "Asia/Kolkata" },
]

export const locationById = new Map(locations.map((l) => [l.id, l]))

// Types
export type * from "../types"

// Deterministic seed / date utilities
export {
  NOW,
  makeRng,
  mulberry32,
  addDays,
  addMonths,
  isoDate,
  isoStamp,
  daysBetween,
  startOfDay,
  weekday,
  WEEKDAY_LABELS,
  WEEKDAY_LABELS_FULL,
} from "../seed"

// Risk engine
export { computeRisk, bandForScore, RISK_BAND_META } from "../risk"

// Entities
export { plans, planById, getPlan } from "./plans"
export { staff, staffById, getStaff, trainers, activeTrainers, TRAINER_DEPARTURE_DATE } from "./staff"
export { companies, companyById, getCompany, poolUtilization, weeksToExhaustion } from "./companies"
export { members, memberById, getMember, activeMembers } from "./members"
export {
  dailyAttendance,
  checkIns,
  checkInsByMember,
  hourWeekdayMatrix,
  weeklyCheckInCounts,
} from "./attendance"
export { classes, classById, getClass, classesForDay, isFull } from "./classes"
export { payments, paymentById, paymentsForMember, outstandingPayments } from "./payments"
export { leads, leadById, leadsByStage, staleLeads } from "./leads"
export { notifications, unreadCount } from "./notifications"
