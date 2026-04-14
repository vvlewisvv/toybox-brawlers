import {
  Box3,
  BoxGeometry,
  Bone,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshPhongMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Vector3,
} from 'three'
import type { Object3D } from 'three'
import { getGlbFighterImportOverrides } from '../gameplay/character/glbFighterImportConfig'
import { boxWorldHeightY, resolveGlbVisualScale } from '../gameplay/character/characterVisualSizing'
import type { PlushPresentationRig } from './placeholderFighterMesh'

const _geomWorldBox = new Box3()

/**
 * World-space AABB union of **visible** {@link Mesh} geometry under `root` (includes {@link SkinnedMesh}).
 * Uses each mesh’s `geometry.boundingBox` transformed by `matrixWorld`, so armatures / empty nodes /
 * invisible proxies do not inflate the box. Falls back to {@link Box3.setFromObject} when no geometry is found.
 */
export function computeVisibleMeshesWorldBox(root: Object3D): Box3 {
  const result = new Box3()
  let any = false
  root.updateMatrixWorld(true)
  root.traverse((obj) => {
    if (!obj.visible) return
    if (!(obj instanceof Mesh) || !obj.geometry) return
    const geom = obj.geometry
    if (!geom.boundingBox) geom.computeBoundingBox()
    if (!geom.boundingBox || geom.boundingBox.isEmpty()) return
    _geomWorldBox.copy(geom.boundingBox).applyMatrix4(obj.matrixWorld)
    if (!any) {
      result.copy(_geomWorldBox)
      any = true
    } else {
      result.union(_geomWorldBox)
    }
  })
  if (!any) result.makeEmpty()
  return result
}

export type StandardGlbHolderSizing = {
  scale: number
  effectiveHeight: number
  relative: number
  uniform: number
  visualsY: number
  intrinsicY: number
  finalBoxHeight: number
  measuredMode: string
  standHalfHeight: number
  proceduralMotionRootBaseY: number
}

/**
 * Single sizing path for rigged GLB holders: measure visible mesh height → normalize to {@link REFERENCE_VISUAL_HEIGHT} → × roster relative scale;
 * ground using visible mesh feet; apply {@link getGlbFighterImportOverrides} yaw / Y nudge. `[GLB_IMPORT]` logs run in `glbFighterPipeline` after mount.
 */
export function applyStandardGlbHolderSizing(holder: Group, fighterId: string): StandardGlbHolderSizing {
  holder.updateMatrixWorld(true)

  let measuredMode = 'visibleMeshes'
  let box0 = computeVisibleMeshesWorldBox(holder)
  if (box0.isEmpty() || boxWorldHeightY(box0) < 1e-5) {
    box0 = new Box3().setFromObject(holder)
    measuredMode = 'setFromObject(fallback)'
  }
  const intrinsicY = boxWorldHeightY(box0)

  const { scale, effectiveHeight, relative, uniform, visualsY } = resolveGlbVisualScale(box0, fighterId)
  const imp = getGlbFighterImportOverrides(fighterId)

  holder.scale.setScalar(scale)
  if (imp.visualYawOffsetRad) holder.rotation.y += imp.visualYawOffsetRad
  holder.updateMatrixWorld(true)

  let boxFinal = computeVisibleMeshesWorldBox(holder)
  if (boxFinal.isEmpty() || boxWorldHeightY(boxFinal) < 1e-5) {
    boxFinal = new Box3().setFromObject(holder)
  }
  const finalBoxHeight = boxWorldHeightY(boxFinal)

  const standHalfHeight = effectiveHeight * 0.5
  const groundBox = computeVisibleMeshesWorldBox(holder)
  const minY =
    !groundBox.isEmpty() && boxWorldHeightY(groundBox) >= 1e-5 ? groundBox.min.y : boxFinal.min.y
  holder.position.y = -standHalfHeight - minY + visualsY + (imp.modelYOffset ?? 0)
  const proceduralMotionRootBaseY = holder.position.y

  return {
    scale,
    effectiveHeight,
    relative,
    uniform,
    visualsY,
    intrinsicY,
    finalBoxHeight,
    measuredMode,
    standHalfHeight,
    proceduralMotionRootBaseY,
  }
}

export function normBoneName(name: string): string {
  return name.toLowerCase().replace(/[\s_-]+/g, '')
}

/**
 * Prefer forearm / lower arm bones so combat swings read at the elbow–hand chain
 * (upper-arm-only rotation looks like “T-pose shoulders”).
 */
