/**
 * SANDBOX FIXTURE — do not copy into FlexFit-Studio-refactor.
 *
 * The repo's `lib/data/staff.ts` exports the same names (`staff`, `staffById`,
 * `getStaff`, `trainers`) from a fuller dataset, so the new screens bind to the
 * real data the moment they land there.
 */

import type { Staff, StaffRole } from '@/lib/v2/types'
import { initials } from '@/lib/v2/format'

const raw: Array<{
  id: string
  firstName: string
  lastName: string
  role: StaffRole
  specialties: string[]
}> = [
  { id: 's-01', firstName: 'Rhea', lastName: 'Kapoor', role: 'trainer', specialties: ['Strength', 'Mobility'] },
  { id: 's-02', firstName: 'Arjun', lastName: 'Menon', role: 'trainer', specialties: ['HIIT', 'Boxing'] },
  { id: 's-03', firstName: 'Neha', lastName: 'Iyer', role: 'trainer', specialties: ['Yoga', 'Pilates'] },
  { id: 's-04', firstName: 'Vikram', lastName: 'Rao', role: 'trainer', specialties: ['Spin', 'CrossFit'] },
  { id: 's-05', firstName: 'Sana', lastName: 'Qureshi', role: 'front-desk', specialties: [] },
  { id: 's-06', firstName: 'Dev', lastName: 'Bhatia', role: 'manager', specialties: [] },
]

export let staff: Staff[] = raw.map((s) => {
  const name = `${s.firstName} ${s.lastName}`
  return {
    ...s,
    name,
    initials: initials(name),
    email: `${s.firstName.toLowerCase()}@flexfit.studio`,
    phone: '+91 98860 00000',
    locations: ['indiranagar'],
    active: true,
  }
})

export let staffById = new Map(staff.map((s) => [s.id, s]))

export function getStaff(id: string): Staff | undefined {
  return staffById.get(id)
}

export let trainers = staff.filter((s) => s.role === 'trainer')
