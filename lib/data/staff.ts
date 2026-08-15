import type { Staff } from "../types"

function initials(first: string, last: string) {
  return (first[0] + last[0]).toUpperCase()
}

// 9 staff: 1 owner, 1 manager, 5 trainers, 2 front-desk.
// One trainer (Marcus Feld) departed in March 2025 — this drives the attendance
// step-down that Batch 2's attendance generator reproduces.
const raw: Array<Omit<Staff, "name" | "initials" | "active">> = [
  {
    id: "staff-owner",
    firstName: "Ravi",
    lastName: "Menon",
    role: "owner",
    email: "ravi@flexfit.studio",
    phone: "+91 98200 10001",
    specialties: ["Operations"],
    locations: ["downtown", "riverside", "north-loop"],
    activeFrom: "2021-01-04",
    activeTo: null,
  },
  {
    id: "staff-manager",
    firstName: "Diana",
    lastName: "Osei",
    role: "manager",
    email: "diana@flexfit.studio",
    phone: "+91 98200 10002",
    specialties: ["Front office", "Retention"],
    locations: ["downtown", "riverside"],
    activeFrom: "2021-06-15",
    activeTo: null,
  },
  {
    id: "staff-t1",
    firstName: "Aisha",
    lastName: "Kapoor",
    role: "trainer",
    email: "aisha@flexfit.studio",
    phone: "+91 98200 10003",
    specialties: ["Strength", "Mobility"],
    locations: ["downtown"],
    activeFrom: "2022-02-01",
    activeTo: null,
  },
  {
    id: "staff-t2",
    firstName: "Marcus",
    lastName: "Feld",
    role: "trainer",
    email: "marcus@flexfit.studio",
    phone: "+91 98200 10004",
    specialties: ["HIIT", "Boxing"],
    locations: ["downtown", "riverside"],
    activeFrom: "2022-05-09",
    activeTo: "2025-03-21", // departed — key to attendance dip
  },
  {
    id: "staff-t3",
    firstName: "Sofia",
    lastName: "Reyes",
    role: "trainer",
    email: "sofia@flexfit.studio",
    phone: "+91 98200 10005",
    specialties: ["Yoga", "Pilates"],
    locations: ["riverside", "north-loop"],
    activeFrom: "2022-09-12",
    activeTo: null,
  },
  {
    id: "staff-t4",
    firstName: "Kenji",
    lastName: "Watanabe",
    role: "trainer",
    email: "kenji@flexfit.studio",
    phone: "+91 98200 10006",
    specialties: ["Spin", "HIIT"],
    locations: ["downtown", "north-loop"],
    activeFrom: "2023-01-23",
    activeTo: null,
  },
  {
    id: "staff-t5",
    firstName: "Priya",
    lastName: "Nair",
    role: "trainer",
    email: "priya@flexfit.studio",
    phone: "+91 98200 10007",
    specialties: ["CrossFit", "Strength"],
    locations: ["riverside"],
    activeFrom: "2023-08-07",
    activeTo: null,
  },
  {
    id: "staff-fd1",
    firstName: "Leo",
    lastName: "Martins",
    role: "front-desk",
    email: "leo@flexfit.studio",
    phone: "+91 98200 10008",
    specialties: ["Check-in", "Sales"],
    locations: ["downtown"],
    activeFrom: "2023-03-14",
    activeTo: null,
  },
  {
    id: "staff-fd2",
    firstName: "Hana",
    lastName: "Suzuki",
    role: "front-desk",
    email: "hana@flexfit.studio",
    phone: "+91 98200 10009",
    specialties: ["Check-in", "Member care"],
    locations: ["riverside", "north-loop"],
    activeFrom: "2024-01-08",
    activeTo: null,
  },
]

// `let` + setStaff(): ESM live bindings, so hydrating from the database or
// toggling a trainer active reaches every screen. See lib/data/hydrate.ts.
export let staff: Staff[] = raw.map((s) => ({
  ...s,
  name: `${s.firstName} ${s.lastName}`,
  initials: initials(s.firstName, s.lastName),
  active: s.activeTo === null,
}))

export let staffById = new Map(staff.map((s) => [s.id, s]))

export function getStaff(id: string): Staff | undefined {
  return staffById.get(id)
}

export let trainers = staff.filter((s) => s.role === "trainer")
export let activeTrainers = trainers.filter((s) => s.active)

export function setStaff(next: Staff[]): void {
  staff = next
  staffById = new Map(staff.map((s) => [s.id, s]))
  trainers = staff.filter((s) => s.role === "trainer")
  activeTrainers = trainers.filter((s) => s.active)
}

/** The date the departing trainer left — consumed by the attendance generator. */
export const TRAINER_DEPARTURE_DATE = new Date("2025-03-21T00:00:00.000Z")
