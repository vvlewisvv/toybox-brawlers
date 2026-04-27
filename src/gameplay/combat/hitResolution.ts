import { Box3, Vector3 } from 'three'
import type { FrameSnapshot } from '../../input'
import type { PlaceholderFighter } from '../fighterController'
import type { AttackKind } from './attackTimeline'
import type { FighterCollisionVolumes } from './collisionVolumes'
import { COMBAT_TUNING } from './combatTuning'

export type StrikeResolveResult =
  | { ok: false }
  | { ok: true; blocked: boolean; impact: Vector3; strikeDir: Vector3; strikeKind: AttackKind }

const tmpImpact = new Vector3()
const tmpStrikeDir = new Vector3()

type PushbackPair = {
  attacker: number
  defender: number
}

function pushbackForStrike(kind: AttackKind, blocked: boolean): PushbackPair {
  return blocked ? COMBAT_TUNING.pushback.block[kind] : COMBAT_TUNING.pushback.hit[kind]
}

function applyStrikePushback(
  attacker: PlaceholderFighter,
  defender: PlaceholderFighter,
  strikeDir: Vector3,
  kind: AttackKind,
  blocked: boolean,
): void {
  const p = pushbackForStrike(kind, blocked)
  if (p.attacker > 0) {
    attacker.shiftPlanarX(-strikeDir.x * p.attacker)
  }
  if (p.defender > 0) {
    defender.shiftPlanarX(strikeDir.x * p.defender)
  }
}

function planarStrikeDir(
  attacker: PlaceholderFighter,
  defender: PlaceholderFighter,
  out: Vector3,
): Vector3 {
  const pa = attacker.getPlanarPosition()
  const pb = defender.getPlanarPosition()
  out.set(pb.x - pa.x, 0, pb.z - pa.z)
  if (out.lengthSq() < 1e-8) {
    out.set(1, 0, 0)
  } else {
    out.normalize()
  }
  return out
}

function intersectionCenter(a: Box3, b: Box3, out: Vector3): Vector3 {
  const minX = Math.max(a.min.x, b.min.x)
  const maxX = Math.min(a.max.x, b.max.x)
  const minY = Math.max(a.min.y, b.min.y)
  const maxY = Math.min(a.max.y, b.max.y)
  const minZ = Math.max(a.min.z, b.min.z)
  const maxZ = Math.min(a.max.z, b.max.z)
  out.set((minX + maxX) * 0.5, (minY + maxY) * 0.5, (minZ + maxZ) * 0.5)
  return out
}

function defenderBlocking(
  defender: PlaceholderFighter,
  snapshot: FrameSnapshot,
): boolean {
  return (
    defender.grounded &&
    !defender.isCombatStunned() &&
    snapshot.held.has('block')
  )
}

/**
 * One attacker vs one defender. Safe to call with bot idle (no active hitbox).
 * At most one connect per attack active window (`strike consumed` on attacker).
 */
export function resolveStrike(
  attacker: PlaceholderFighter,
  defender: PlaceholderFighter,
  attackerSnap: FrameSnapshot,
  defenderSnap: FrameSnapshot,
  volAtt: FighterCollisionVolumes,
  volDef: FighterCollisionVolumes,
): StrikeResolveResult {
  void attackerSnap
  const atk = attacker.getAttackState()
  if (atk.phase !== 'active' || !atk.kind) return { ok: false }
  if (!volAtt.hit) return { ok: false }
  if (attacker.isStrikeConsumed()) return { ok: false }
  if (!volAtt.hit.intersectsBox(volDef.hurt)) return { ok: false }

  const kind = atk.kind as AttackKind
  intersectionCenter(volAtt.hit, volDef.hurt, tmpImpact)
  const impact = tmpImpact.clone()
  planarStrikeDir(attacker, defender, tmpStrikeDir)
  const strikeDir = tmpStrikeDir.clone()

  attacker.markSwingConnected()

  const strike = attacker.getStrikeOutcome(kind)
  const blocked = defenderBlocking(defender, defenderSnap)
  if (blocked) {
    defender.applyBlockStun(strike.blockStunDefender)
    attacker.applyBlockStun(strike.blockStunAttacker)
  } else {
    defender.applyDamage(strike.damage)
    defender.applyHitStun(strike.hitStun)
  }
  applyStrikePushback(attacker, defender, strikeDir, kind, blocked)

  attacker.markStrikeConsumed()
  return { ok: true, blocked, impact, strikeDir, strikeKind: kind }
}
