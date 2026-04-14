import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'

export type AnimDebugRigInfo = {
  clipNames: string[]
  rigBoneNames: string[]
  skinnedMeshNames: string[]
}

/** Collect bones + skinned mesh names from glTF scene. */
export function collectAnimDebugInfo(
  gltf: GLTF,
  clipNames: readonly string[],
): AnimDebugRigInfo {
  const boneNameSet = new Set<string>()
  const skinnedMeshNames: string[] = []
  gltf.scene.updateMatrixWorld(true)
  gltf.scene.traverse((o) => {
    const sk = o as {
      name?: string
      isSkinnedMesh?: boolean
      skeleton?: { bones?: { name?: string }[] }
    }
    if (sk.isSkinnedMesh && o.name) skinnedMeshNames.push(o.name)
    if (sk.isSkinnedMesh && sk.skeleton?.bones?.length) {
      for (const b of sk.skeleton.bones) {
        if (b?.name) boneNameSet.add(b.name)
      }
    }
  })
  return {
    clipNames: [...clipNames],
    rigBoneNames: [...boneNameSet],
    skinnedMeshNames,
  }
}

export function logAnimDebug(label: string, info: AnimDebugRigInfo): void {
  console.info(`[ANIM_DEBUG] ${label} clips=${JSON.stringify(info.clipNames)}`)
  const bmax = 80
  const bones = info.rigBoneNames
  const bslice = bones.slice(0, bmax)
  const bextra = bones.length > bmax ? ` …+${bones.length - bmax} more` : ''
  console.info(`[ANIM_DEBUG] ${label} rigBones=${JSON.stringify(bslice)}${bextra}`)
  console.info(`[ANIM_DEBUG] ${label} skinnedMeshes=${JSON.stringify(info.skinnedMeshNames)}`)
}

/** One-time structure log for imported fighters (skeleton / clips / node names). */
export function logGltfDebug(gltf: GLTF, label: string): void {
  let hasSkinnedMesh = false
  let hasSkeleton = false
  const nodeNames: string[] = []
  const boneNameSet = new Set<string>()
  gltf.scene.updateMatrixWorld(true)
  gltf.scene.traverse((o) => {
    nodeNames.push(o.name || '(unnamed)')
    const sk = o as {
      isSkinnedMesh?: boolean
      skeleton?: { bones?: { name?: string }[] }
    }
    if (sk.isSkinnedMesh) {
      hasSkinnedMesh = true
      if (sk.skeleton?.bones?.length) {
        hasSkeleton = true
        for (const b of sk.skeleton.bones) {
          if (b?.name) boneNameSet.add(b.name)
        }
      }
    }
  })
  const animNames = gltf.animations.map((a) => a.name || '(unnamed clip)')
  const boneNames = [...boneNameSet]
  console.info(`[GLB_DEBUG] ${label} hasSkeleton=${hasSkeleton}`)
  console.info(`[GLB_DEBUG] ${label} hasSkinnedMesh=${hasSkinnedMesh}`)
  console.info(`[GLB_DEBUG] ${label} animations=${JSON.stringify(animNames)}`)
  const max = 96
  const slice = nodeNames.slice(0, max)
  const extra = nodeNames.length > max ? ` …+${nodeNames.length - max} more` : ''
  console.info(`[GLB_DEBUG] ${label} nodeNames=${JSON.stringify(slice)}${extra}`)
  const bmax = 64
  const bslice = boneNames.slice(0, bmax)
  const bextra = boneNames.length > bmax ? ` …+${boneNames.length - bmax} more` : ''
  console.info(`[GLB_DEBUG] ${label} boneNames=${JSON.stringify(bslice)}${bextra}`)
}
