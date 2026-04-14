import type { FrameSnapshot, InputAction } from '../input'
import { DEFAULT_MOVEMENT } from './character/defaults'
import type { PlaceholderFighter } from './fighterController'
import { isAttackBusy, type AttackKind, type AttackPhase } from './combat/attackTimeline'

/**
 * Vs-bot CPU: spacing, imperfect defense, pressure, whiff/stun punishes, and grounded anti-air reads.
 * Uses only observable fighter state (no input cheats). Tuning lives in {@link arcadeBotTuning}.
 *
 * Set `COMBAT_TEST_BOT_ENABLED` to `false` for a neutral P2 (no CPU input).
 * During vs-bot match, **F2** toggles the CPU at runtime when
 * `COMBAT_TEST_BOT_ALLOW_RUNTIME_TOGGLE` is true.
 *
 * Debug: add `?botAiDebug=1` to the URL for a small overlay (state, target, attack, timers).
 */
export const COMBAT_TEST_BOT_ENABLED = true

/** When true, F2 during vs-bot match flips CPU input on/off. */
export const COMBAT_TEST_BOT_ALLOW_RUNTIME_TOGGLE = true

let runtimeActive = true

export function isCombatTestBotActive(): boolean {
  return COMBAT_TEST_BOT_ENABLED && runtimeActive
}

export function toggleCombatTestBotRuntime(): void {
  if (!COMBAT_TEST_BOT_ALLOW_RUNTIME_TOGGLE) return
  runtimeActive = !runtimeActive
}

/** High-level label for debug + internal reasoning (not a full behavior tree). */
export type ArcadeBotAiPhase =
  | 'idle'
  | 'approach'
  | 'hold'
  | 'retreat'
  | 'pressure'
  | 'reposition'
  | 'block'
  | 'punish'
  | 'anti_air'
  | 'attack'

export type ArcadeBotTuning = {
  /** 0 = timid, 1 = very commit-heavy (movement + attack rolls). */
  aggression: number
  /** Extra delay before attack decisions (seconds). */
  reactionDelayMin: number
  reactionDelayMax: number
  /** Block attempt chance when threatened (by player attack kind). */
  blockChanceVsLight: number
  blockChanceVsHeavy: number
  blockChanceVsSpecial: number
  /** After releasing block, cannot block again for this long. */
  blockCooldownMin: number
  blockCooldownMax: number
  /** Ideal center-to-center spacing the bot tries to hold when pressuring. */
  preferredFightDistance: number
  /** Half-width band around preferred distance treated as “in position”. */
  spacingBand: number
  /** Max distance considered for block reactions. */
  threatMaxDistance: number
  /** Relative weight of heavy at mid range (light = 1). */
  heavyMidWeight: number
  /** Extra attack cooldown stacked after a heavy (anti-spam). */
  heavyExtraCooldownMin: number
  heavyExtraCooldownMax: number
  /** Seconds to keep a walk direction before re-deciding (reduces jitter). */
  stickyMoveMin: number
  stickyMoveMax: number
  /** Start walking in when farther than this. */
  strideInBeyond: number
  /** Back up when closer than this (body overlap / awkward hug). */
  tooCloseDistance: number
  /** Random attack “think” gap base (scaled by aggression). */
  thinkGapMin: number
  thinkGapMax: number
  /** After whiffing (swing, no hit), pause before next commit. */
  whiffRecoverMin: number
  whiffRecoverMax: number
  /** Punish / pressure random helpers (kept sub-tick). */
  punishRecoveryRoll: number
  /** Arena edge margin — if closer than (xLimit - margin), steer toward center. */
  wallAvoidMargin: number
  /** If farther than this from the opponent, never walk away — stops runaway / off-screen hiding. */
  forceApproachBeyondDistance: number
  /** Micro-retreat (shuffle / post-block) only allowed when closer than this. */
  retreatAllowedWithinDistance: number
  /** If |bot X| is beyond (xLimit - this), bias hard back toward the fight (anti corner-camp). */
  edgeLeashInset: number
  /** Amplitude 0–1 for per-bot RNG personality (multiplies small jitters). */
  personalitySpread: number
}

