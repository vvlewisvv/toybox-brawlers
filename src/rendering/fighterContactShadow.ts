import {
  CanvasTexture,
  DoubleSide,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three'

/**
 * Soft ground blob under feet — anchors fighters without extra shadow lights.
 * Child of fighter root; local Y at soles; does not affect collision.
 */
export function createFighterContactShadow(radius: number): {
  mesh: Mesh
  dispose: () => void
} {
  const size = 192
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('fighterContactShadow: 2d context unavailable')
  const cx = size * 0.5
  const cy = size * 0.53
  /* Tight core under feet + long soft falloff (stuffed toy grounded read). */
  const g = ctx.createRadialGradient(cx, cy, 0.5, cx, cy, size * 0.5)
  g.addColorStop(0, 'rgba(6,5,12,0.78)')
  g.addColorStop(0.12, 'rgba(10,8,18,0.52)')
  g.addColorStop(0.32, 'rgba(16,13,26,0.26)')
  g.addColorStop(0.58, 'rgba(22,18,34,0.1)')
  g.addColorStop(0.82, 'rgba(28,24,40,0.03)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)

  const map = new CanvasTexture(canvas)
  map.colorSpace = SRGBColorSpace
  map.minFilter = LinearFilter
  map.magFilter = LinearFilter
  map.needsUpdate = true

  const geom = new PlaneGeometry(radius * 2.35, radius * 1.72)
  const mat = new MeshBasicMaterial({
    map,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
  const mesh = new Mesh(geom, mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.renderOrder = -2
  mesh.frustumCulled = false

  return {
    mesh,
    dispose: () => {
      geom.dispose()
      mat.dispose()
      map.dispose()
    },
  }
}
