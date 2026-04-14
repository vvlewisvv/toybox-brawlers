import type { Object3D } from 'three'

/**
 * Fixed world Z for all combatants. Matches the toybox stage line-up (see `toyboxArena.ts`).
 * Gameplay never integrates velocity on Z — only X (footsies) and Y (jump).
 */
export const FIGHT_PLANE_Z = 0

/**
 * Hard-lock depth and out-of-plane tilt after any transform. Visuals stay 3D meshes;
 * motion stays on a single vertical sheet (2D fighting plane).
 */
export function snapRootToFightingPlane(root: Object3D): void {
  root.position.z = FIGHT_PLANE_Z
  root.rotation.x = 0
  root.rotation.z = 0
}