export function tryPresentationRigFromGlbBones(root: Object3D): PlushPresentationRig | undefined {
  const bones: Bone[] = []
  root.traverse((o) => {
    if (o instanceof Bone) bones.push(o)
  })
  if (!bones.length) return undefined

  const sideMatch = (n: string, right: boolean): boolean => {
    const isR = n.includes('right') || n.endsWith('r') || n.includes('.r')
    const isL = n.includes('left') || n.endsWith('l') || n.includes('.l')
    return right ? isR : isL
  }

  const pickForearm = (right: boolean): Bone | undefined => {
    for (const b of bones) {
      const n = normBoneName(b.name)
      if (!sideMatch(n, right)) continue
      if (n.includes('forearm') || n.includes('lowerarm') || n.includes('lower_arm')) return b
    }
    for (const b of bones) {
      const n = normBoneName(b.name)
      if (!sideMatch(n, right)) continue
      if (n.includes('elbow')) return b
    }
    return undefined
  }

  const pickUpperArm = (right: boolean): Bone | undefined => {
    for (const b of bones) {
      const n = normBoneName(b.name)
      if (!sideMatch(n, right)) continue
      if (n.includes('arm') || n.includes('hand') || n.includes('shoulder')) return b
    }
    return undefined
  }

  const armR = pickForearm(true) ?? pickUpperArm(true)
  const armL = pickForearm(false) ?? pickUpperArm(false)

  const pickHead = (): Bone | undefined => {
    for (const b of bones) {
      const n = normBoneName(b.name)
      if (n.includes('head') && !n.includes('tail')) return b
    }
    return undefined
  }

  const head = pickHead()
  if (!armR && !armL && !head) return undefined
  return { armR, armL, head }
}

export function upgradeToPhysicalForCombat(mesh: Mesh): MeshPhysicalMaterial {
  const m = mesh.material
  const first = Array.isArray(m) ? m[0] : m
  if (first instanceof MeshPhysicalMaterial) {
    return first
  }
  if (first instanceof MeshStandardMaterial) {
    const p = new MeshPhysicalMaterial({
      color: first.color.clone(),
      map: first.map,
      normalMap: first.normalMap,
      roughness: first.roughness,
      metalness: first.metalness,
      emissive: new Color(0x000000),
      emissiveIntensity: 0,
      envMapIntensity: first.envMapIntensity,
    })
    first.dispose()
    mesh.material = p
    return p
  }
  if (first instanceof MeshLambertMaterial) {
    const p = new MeshPhysicalMaterial({
      color: first.color.clone(),
      map: first.map,
      emissive: first.emissive.clone(),
      emissiveIntensity: first.emissiveIntensity,
      roughness: 0.9,
      metalness: 0,
      envMapIntensity: 1,
    })
    first.dispose()
    mesh.material = p
    return p
  }
  if (first instanceof MeshBasicMaterial) {
    const p = new MeshPhysicalMaterial({
      color: first.color.clone(),
      map: first.map,
      roughness: 0.88,
      metalness: 0,
      emissive: new Color(0x000000),
      emissiveIntensity: 0,
      envMapIntensity: 1,
    })
    first.dispose()
    mesh.material = p
    return p
  }
  if (first instanceof MeshPhongMaterial) {
    const rough = Math.max(0.35, Math.min(1, 1 - first.shininess / 120))
    const p = new MeshPhysicalMaterial({
      color: first.color.clone(),
      map: first.map,
      normalMap: first.normalMap,
      emissive: first.emissive.clone(),
      emissiveIntensity: first.emissiveIntensity,
      roughness: rough,
      metalness: 0,
      envMapIntensity: 1,
    })
    first.dispose()
    mesh.material = p
    return p
  }
  const p = new MeshPhysicalMaterial({
    color: 0xa67d52,
    roughness: 0.78,
    metalness: 0,
    emissive: new Color(0x000000),
    emissiveIntensity: 0,
  })
  if (first && typeof first.dispose === 'function') {
    first.dispose()
  }
  mesh.material = p
  return p
}

export function pickTorsoMesh(root: Object3D, proxyName: string): Mesh {
  let named: Mesh | null = null
  let largest: Mesh | null = null
  let bestVol = 0
  const size = new Vector3()
  root.updateMatrixWorld(true)
  root.traverse((o) => {
    if (!(o instanceof Mesh) || !o.geometry) return
    const n = o.name.toLowerCase()
    if (
      n.includes('body') ||
      n.includes('torso') ||
      n.includes('chest') ||
      n.includes('pelvis') ||
      n.includes('hip')
    ) {
      named = o
    }
    const box = new Box3().setFromObject(o)
    if (!box.isEmpty()) {
      box.getSize(size)
      const vol = size.x * size.y * size.z
      if (vol > bestVol) {
        bestVol = vol
        largest = o
      }
    }
  })
  const pick = named ?? largest
  if (pick) return pick

  const proxy = new Mesh(
    new BoxGeometry(0.5, 0.9, 0.4),
    new MeshPhysicalMaterial({
      color: 0xa67d52,
      visible: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  )
  proxy.name = proxyName
  root.add(proxy)
  return proxy
}
