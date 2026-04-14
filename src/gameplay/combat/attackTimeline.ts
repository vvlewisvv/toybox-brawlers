import type { FrameSnapshot } from '../../input'

export type AttackKind = 'light' | 'heavy' | 'special'

export type AttackFrameDurations = {
  startup: number
  active: number
  recoveryOnConnect: number
  recoveryOnWhiff: number
}

export type AttackFramesByKind = Record<AttackKind, AttackFrameDurations>

export type AttackPhase = 'idle' | 'startup' | 'active' | 'recovery'

export type AttackState = {
  kind: AttackKind | null
  phase: AttackPhase
  timeInPhase: number
  /** Seconds for the current recovery segment (connect vs whiff). */
  recoveryDuration: number
}

export type AttackAdvanceHooks = {
  onBeginSwing: () => void
  getSwingConnected: () => boolean
  clearSwingConnected: () => void
}

export const ATTACK_FRAMES: AttackFramesByKind = {
  light: { startup: 0.07, active: 0.05, recoveryOnConnect: 0.1, recoveryOnWhiff: 0.17 },
  heavy: { startup: 0.13, active: 0.07, recoveryOnConnect: 0.17, recoveryOnWhiff: 0.32 },
  special: { startup: 0.18, active: 0.095, recoveryOnConnect: 0.22, recoveryOnWhiff: 0.38 },
}

/**
 * Nominal attack cycle length for **animation** sync: full startup → active → recovery.
 * Uses max(connect, whiff) recovery so clip time-scale stays stable for the whole swing
 * (gameplay still branches recovery length in {@link advanceAttackState}).
 */
export function attackFullCycleForAnimSync(frames: AttackFrameDurations): number {
  return (
    frames.startup +
    frames.active +
    Math.max(frames.recoveryOnConnect, frames.recoveryOnWhiff)
  )
}

export function createIdleAttackState(): AttackState {
  return { kind: null, phase: 'idle', timeInPhase: 0, recoveryDuration: 0 }
}

export function isAttackBusy(state: AttackState): boolean {
  return state.phase !== 'idle'
}

function phaseDuration(
  frames: AttackFramesByKind,
  kind: AttackKind,
  phase: Exclude<AttackPhase, 'idle'>,
  state: AttackState,
): number {
  const d = frames[kind]
  switch (phase) {
    case 'startup':
      return d.startup
    case 'active':
      return d.active
    case 'recovery':
      return state.recoveryDuration
    default:
      return 0
  }
}

function nextPhase(p: AttackPhase): AttackPhase {
  if (p === 'startup') return 'active'
  if (p === 'active') return 'recovery'
  if (p === 'recovery') return 'idle'
  return 'idle'
}

/** Same-frame priority: special > heavy > light. */
function readAttackPress(snapshot: FrameSnapshot): AttackKind | null {
  if (snapshot.pressed.has('special')) return 'special'
  if (snapshot.pressed.has('heavy')) return 'heavy'
  if (snapshot.pressed.has('light')) return 'light'
  return null
}

/**
 * Advances startup → active → recovery → idle. Mutates `state`.
 * Recovery length branches on whether the strike connected (hit or block) during active.
 */
export function advanceAttackState(
  state: AttackState,
  snapshot: FrameSnapshot,
  dt: number,
  canStartNew: boolean,
  hooks: AttackAdvanceHooks,
  frames: AttackFramesByKind = ATTACK_FRAMES,
): void {
  if (state.phase === 'idle') {
    if (canStartNew) {
      const cmd = readAttackPress(snapshot)
      if (cmd) {
        hooks.onBeginSwing()
        state.kind = cmd
        state.phase = 'startup'
        state.timeInPhase = 0
        state.recoveryDuration = 0
      }
    }
    return
  }

  const kind = state.kind
  if (!kind) {
    state.phase = 'idle'
    state.timeInPhase = 0
    state.recoveryDuration = 0
    return
  }

  let t = state.timeInPhase + dt
  for (;;) {
    const rawDur = phaseDuration(
      frames,
      kind,
      state.phase as Exclude<AttackPhase, 'idle'>,
      state,
    )
    const dur = Math.max(1e-5, rawDur)
    if (t < dur) {
      state.timeInPhase = t
      return
    }
    t -= dur
    const np = nextPhase(state.phase)

    if (state.phase === 'active' && np === 'recovery') {
      const d = frames[kind]
      const connected = hooks.getSwingConnected()
      state.recoveryDuration = connected ? d.recoveryOnConnect : d.recoveryOnWhiff
      hooks.clearSwingConnected()
    }

    if (np === 'idle') {
      state.kind = null
      state.phase = 'idle'
      state.timeInPhase = 0
      state.recoveryDuration = 0
      return
    }

    state.phase = np
  }
}
