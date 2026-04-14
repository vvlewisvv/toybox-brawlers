import { Box3, Vector3 } from 'three'
import type { PlaceholderFighter } from '../fighterController'
import { FIGHT_PLANE_Z } from '../fightingPlane'
export type FighterCollisionVolumes = {
  hurt: Box3
  push: Box3
  hit: Box3 | null
}

const tmpDir = new Vector3()

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

  const hurtHalfX = 0.34
  const aerialHurt = !self.grounded
  /** Taller, slightly raised hurt while airborne — jump arc and anti-air connect read cleanly. */
  const hurtHalfY = stand * 0.95 * (aerialHurt ? 1.2 : 1)
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
    const center = new Vector3().copy(root).addScaledVector(tmpDir, prof.reach)
    center.z = FIGHT_PLANE_Z
    let halfY = prof.halfY
    if (!opponent.grounded) {
      halfY *= 1.15
      center.y += 0.12
    }
    hit = new Box3().setFromCenterAndSize(
      center,
      new Vector3(prof.halfX * 2, halfY * 2, prof.halfZ * 2),
    )
  }

  return { hurt, push, hit }
}
