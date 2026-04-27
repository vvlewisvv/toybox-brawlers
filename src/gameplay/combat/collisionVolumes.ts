import { Box3, Vector3 } from 'three'
import type { PlaceholderFighter } from '../fighterController'
import { FIGHT_PLANE_Z } from '../fightingPlane'
export type FighterCollisionVolumes = {
  hurt: Box3
  push: Box3
  hit: Box3 | null
}

const tmpDir = new Vector3()
const BASE_PUSH_HALF_X = 0.36
const BASE_STAND_HALF_HEIGHT = 1

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/**
 * Axis-aligned hurt (vulnerable), push (spacing), and hit (strike) volumes for one fighter.
 * Hitbox exists only during the active window of an attack.
 */
export function computeFighterCollisionVolumes(
  self: PlaceholderFighter,
  opponent: PlaceholderFighter,
): FighterCollisionVolumes {
  const root = self.mesh.root.position
  const scaleY = self.mesh.root.scale.y
  const stand = self.mesh.standHalfHeight * scaleY
  const planarX = self.getPlanarX()
  const pushHalfX = self.getPushHalfX()

  /**
   * Size-aware collision scaling:
   * - X scales from push width (small cast = tighter body volume, bruiser = wider body volume)
   * - Y scales from visual stand height so tall rigs do not whiff through shoulders/head
   */
  const widthScale = clamp(pushHalfX / BASE_PUSH_HALF_X, 0.78, 1.34)
  const heightScale = clamp(stand / BASE_STAND_HALF_HEIGHT, 0.86, 1.36)
  const hurtHalfX = 0.34 * widthScale
  const aerialHurt = !self.grounded
  /** Taller, slightly raised hurt while airborne — jump arc and anti-air connect read cleanly. */
  const hurtHalfY = stand * 0.95 * heightScale * (aerialHurt ? 1.2 : 1)
  const hurtHalfZ = 0.22
  const hurtLiftY = aerialHurt ? stand * 0.09 : 0
  const hurt = new Box3().setFromCenterAndSize(
    new Vector3(root.x, root.y + hurtLiftY, FIGHT_PLANE_Z),
    new Vector3(hurtHalfX * 2, hurtHalfY * 2, hurtHalfZ * 2),
  )

  const feetY = root.y - stand
  const pushCenterY = feetY + 0.72
  const pushHalfY = 0.68
  const pushHalfZ = 0.14
  const push = new Box3().setFromCenterAndSize(
    new Vector3(planarX, pushCenterY, FIGHT_PLANE_Z),
    new Vector3(pushHalfX * 2, pushHalfY * 2, pushHalfZ * 2),
  )

  const atk = self.getAttackState()
  let hit: Box3 | null = null
  if (atk.phase === 'active' && atk.kind) {
    const prof = self.getHitboxShape(atk.kind)
    const oppRoot = opponent.mesh.root.position
    tmpDir.set(oppRoot.x - root.x, 0, oppRoot.z - root.z)
    if (tmpDir.lengthSq() < 1e-8) {
      tmpDir.set(1, 0, 0)
    } else {
      tmpDir.normalize()
    }
    /**
     * Keep authored strike profiles, but normalize by body footprint so distance feels
     * consistent across very small vs very large fighters.
     */
    const reachScale = clamp(0.8 + widthScale * 0.2, 0.86, 1.14)
    const center = new Vector3().copy(root).addScaledVector(tmpDir, prof.reach * reachScale)
    center.z = FIGHT_PLANE_Z
    let halfY = prof.halfY * heightScale
    const halfX = prof.halfX * widthScale
    const halfZ = prof.halfZ * clamp(0.9 + widthScale * 0.1, 0.88, 1.18)
    if (!opponent.grounded) {
      halfY *= 1.15
      center.y += 0.12
    }
    hit = new Box3().setFromCenterAndSize(
      center,
      new Vector3(halfX * 2, halfY * 2, halfZ * 2),
    )
  }

  return { hurt, push, hit }
}
