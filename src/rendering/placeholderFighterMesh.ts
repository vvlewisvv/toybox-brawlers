import { BoxGeometry, Group, Mesh, SphereGeometry } from 'three'
import type { Object3D } from 'three'
import type { ImportedGlbAnimationHandle } from './importedGlbAnimation'
import { applyProceduralVisualSizing } from '../gameplay/character/characterVisualSizing'
import { createPlushFabricMaterial, createPlushSoftPatchMaterial } from './plushMaterials'

/** Optional named parts for transform-based combat presentation (arms / head wobble). */
export type PlushPresentationRig = {
  armL?: Object3D
  armR?: Object3D
  head?: Object3D
}

export type PlaceholderFighterMesh = {
  root: Group
  /**
   * Visual subtree under the axis-locked root: KO tilt / flop applies here so hurtboxes
   * stay aligned with {@link root} position + Y rotation.
   */
  visuals: Group
  body: Mesh
  /** Unscaled vertical half-extent of the body (used for feet / ground contact). */
  standHalfHeight: number
  rig?: PlushPresentationRig
  /**
   * Imported GLB skinned mesh: apply procedural lean / squash here instead of `body`
   * so the skeleton stays in bind pose while the whole model tilts for combat read.
   */
  proceduralMotionRoot?: Object3D
  /** Optional skeleton clip mixer (updated once per frame via fighter API). */
  importedGlbAnim?: ImportedGlbAnimationHandle
  /** Grounding offset for {@link proceduralMotionRoot}; idle bob is added on top each frame. */
  proceduralMotionRootBaseY?: number
}

/** Shared structure: `root` only gets position + facing Y; all plush geometry lives in `visuals`. */
export function createFighterVisualsRoot(): { root: Group; visuals: Group } {
  const root = new Group()
  const visuals = new Group()
  root.add(visuals)
  return { root, visuals }
}

export type PlaceholderFighterMeshOptions = {
  bodyColor?: number
  headColor?: number
  /** Roster id for `characterVisualSizing` (default `placeholder_default`). */
  fighterId?: string
}

/**
 * Simple plush-toy read: soft box + small head, no external assets.
 */
export function createPlaceholderFighterMesh(
  options: PlaceholderFighterMeshOptions = {},
): PlaceholderFighterMesh {
  const fighterId = options.fighterId ?? 'placeholder_default'
  const { root, visuals } = createFighterVisualsRoot()

  const fabric = createPlushFabricMaterial(options.bodyColor ?? 0xc6a26d, {
    roughness: 0.88,
    sheen: 0.62,
  })

  const body = new Mesh(new BoxGeometry(0.56, 1.36, 0.44), fabric)
  body.castShadow = false
  body.receiveShadow = false
  visuals.add(body)

  const headMat = createPlushSoftPatchMaterial(options.headColor ?? 0xd4b896, {
    roughness: 0.88,
    sheen: 0.55,
  })
  const head = new Mesh(new SphereGeometry(0.28, 12, 10), headMat)
  head.position.set(0, 0.72, 0.06)
  visuals.add(head)

  const assets: PlaceholderFighterMesh = {
    root,
    visuals,
    body,
    standHalfHeight: 0.68,
    rig: { head },
  }
  applyProceduralVisualSizing(assets, fighterId)
  return assets
}

export function disposePlaceholderFighterMesh(assets: PlaceholderFighterMesh): void {
  assets.importedGlbAnim?.dispose()
  assets.root.traverse((obj) => {
    if (obj instanceof Mesh) {
      obj.geometry.dispose()
      const mat = obj.material
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat.dispose()
    }
  })
  assets.root.removeFromParent()
}