/** Tweak live in code or replace at runtime — jam-friendly balance knobs. */
export const arcadeBotTuning: ArcadeBotTuning = {
  aggression: 0.72,
  reactionDelayMin: 0.04,
  reactionDelayMax: 0.11,
  blockChanceVsLight: 0.26,
  blockChanceVsHeavy: 0.34,
  blockChanceVsSpecial: 0.3,
  blockCooldownMin: 0.38,
  blockCooldownMax: 0.62,
  preferredFightDistance: 0.62,
  spacingBand: 0.14,
  threatMaxDistance: 1.02,
  heavyMidWeight: 0.38,
  heavyExtraCooldownMin: 0.22,
  heavyExtraCooldownMax: 0.42,
  stickyMoveMin: 0.14,
  stickyMoveMax: 0.28,
  strideInBeyond: 0.88,
  tooCloseDistance: 0.36,
  thinkGapMin: 0.05,
  thinkGapMax: 0.14,
  whiffRecoverMin: 0.1,
  whiffRecoverMax: 0.22,
  punishRecoveryRoll: 0.5,
  wallAvoidMargin: 0.55,
  forceApproachBeyondDistance: 2.05,
  retreatAllowedWithinDistance: 0.78,
  edgeLeashInset: 1.05,
  personalitySpread: 0.85,
}

export type ArcadeBotDebugSnapshot = {
  phase: ArcadeBotAiPhase
  targetId: string
  distance: number
  chosenAttack: AttackKind | null
  attackCooldown: number
  thinkTimer: number
  blockCooldown: number
  stickyMoveT: number
  heavyDebt: number
}

let botAiDebugEnabled = false
let botDebugOverlay: HTMLDivElement | null = null
let lastBotDebug: ArcadeBotDebugSnapshot | null = null

/** Call once at boot. Enable with `?botAiDebug=1`. */
export function initArcadeBotDebugFromUrl(): void {
  if (typeof window === 'undefined') return
  try {
    const q = new URLSearchParams(window.location.search)
    if (q.get('botAiDebug') === '1') {
      botAiDebugEnabled = true
      console.info('[Plushdown] arcade bot AI debug on (?botAiDebug=1)')
    }
  } catch {
    /* ignore */
  }
}

export function getArcadeBotDebugSnapshot(): ArcadeBotDebugSnapshot | null {
  return lastBotDebug
}

function ensureBotDebugOverlay(): HTMLDivElement {
  if (botDebugOverlay?.isConnected) return botDebugOverlay
  const el = document.createElement('div')
  el.id = 'plushdown-bot-ai-debug'
  el.setAttribute('aria-hidden', 'true')
  el.style.cssText = [
    'position:fixed',
    'right:8px',
    'bottom:8px',
    'max-width:min(92vw,280px)',
    'padding:8px 10px',
    'margin:0',
    'z-index:11999',
    'font:12px/1.35 system-ui,Segoe UI,sans-serif',
    'color:#e8ecff',
    'background:rgba(12,14,28,0.88)',
    'border:1px solid rgba(120,140,255,0.35)',
    'border-radius:8px',
    'pointer-events:none',
    'white-space:pre-wrap',
  ].join(';')
  document.body.appendChild(el)
  botDebugOverlay = el
  return el
}

