import type { PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import { Group } from 'three'
import type { PlaceholderFighterMesh } from './placeholderFighterMesh'
import { disposePlaceholderFighterMesh } from './placeholderFighterMesh'

type MeshFactory = () => PlaceholderFighterMesh

let rosterWarmupComplete = false

function scheduleIdle(cb: () => void): void {
  const ric = globalThis.requestIdleCallback
  if (typeof ric === 'function') {
    ric(() => cb(), { timeout: 200 })
  } else {
    setTimeout(cb, 0)
  }
}

/**
 * While the character select UI is visible, instantiate each roster fighter mesh off-screen,
 * run one shader compile pass, then dispose throwaway geometry/materials.
 * Programs stay cached — no blocking overlay. Safe to call once per session.
 */
export function warmupRosterGpuOnce(
  scene: Scene,
  camera: PerspectiveCamera,
  renderer: WebGLRenderer,
  meshFactories: readonly MeshFactory[],
): void {
  if (rosterWarmupComplete || meshFactories.length === 0) return

  const bucket = new Group()
  bucket.name = 'RosterGpuWarmup'
  bucket.visible = false
  bucket.position.set(0, -120, 0)
  scene.add(bucket)

  const warmed: PlaceholderFighterMesh[] = []
  let index = 0

  const finish = (): void => {
    try {
      renderer.compile(scene, camera)
    } catch {
      /* compile is best-effort */
    }
    for (const assets of warmed) {
      disposePlaceholderFighterMesh(assets)
    }
    warmed.length = 0
    bucket.removeFromParent()
    rosterWarmupComplete = true
  }

  const step = (): void => {
    if (index >= meshFactories.length) {
      finish()
      return
    }
    try {
      const assets = meshFactories[index]()
      warmed.push(assets)
      bucket.add(assets.root)
    } catch (err) {
      console.warn('[Toybox Brawlers] Roster GPU warmup skipped one character:', err)
    }
    index += 1
    scheduleIdle(step)
  }

  scheduleIdle(step)
}

/** Test / future: allow forcing another warmup after hot reload. */
export function resetRosterGpuWarmupFlag(): void {
  rosterWarmupComplete = false
}
