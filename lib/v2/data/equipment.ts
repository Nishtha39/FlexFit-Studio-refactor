/**
 * SANDBOX FIXTURE — do not copy into FlexFit-Studio-refactor.
 *
 * Matches the repo's `equipment` / `equipmentById` / `getEquipment` /
 * `equipmentFaults` / `equipmentServices` / `EQUIPMENT_CATEGORY_LABELS` exports.
 */

import type {
  Equipment,
  EquipmentCategory,
  EquipmentFault,
  EquipmentService,
  EquipmentStatus,
} from '@/lib/v2/types'

export const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  cardio: 'Cardio',
  strength: 'Strength',
  'free-weights': 'Free weights',
  functional: 'Functional',
  recovery: 'Recovery',
  studio: 'Studio',
}

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  'in-service': 'In service',
  'needs-service': 'Needs service',
  'out-of-service': 'Out of service',
  retired: 'Retired',
}

interface Seed {
  name: string
  category: EquipmentCategory
  make: string
  model: string
  zone: string
  quantity: number
  status: EquipmentStatus
  unitCost: number
  usefulLifeMonths: number
  serviceIntervalDays: number
  lastServiceDate: string | null
  bookable: boolean
  slotMinutes: number
  notes: string
}

const seeds: Seed[] = [
  { name: 'Treadmill', category: 'cardio', make: 'Precor', model: 'TRM 445', zone: 'Cardio deck', quantity: 8, status: 'in-service', unitCost: 285000, usefulLifeMonths: 84, serviceIntervalDays: 90, lastServiceDate: '2025-02-18', bookable: false, slotMinutes: 0, notes: 'Belt tension checked at every service.' },
  { name: 'Assault Bike', category: 'cardio', make: 'Assault', model: 'AirBike Classic', zone: 'Cardio deck', quantity: 4, status: 'needs-service', unitCost: 96000, usefulLifeMonths: 72, serviceIntervalDays: 60, lastServiceDate: '2024-12-02', bookable: false, slotMinutes: 0, notes: 'Unit 3 chain noise reported twice this month.' },
  { name: 'Power Rack', category: 'strength', make: 'Rogue', model: 'RML-490C', zone: 'Rig 2', quantity: 4, status: 'in-service', unitCost: 178000, usefulLifeMonths: 144, serviceIntervalDays: 180, lastServiceDate: '2025-01-10', bookable: true, slotMinutes: 45, notes: 'Bookable during peak evening hours only.' },
  { name: 'Dumbbell Set 2.5–50kg', category: 'free-weights', make: 'Ivanko', model: 'Urethane', zone: 'Free weights', quantity: 2, status: 'in-service', unitCost: 420000, usefulLifeMonths: 180, serviceIntervalDays: 365, lastServiceDate: '2024-09-14', bookable: false, slotMinutes: 0, notes: 'Handles re-knurled in 2024.' },
  { name: 'Reformer', category: 'studio', make: 'Balanced Body', model: 'Allegro 2', zone: 'Studio B', quantity: 6, status: 'in-service', unitCost: 315000, usefulLifeMonths: 120, serviceIntervalDays: 120, lastServiceDate: '2025-03-01', bookable: true, slotMinutes: 50, notes: 'Springs replaced on units 1 and 4.' },
  { name: 'Sled Lane', category: 'functional', make: 'Rogue', model: 'Dog Sled 1.2', zone: 'Turf', quantity: 2, status: 'in-service', unitCost: 64000, usefulLifeMonths: 120, serviceIntervalDays: 180, lastServiceDate: '2025-02-02', bookable: true, slotMinutes: 30, notes: '' },
  { name: 'Ice Bath', category: 'recovery', make: 'Cold Plunge', model: 'Pro', zone: 'Recovery room', quantity: 2, status: 'out-of-service', unitCost: 240000, usefulLifeMonths: 96, serviceIntervalDays: 45, lastServiceDate: '2025-01-28', bookable: true, slotMinutes: 20, notes: 'Chiller pump failed, vendor part on order.' },
  { name: 'Spin Bike', category: 'cardio', make: 'Keiser', model: 'M3i', zone: 'Studio A', quantity: 20, status: 'in-service', unitCost: 132000, usefulLifeMonths: 84, serviceIntervalDays: 90, lastServiceDate: '2025-03-20', bookable: false, slotMinutes: 0, notes: '' },
  { name: 'Rowing Machine', category: 'cardio', make: 'Concept2', model: 'RowErg', zone: 'Cardio deck', quantity: 6, status: 'in-service', unitCost: 118000, usefulLifeMonths: 120, serviceIntervalDays: 120, lastServiceDate: '2025-02-25', bookable: false, slotMinutes: 0, notes: '' },
  { name: 'Leg Press', category: 'strength', make: 'Hammer Strength', model: 'Linear', zone: 'Rig 1', quantity: 2, status: 'retired', unitCost: 195000, usefulLifeMonths: 144, serviceIntervalDays: 180, lastServiceDate: '2024-06-11', bookable: false, slotMinutes: 0, notes: 'Removed from the floor in March, pending disposal.' },
]

