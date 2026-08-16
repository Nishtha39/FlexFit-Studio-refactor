'use client'

/**
 * Where the browser keeps its session token.
 *
 * localStorage rather than a cookie, matching the bearer-token scheme the auth
 * router uses. It survives a reload and a closed tab, which is what "keep me
 * signed in" promises, and it is readable by script — so the token is given a
 * 30-day expiry server-side and sign-out deletes the row rather than merely
 * forgetting the value here.
 *
 * Every read is guarded for `window`: the app is statically exported, so this
 * module is evaluated during the build in Node, where localStorage is absent.
 */

const KEY = 'flexfit.session'

export interface StoredUser {
  id: string
  email: string
  name: string
  role: 'owner' | 'front_desk' | 'trainer' | 'member'
  landing: string
}

interface Stored {
  token: string
  user: StoredUser
}

export function readSession(): Stored | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Stored
  } catch {
    // A half-written or hand-edited value is not worth a crash on every page.
    window.localStorage.removeItem(KEY)
    return null
  }
}

export function writeSession(session: Stored): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(KEY, JSON.stringify(session))
}

export function clearSession(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(KEY)
}

export function sessionToken(): string | null {
  return readSession()?.token ?? null
}
