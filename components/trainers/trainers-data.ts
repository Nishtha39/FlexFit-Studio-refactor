// Trainer derivations: load, fill rate and the retention of the members each
// trainer is responsible for. Everything is computed from classes + members so
// a trainer's numbers reconcile with the schedule and the retention screen.

import { classes } from '@/lib/data/classes'
import { members } from '@/lib/data/members'
import { staff, trainers } from '@/lib/data/staff'
import { WEEKDAY_LABELS } from '@/lib/seed'
import type { GymClass, Member, Staff } from '@/lib/types'

export interface TrainerLoad {
  trainer: Staff
  classes: GymClass[]
  /** Weekly contact hours from scheduled classes. */
  hours: number
  seats: number
  booked: number
  fillRate: number
  waitlisted: number
  /** Members with this trainer assigned. */
  clients: Member[]
  atRiskClients: number
  /** Share of assigned clients in the low-risk band. */
  clientRetention: number
  monthlyValue: number
}

export function loadFor(trainer: Staff): TrainerLoad {
  const own = classes.filter((c) => c.trainerId === trainer.id)
  const seats = own.reduce((s, c) => s + c.capacity, 0)
  const booked = own.reduce((s, c) => s + c.roster.length, 0)
  const clients = members.filter((m) => m.assignedTrainerId === trainer.id)
  const lowRisk = clients.filter((m) => m.risk.band === 'low').length
  return {
    trainer,
    classes: own.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)),
    hours: own.reduce((s, c) => s + c.durationMin, 0) / 60,
    seats,
    booked,
    fillRate: seats === 0 ? 0 : (booked / seats) * 100,
    waitlisted: own.reduce((s, c) => s + c.waitlist.length, 0),
    clients,
    atRiskClients: clients.filter((m) => m.risk.band === 'high').length,
    clientRetention: clients.length === 0 ? 0 : (lowRisk / clients.length) * 100,
    monthlyValue: clients.reduce((s, m) => s + m.metrics.monthlyValue, 0),
  }
}

export const trainerLoads: TrainerLoad[] = trainers
  .map(loadFor)
  .sort((a, b) => Number(b.trainer.active) - Number(a.trainer.active) || b.fillRate - a.fillRate)

export function getTrainerLoad(id: string): TrainerLoad | undefined {
  const trainer = staff.find((s) => s.id === id && s.role === 'trainer')
  return trainer ? loadFor(trainer) : undefined
}

/** Weekly grid rows for the trainer detail: one entry per class, day-labelled. */
export function weeklySlots(load: TrainerLoad): { day: string; index: number; slots: GymClass[] }[] {
  return WEEKDAY_LABELS.map((day, index) => ({
    day,
    index,
    slots: load.classes.filter((c) => c.dayOfWeek === index),
  })).filter((row) => row.slots.length > 0)
}

/** The departed trainer is kept on the roster — their classes had to be covered. */
export const departedTrainers = trainers.filter((t) => !t.active)

export interface PayrollLine {
  label: string
  detail: string
  amount: number
}

const HOURLY_RATE = 900
const PER_HEAD_BONUS = 40

export function payroll(load: TrainerLoad): PayrollLine[] {
  const base = Math.round(load.hours * 4.33 * HOURLY_RATE)
  const bonus = Math.round(load.booked * 4.33 * PER_HEAD_BONUS)
  return [
    { label: 'Contact hours', detail: `${(load.hours * 4.33).toFixed(1)} hrs/mo at ₹${HOURLY_RATE}/hr`, amount: base },
    { label: 'Attendance bonus', detail: `${Math.round(load.booked * 4.33)} check-ins at ₹${PER_HEAD_BONUS}`, amount: bonus },
    { label: 'Monthly total', detail: 'Before statutory deductions', amount: base + bonus },
  ]
}
