/**
 * SANDBOX FIXTURE — do not copy into FlexFit-Studio-refactor.
 *
 * Mirrors the repo's `members` / `membersById` / `getMember` exports so roster
 * and waitlist lookups on the new class screen resolve the same way there.
 */

import type { Member, MembershipStatus } from '@/lib/v2/types'
import { initials } from '@/lib/v2/format'

const names = [
  'Ananya Sharma',
  'Rohit Verma',
  'Meera Nair',
  'Karan Sethi',
  'Divya Pillai',
  'Aditya Ghosh',
  'Fatima Sheikh',
  'Nikhil Joshi',
  'Tara Krishnan',
  'Imran Ali',
  'Sneha Reddy',
  'Yash Malhotra',
  'Pooja Desai',
  'Rahul Bose',
  'Kavya Menon',
  'Siddharth Jain',
  // The pool has to exceed the largest class capacity, otherwise a full class
  // would have to reuse a member on its own waitlist.
  'Aisha Rahman',
  'Varun Shetty',
  'Ishita Roy',
  'Gaurav Chawla',
  'Leela Prasad',
  'Omkar Patil',
  'Nandini Rao',
  'Farhan Qadri',
  'Bhavna Soni',
  'Tejas Kulkarni',
]

const statuses: MembershipStatus[] = ['active', 'active', 'active', 'paused']

export let members: Member[] = names.map((name, i) => {
  const [firstName, lastName] = name.split(' ')
  return {
    id: `m-${String(i + 1).padStart(2, '0')}`,
    firstName,
    lastName,
    name,
    initials: initials(name),
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
    phone: '+91 99000 00000',
    status: statuses[i % statuses.length],
    planId: i % 3 === 0 ? 'p-elite' : 'p-studio',
    homeLocation: 'indiranagar',
    joinedDate: new Date(Date.UTC(2024, i % 12, 5)).toISOString().slice(0, 10),
  }
})

export let membersById = new Map(members.map((m) => [m.id, m]))

export function getMember(id: string): Member | undefined {
  return membersById.get(id)
}