function syncBotDebugOverlay(s: ArcadeBotDebugSnapshot): void {
  if (!botAiDebugEnabled) return
  const el = ensureBotDebugOverlay()
  const atk = s.chosenAttack ?? '—'
  el.textContent = [
    `phase: ${s.phase}`,
    `target: ${s.targetId}`,
    `dist: ${s.distance.toFixed(2)}`,
    `attack: ${atk}`,
    `cd: ${s.attackCooldown.toFixed(2)}  think: ${s.thinkTimer.toFixed(2)}`,
    `blockCd: ${s.blockCooldown.toFixed(2)}  move: ${s.stickyMoveT.toFixed(2)}`,
    `heavyDebt: ${s.heavyDebt.toFixed(2)}`,
  ].join('\n')
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function playerThreatPhase(phase: AttackPhase): boolean {
  return phase === 'startup' || phase === 'active'
}

function blockChanceForPlayerAttack(kind: AttackKind | null, t: ArcadeBotTuning): number {
  if (kind === 'heavy') return t.blockChanceVsHeavy
  if (kind === 'special') return t.blockChanceVsSpecial
  return t.blockChanceVsLight
}

/** Approximate max connecting distance per button (pushboxes + reach). */
function strikeReachByKind(
  bot: PlaceholderFighter,
  player: PlaceholderFighter,
): Record<AttackKind, number> {
  const pad = bot.getPushHalfX() + player.getPushHalfX()
  const kinds: AttackKind[] = ['light', 'heavy', 'special']
  const out = {} as Record<AttackKind, number>
  for (const k of kinds) {
    const r = bot.getHitboxShape(k).reach
    out[k] = pad + r * 0.94
  }
  return out
}

function pickAttackKind(args: {
  dist: number
  reach: Record<AttackKind, number>
  punishMode: boolean
  rng: () => number
  t: ArcadeBotTuning
  lastKind: AttackKind | null
  sameAttackStreak: number
  heavyDebt: number
}): AttackKind | null {
  const { dist, reach, punishMode, rng, t, lastKind, sameAttackStreak, heavyDebt } = args

  const inLight = dist <= reach.light * 0.98
  const inHeavy = dist <= reach.heavy * 0.92
  const inSpecial = dist <= reach.special * 0.9

  if (!inLight && !punishMode) {
    if (!inHeavy) return null
  }

  const heavyTax = Math.min(1.15, heavyDebt * 0.38)
  const heavyOk = rng() > heavyTax * 0.55

  const antiSpam =
    sameAttackStreak >= 2 && lastKind != null && rng() < 0.72 ? lastKind : null

  if (punishMode) {
    const r = rng()
    if (dist < reach.light * 0.55) {
      if (r < 0.42) return antiSpam === 'light' ? 'heavy' : 'light'
      if (r < 0.78 && heavyOk) return 'heavy'
      return 'special'
    }
    if (dist < reach.heavy * 0.9) {
      if (r < 0.35) return 'light'
      if (r < 0.82 && heavyOk) return 'heavy'
      return 'special'
    }
    return null
  }

  if (dist <= reach.light * 0.72) {
    const r = rng()
    const lightBias = 0.62 + t.aggression * 0.18
    if (r < lightBias) return antiSpam === 'light' ? (heavyOk ? 'heavy' : 'light') : 'light'
    if (r < lightBias + 0.22 * t.heavyMidWeight && heavyOk)
      return antiSpam === 'heavy' ? 'light' : 'heavy'
    return inSpecial && rng() < 0.18 + t.aggression * 0.08 ? 'special' : 'light'
  }

  if (dist <= reach.heavy * 0.88) {
    const r = rng()
    const midHeavy = 0.28 + t.heavyMidWeight * (0.35 + t.aggression * 0.12)
    if (r < 0.4 - heavyTax * 0.12) return 'light'
    if (r < 0.4 + midHeavy && heavyOk) return antiSpam === 'heavy' ? 'light' : 'heavy'
    if (inSpecial && r < 0.88) return rng() < 0.22 ? 'special' : 'heavy'
    return heavyOk ? 'heavy' : 'light'
  }

  if (inSpecial && rng() < 0.12 + t.aggression * 0.06) return 'special'
  return null
}

export function createCombatTestBotFrameSource(
  tuningOverride?: Partial<ArcadeBotTuning>,
): (bot: PlaceholderFighter, player: PlaceholderFighter, dt: number) => FrameSnapshot {
  const t: ArcadeBotTuning = { ...arcadeBotTuning, ...tuningOverride }
  const rng = mulberry32((Math.random() * 0x7fffffff) | 0)
  const personality = 1 + (rng() - 0.5) * 0.55 * t.personalitySpread

  let attackCooldown = 0
  let heavyDebt = 0
  let lastKind: AttackKind | null = null
  let sameAttackStreak = 0
  let heldBlockLastFrame = false
  let blockCooldown = 0
  let thinkTimer = 0
  let whiffRecoverT = 0
  let wasAttackBusy = false
  let swingStarted = false
  let roundStartEvaluateT = 0.24 + rng() * 0.13
  let retreatTimer = 0
  let lastPhaseLogged: ArcadeBotAiPhase | null = null

  const RETREAT_STEP_MIN = 0.06
  const RETREAT_STEP_MAX = 0.18
  const EDGE_EPS = 0.08
  const ROUND_START_HP_EPS = 0.001

  function logPhaseTransition(next: ArcadeBotAiPhase): void {
    if (lastPhaseLogged === next) return
    lastPhaseLogged = next
    console.info('[bot-ai] state -> ' + next)
  }

  return (bot, player, dt) => {
    const held = new Set<InputAction>()
    const pressed = new Set<InputAction>()
    const released = new Set<InputAction>()
    const snap: FrameSnapshot = { held, pressed, released }

    let debugPhase: ArcadeBotAiPhase = 'idle'
    let debugChosen: AttackKind | null = null

    const lim = DEFAULT_MOVEMENT.xLimit
    const fullHp =
      Math.abs(bot.getHealth().current - bot.getHealth().max) < ROUND_START_HP_EPS &&
      Math.abs(player.getHealth().current - player.getHealth().max) < ROUND_START_HP_EPS
    if (fullHp && attackCooldown <= 0 && whiffRecoverT <= 0) {
      roundStartEvaluateT = Math.max(roundStartEvaluateT, 0.14 + rng() * 0.08)
    }

    if (bot.getHealth().current <= 0) {
      debugPhase = 'idle'
      logPhaseTransition(debugPhase)
      lastBotDebug = {
        phase: debugPhase,
        targetId: player.getCharacterId(),
        distance: Math.abs(bot.getPlanarX() - player.getPlanarX()),
        chosenAttack: null,
        attackCooldown,
        thinkTimer,
        blockCooldown,
        stickyMoveT: retreatTimer,
        heavyDebt,
      }
      syncBotDebugOverlay(lastBotDebug)
      return snap
    }

    if (player.getHealth().current <= 0) {
      logPhaseTransition('idle')
      lastBotDebug = {
        phase: 'idle',
        targetId: player.getCharacterId(),
        distance: Math.abs(bot.getPlanarX() - player.getPlanarX()),
        chosenAttack: null,
        attackCooldown: 0,
        thinkTimer: 0,
        blockCooldown: 0,
        stickyMoveT: retreatTimer,
        heavyDebt: 0,
      }
      syncBotDebugOverlay(lastBotDebug)
      return snap
    }

    attackCooldown = Math.max(0, attackCooldown - dt)
    blockCooldown = Math.max(0, blockCooldown - dt)
    thinkTimer = Math.max(0, thinkTimer - dt)
    retreatTimer = Math.max(0, retreatTimer - dt)
    whiffRecoverT = Math.max(0, whiffRecoverT - dt)
    roundStartEvaluateT = Math.max(0, roundStartEvaluateT - dt)
    heavyDebt = Math.max(0, heavyDebt - dt * 0.42)

    const busy = isAttackBusy(bot.getAttackState())
    const stunned = bot.isCombatStunned()
    const canAct = bot.grounded && !stunned && !busy

    const bx = bot.getPlanarX()
    const px = player.getPlanarX()
    const dist = Math.abs(bx - px)
    const towardPlayer = px > bx ? 1 : -1

    const reach = strikeReachByKind(bot, player)
    const pAtk = player.getAttackState()
    const pStunned = player.isCombatStunned()
    const threat =
      playerThreatPhase(pAtk.phase) && !pStunned && player.grounded && pAtk.kind !== null

    const idealHi = t.preferredFightDistance + t.spacingBand

    const canWalkToward =
      (towardPlayer > 0 && bx < lim - EDGE_EPS) || (towardPlayer < 0 && bx > -lim + EDGE_EPS)
    const canWalkAway =
      (towardPlayer > 0 && bx > -lim + EDGE_EPS) || (towardPlayer < 0 && bx < lim - EDGE_EPS)

    const moveToward = (): void => {
      if (!canWalkToward) return
      if (towardPlayer > 0) held.add('right')
      else held.add('left')
    }
    const moveAway = (): void => {
      if (!canWalkAway) return
      if (towardPlayer > 0) held.add('left')
      else held.add('right')
    }

    if (!canAct) {
      if (busy) {
        swingStarted = true
        debugPhase = 'attack'
      } else if (stunned) {
        debugPhase = 'idle'
      }
      logPhaseTransition(debugPhase)
      heldBlockLastFrame = false
      wasAttackBusy = busy
      lastBotDebug = {
        phase: debugPhase,
        targetId: player.getCharacterId(),
        distance: dist,
        chosenAttack: debugChosen,
        attackCooldown,
        thinkTimer,
        blockCooldown,
        stickyMoveT: retreatTimer,
        heavyDebt,
      }
      syncBotDebugOverlay(lastBotDebug)
      return snap
    }

    if (wasAttackBusy && !busy && swingStarted) {
      swingStarted = false
      if (!bot.isStrikeConsumed() && lastKind !== null) {
        whiffRecoverT = t.whiffRecoverMin + rng() * (t.whiffRecoverMax - t.whiffRecoverMin)
        thinkTimer = Math.max(
          thinkTimer,
          t.reactionDelayMin + rng() * (t.reactionDelayMax - t.reactionDelayMin),
        )
      }
    }
    wasAttackBusy = busy

    // 1) Round start evaluate: brief idle before first engage.
    if (roundStartEvaluateT > 0) {
      debugPhase = 'idle'
      logPhaseTransition(debugPhase)
      heldBlockLastFrame = false
      lastBotDebug = {
        phase: debugPhase,
        targetId: player.getCharacterId(),
        distance: dist,
        chosenAttack: null,
        attackCooldown,
        thinkTimer,
        blockCooldown,
        stickyMoveT: retreatTimer,
        heavyDebt,
      }
      syncBotDebugOverlay(lastBotDebug)
      return snap
    }

    // 2) Optional short tactical retreat only when very close and recently blocking.
    const wasBlockingPrev = heldBlockLastFrame
    const allowRetreatStart =
      wasBlockingPrev &&
      dist < t.retreatAllowedWithinDistance &&
      dist >= t.tooCloseDistance &&
      retreatTimer <= 0 &&
      rng() < 0.28
    if (allowRetreatStart) {
      retreatTimer = RETREAT_STEP_MIN + rng() * (RETREAT_STEP_MAX - RETREAT_STEP_MIN)
    }
    if (retreatTimer > 0) {
      debugPhase = 'retreat'
      moveAway()
      logPhaseTransition(debugPhase)
      heldBlockLastFrame = false
      lastBotDebug = {
        phase: debugPhase,
        targetId: player.getCharacterId(),
        distance: dist,
        chosenAttack: null,
        attackCooldown,
        thinkTimer,
        blockCooldown,
        stickyMoveT: retreatTimer,
        heavyDebt,
      }
      syncBotDebugOverlay(lastBotDebug)
      return snap
    }

    // 3) Imperfect block on threat (never perfect or constant).
    if (blockCooldown <= 0 && threat && dist < t.threatMaxDistance) {
      const kind = pAtk.kind
      const base = blockChanceForPlayerAttack(kind, t)
      const closeBoost = dist < 0.62 ? 1.08 : dist < 0.82 ? 1 : 0.88
      const agg = 1 - t.aggression * 0.22
      const roll = Math.min(0.86, base * closeBoost * agg * personality)
      if (rng() < roll) {
        held.add('block')
        heldBlockLastFrame = true
        blockCooldown = t.blockCooldownMin + rng() * (t.blockCooldownMax - t.blockCooldownMin)
        debugPhase = 'block'
        logPhaseTransition(debugPhase)
        lastBotDebug = {
          phase: debugPhase,
          targetId: player.getCharacterId(),
          distance: dist,
          chosenAttack: null,
          attackCooldown,
          thinkTimer,
          blockCooldown,
          stickyMoveT: retreatTimer,
          heavyDebt,
        }
        syncBotDebugOverlay(lastBotDebug)
        return snap
      }
    }

    heldBlockLastFrame = false
    // 4) Deterministic movement tree: too far -> approach, ideal -> hold, too close -> micro reposition.
    if (dist > idealHi) {
      debugPhase = 'approach'
      moveToward()
    } else if (dist < t.tooCloseDistance) {
      debugPhase = 'reposition'
      moveAway()
    } else {
      debugPhase = 'hold'
    }

    // 5) Attack only when in range and timers are ready.
    const attackReady = attackCooldown <= 0 && whiffRecoverT <= 0 && thinkTimer <= 0
    const inAnyAttackRange = dist <= reach.heavy * 0.9
    const punishMode =
      pStunned ||
      (pAtk.phase === 'recovery' &&
        player.grounded &&
        dist < 0.96 &&
        dist > t.tooCloseDistance * 0.75 &&
        rng() < t.punishRecoveryRoll)

    if (attackReady && inAnyAttackRange) {
      const kind = pickAttackKind({
        dist,
        reach,
        punishMode,
        rng,
        t,
        lastKind,
        sameAttackStreak,
        heavyDebt,
      })
      if (kind) {
        const prevKind = lastKind
        pressed.add(kind)
        lastKind = kind
        sameAttackStreak = kind === prevKind ? sameAttackStreak + 1 : 1
        debugPhase = 'attack'
        debugChosen = kind
        swingStarted = true

        if (kind === 'heavy') {
          heavyDebt += 1
        } else {
          heavyDebt = Math.max(0, heavyDebt - 0.35)
        }

        let cd = 0.36 + rng() * 0.26
        if (kind === 'heavy') {
          cd += t.heavyExtraCooldownMin + rng() * (t.heavyExtraCooldownMax - t.heavyExtraCooldownMin)
        }
        if (kind === 'special') cd += 0.28 + rng() * 0.26
        if (punishMode) cd *= 0.78 + rng() * 0.12
        attackCooldown = cd
        thinkTimer =
          t.reactionDelayMin * personality +
          rng() * (t.reactionDelayMax - t.reactionDelayMin) * personality +
          (t.thinkGapMin + rng() * (t.thinkGapMax - t.thinkGapMin)) * personality
      }
    }

    // 6) Safety clamp: if already at edge, suppress outward movement.
    if (bx >= lim - EDGE_EPS) held.delete('right')
    if (bx <= -lim + EDGE_EPS) held.delete('left')

    logPhaseTransition(debugPhase)
    lastBotDebug = {
      phase: debugPhase,
      targetId: player.getCharacterId(),
      distance: dist,
      chosenAttack: debugChosen,
      attackCooldown,
      thinkTimer,
      blockCooldown,
      stickyMoveT: retreatTimer,
      heavyDebt,
    }
    syncBotDebugOverlay(lastBotDebug)
    return snap
  }
}
