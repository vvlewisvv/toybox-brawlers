/**
 * Global violence presentation toggle (Soft vs Chaos).
 *
 * **Contract — must stay visual-only**
 * Changing {@link ViolenceMode} must not affect simulation timing, damage, hitboxes, hurtboxes,
 * frame data, or any combat tuning. Allowed consumers: UI/settings, DOM attributes for CSS, and
 * render-layer juice (particles, screen flash classes) in `HitFeelController` / `hitFeel.ts`.
 *
 * Do not import this module from `src/gameplay/**` (enforced by `scripts/assert-violence-visual-only.mjs`).
 */

const STORAGE_KEY = 'plushdown.violenceMode'

export type ViolenceMode = 'soft' | 'chaos'

export type ViolenceVfxProfile = {
  sparkCount: number
  sparkSize: number
  hitSparkColor: number
  blockSparkColor: number
}

/** Used for Chaos tuning; Soft mode impact particles are built in `hitFeel.ts` (stuffing / confetti / fabric). */
const SOFT_VFX: ViolenceVfxProfile = {
  sparkCount: 16,
  sparkSize: 0.058,
  hitSparkColor: 0xffc4a8,
  blockSparkColor: 0xa8d8ff,
}

const CHAOS_VFX: ViolenceVfxProfile = {
  sparkCount: 56,
  sparkSize: 0.105,
  hitSparkColor: 0xff3a18,
  blockSparkColor: 0x6aa8ff,
}

function readStored(): ViolenceMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'soft' || v === 'chaos') return v
  } catch {
    /* private / blocked storage */
  }
  return 'soft'
}

let current: ViolenceMode = readStored()

const listeners = new Set<(mode: ViolenceMode) => void>()

export function getViolenceMode(): ViolenceMode {
  return current
}

export function setViolenceMode(mode: ViolenceMode): void {
  if (mode === current) return
  current = mode
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    /* ignore */
  }
  for (const fn of listeners) {
    try {
      fn(mode)
    } catch (err) {
      console.warn('[Plushdown] ViolenceMode listener failed:', err)
    }
  }
}

/** Unsubscribe function. */
export function subscribeViolenceMode(fn: (mode: ViolenceMode) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getViolenceVfxProfile(): ViolenceVfxProfile {
  return current === 'chaos' ? CHAOS_VFX : SOFT_VFX
}
