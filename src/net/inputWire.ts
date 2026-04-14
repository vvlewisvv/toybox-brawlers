import type { InputAction } from '../input'
import type { FrameSnapshot } from '../input'

export type WireFrame = {
  h: readonly string[]
  p: readonly string[]
  r: readonly string[]
}

const ACTIONS: ReadonlySet<string> = new Set([
  'left',
  'right',
  'crouch',
  'jump',
  'block',
  'light',
  'heavy',
  'special',
])

function asActions(arr: readonly string[]): Set<InputAction> {
  const s = new Set<InputAction>()
  for (const x of arr) {
    if (ACTIONS.has(x)) s.add(x as InputAction)
  }
  return s
}

export function snapshotToWire(s: FrameSnapshot): WireFrame {
  return {
    h: [...s.held],
    p: [...s.pressed],
    r: [...s.released],
  }
}

export function wireToSnapshot(w: WireFrame): FrameSnapshot {
  return {
    held: asActions(w.h),
    pressed: asActions(w.p),
    released: asActions(w.r),
  }
}

/** Fresh neutral frame for lockstep bootstrap / padding (independent Sets). */
export function neutralFrameSnapshot(): FrameSnapshot {
  return {
    held: new Set(),
    pressed: new Set(),
    released: new Set(),
  }
}