const equipmentBase: Equipment[] = seeds.map((s, i) => ({
  id: `eq-${String(i + 1).padStart(2, '0')}`,
  name: s.name,
  category: s.category,
  make: s.make,
  model: s.model,
  assetTag: `FF-${s.category.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
  location: 'indiranagar',
  zone: s.zone,
  quantity: s.quantity,
  status: s.status,
  purchaseDate: new Date(Date.UTC(2021 + (i % 4), (i * 2) % 12, 12)).toISOString().slice(0, 10),
  unitCost: s.unitCost,
  usefulLifeMonths: s.usefulLifeMonths,
  serviceIntervalDays: s.serviceIntervalDays,
  lastServiceDate: s.lastServiceDate,
  bookable: s.bookable,
  slotMinutes: s.slotMinutes,
  notes: s.notes,
}))

function buildFaults(): EquipmentFault[] {
  return [
    { id: 'f-01', equipmentId: 'eq-02', reportedBy: 's-01', reporterName: 'Rhea Kapoor', reportedDate: '2025-04-02', severity: 'medium', summary: 'Chain noise under load on unit 3.', resolvedDate: null },
    { id: 'f-02', equipmentId: 'eq-02', reportedBy: 'm-04', reporterName: 'Karan Sethi', reportedDate: '2025-03-19', severity: 'low', summary: 'Console backlight flickers.', resolvedDate: '2025-03-22' },
    { id: 'f-03', equipmentId: 'eq-07', reportedBy: 's-06', reporterName: 'Dev Bhatia', reportedDate: '2025-03-30', severity: 'high', summary: 'Chiller pump not holding temperature.', resolvedDate: null },
    { id: 'f-04', equipmentId: 'eq-01', reportedBy: 's-02', reporterName: 'Arjun Menon', reportedDate: '2025-02-11', severity: 'low', summary: 'Unit 6 belt slipping slightly at incline.', resolvedDate: '2025-02-18' },
    { id: 'f-05', equipmentId: 'eq-05', reportedBy: 's-03', reporterName: 'Neha Iyer', reportedDate: '2025-02-26', severity: 'medium', summary: 'Spring tension uneven on unit 4.', resolvedDate: '2025-03-01' },
  ]
}

function buildServices(): EquipmentService[] {
  return [
    { id: 'sv-01', equipmentId: 'eq-01', date: '2025-02-18', vendor: 'Precor Care', cost: 18400, notes: 'Quarterly service, belts and rollers.' },
    { id: 'sv-02', equipmentId: 'eq-02', date: '2024-12-02', vendor: 'FitFix Bengaluru', cost: 6200, notes: 'Chain and bearing inspection.' },
    { id: 'sv-03', equipmentId: 'eq-05', date: '2025-03-01', vendor: 'Balanced Body IN', cost: 22800, notes: 'Spring replacement on two units.' },
    { id: 'sv-04', equipmentId: 'eq-07', date: '2025-01-28', vendor: 'ColdPlunge Support', cost: 14500, notes: 'Filter and pump seal replacement.' },
    { id: 'sv-05', equipmentId: 'eq-08', date: '2025-03-20', vendor: 'Keiser India', cost: 31000, notes: 'Fleet service across 20 bikes.' },
  ]
}

export let equipment: Equipment[] = equipmentBase
export let equipmentById = new Map(equipment.map((e) => [e.id, e]))
export let equipmentFaults: EquipmentFault[] = buildFaults()
export let equipmentServices: EquipmentService[] = buildServices()

export function getEquipment(id: string): Equipment | undefined {
  return equipmentById.get(id)
}

/**
 * Straight-line book value. Derived rather than stored so a change to
 * `usefulLifeMonths` is reflected everywhere at once.
 */
export function bookValue(e: Equipment, now = new Date('2025-04-14T00:00:00.000Z')): number {
  const months =
    (now.getUTCFullYear() - new Date(e.purchaseDate).getUTCFullYear()) * 12 +
    (now.getUTCMonth() - new Date(e.purchaseDate).getUTCMonth())
  const remaining = Math.max(0, e.usefulLifeMonths - months)
  return Math.round(e.unitCost * (remaining / e.usefulLifeMonths) * e.quantity)
}

/** Next service date derived from the last one plus the interval. */
export function nextServiceDate(e: Equipment): string | null {
  if (!e.lastServiceDate) return null
  const d = new Date(e.lastServiceDate)
  d.setUTCDate(d.getUTCDate() + e.serviceIntervalDays)
  return d.toISOString().slice(0, 10)
}
