/**
 * Password hashing, on the Workers runtime.
 *
 * PBKDF2 through Web Crypto rather than bcrypt or argon2: those are native
 * addons, and a Worker has no Node bindings to load them with. Web Crypto is
 * part of the runtime itself, so this adds no dependency and no cold-start cost.
 *
 * 210,000 iterations of SHA-256 is OWASP's 2023 floor for PBKDF2-HMAC-SHA256.
 * It costs roughly 80–120ms of Worker CPU per verification, which is why sign-in
 * is the most expensive procedure in the API and why nothing else calls it.
 *
 * The salt is per password, 16 random bytes, and is stored beside the hash — a
 * salt is not a secret, it exists so two people choosing the same password do
 * not land on the same hash.
 */

const ITERATIONS = 210_000
const KEY_BITS = 256
const SALT_BYTES = 16

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

async function derive(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    KEY_BITS,
  )
  return toHex(bits)
}

export interface PasswordRecord {
  hash: string
  salt: string
}

export async function hashPassword(password: string): Promise<PasswordRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  return { hash: await derive(password, salt), salt: toHex(salt.buffer) }
}

/**
 * Compared byte by byte over the whole string rather than with `===`.
 *
 * String equality returns as soon as two characters differ, so the time it takes
 * leaks how much of the hash was guessed correctly. Accumulating the difference
 * makes every comparison cost the same regardless of the input.
 */
export async function verifyPassword(
  password: string,
  record: PasswordRecord,
): Promise<boolean> {
  const candidate = await derive(password, fromHex(record.salt))
  if (candidate.length !== record.hash.length) return false
  let diff = 0
  for (let i = 0; i < candidate.length; i++) {
    diff |= candidate.charCodeAt(i) ^ record.hash.charCodeAt(i)
  }
  return diff === 0
}

/** 256 bits of entropy, hex encoded — the session token and the account id. */
export function randomId(bytes = 32): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)).buffer)
}
