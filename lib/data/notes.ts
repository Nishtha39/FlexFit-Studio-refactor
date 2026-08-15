/**
 * Member notes.
 *
 * These used to be generated inside `components/members/profile/profile-data.ts`
 * alongside the timeline, which was right while they were a presentation-layer
 * derivation. They are an entity now — they have a table, staff write them, and
 * the pinned ones are read back at the kiosk — so they live here with the other
 * entities and follow the same live-binding rule: `export let` plus a setter, so
 * `hydrate()` can swap in the database's copy without touching any call site.
 *
 * The generator is unchanged, so the rows seeded into D1 are exactly the notes
 * the profile screen was already showing.
 */
import type { Member, MemberNote, NoteKind } from '@/lib/types'
import { NOW, addDays, isoStamp, makeRng } from '@/lib/seed'
import { members } from './members'
import { staff, activeTrainers } from './staff'

function rngForMember(id: string) {
  // Hash the member id into a stable 32-bit seed.
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return makeRng(h >>> 0)
}

const NOTE_TEMPLATES: Record<NoteKind, string[]> = {
  note: [
    'Prefers morning slots. Asked about the 6:30am Strength block.',
    'Travels for work most of the last week of the month.',
    'Wants to be told when a Reformer Pilates slot opens up.',
  ],
  call: [
    'Called about the failed card. Said they would update it by the weekend.',
    'Left a voicemail on the retention follow-up. No callback yet.',
    'Spoke about the plan downgrade — wants to think about it for a week.',
  ],
  injury: [
    'Right shoulder impingement. Avoid overhead pressing until cleared.',
    'Recovering from a knee strain. No plyometrics for 4 weeks.',
    'Lower back flare-up. Cleared for mobility and spin only.',
  ],
  goal: [
    'Target: first unassisted pull-up by the end of the quarter.',
    'Training for a 10k in November. Wants two conditioning sessions a week.',
    'Goal is consistency — three visits a week, not intensity.',
  ],
  complaint: [
    'Reported the Riverside showers running cold on weekday evenings.',
    'Unhappy the 18:30 HIIT slot is always full by Monday.',
    'Flagged that the app double-charged a drop-in in June.',
  ],
}

/** Pinned first, then newest first. The order the notes tab renders in. */
export function sortNotes(list: MemberNote[]): MemberNote[] {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return a.timestamp < b.timestamp ? 1 : -1
  })
}

function generateFor(member: Member): MemberNote[] {
  const rng = rngForMember(`${member.id}:notes`)
  const out: MemberNote[] = []

  // Injury notes are pinned and always come first when present.
  if (rng.bool(0.28)) {
    out.push({
      id: `${member.id}-n-injury`,
      memberId: member.id,
      kind: 'injury',
      body: rng.pick(NOTE_TEMPLATES.injury),
      authorId: rng.pick(activeTrainers).id,
      timestamp: isoStamp(addDays(NOW, -rng.int(5, 90))),
      pinned: true,
    })
  }

  if (member.metrics.failedPayments > 0) {
    out.push({
      id: `${member.id}-n-call`,
      memberId: member.id,
      kind: 'call',
      body: rng.pick(NOTE_TEMPLATES.call),
      authorId: 'staff-manager',
      timestamp: isoStamp(addDays(NOW, -rng.int(2, 20))),
      pinned: false,
    })
  }

  const extra = rng.int(1, 3)
  const kinds: NoteKind[] = ['note', 'goal', 'complaint']
  for (let i = 0; i < extra; i++) {
    const kind = rng.pick(kinds)
    out.push({
      id: `${member.id}-n-${i}`,
      memberId: member.id,
      kind,
      body: rng.pick(NOTE_TEMPLATES[kind]),
      authorId: rng.pick(staff).id,
      timestamp: isoStamp(addDays(NOW, -rng.int(3, 240))),
      pinned: false,
    })
  }

  return sortNotes(out)
}

function build(): MemberNote[] {
  return members.flatMap(generateFor)
}

export let memberNotes: MemberNote[] = build()

let byMember = new Map<string, MemberNote[]>()

function index(): void {
  byMember = new Map()
  for (const n of memberNotes) {
    const list = byMember.get(n.memberId)
    if (list) list.push(n)
    else byMember.set(n.memberId, [n])
  }
  for (const [id, list] of byMember) byMember.set(id, sortNotes(list))
}

index()

/** Every note on one member, pinned first then newest first. */
export function notesFor(memberId: string): MemberNote[] {
  return byMember.get(memberId) ?? []
}

/** Notes the kiosk must show before it opens the door. */
export function pinnedNotesFor(memberId: string): MemberNote[] {
  return notesFor(memberId).filter((n) => n.pinned)
}

export function setMemberNotes(next: MemberNote[]): void {
  memberNotes = next
  index()
}

export const NOTE_META: Record<NoteKind, { label: string; tone: 'danger' | 'warn' | 'info' | 'neutral' | 'good' }> = {
  injury: { label: 'Injury', tone: 'danger' },
  complaint: { label: 'Complaint', tone: 'warn' },
  call: { label: 'Call', tone: 'info' },
  goal: { label: 'Goal', tone: 'good' },
  note: { label: 'Note', tone: 'neutral' },
}
