import {
  CanvasTexture,
  Color,
  MeshPhysicalMaterial,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Vector2,
} from 'three'

const DEFAULT_REPEAT = 3.85

/** Deterministic 2D hash for stable fabric grain (no per-pixel random shimmer). */
function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

function buildFabricNormalCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('plushMaterials: 2d context unavailable')
  const imageData = ctx.createImageData(size, size)
  const d = imageData.data
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const ux = x / size
      const uy = y / size
      /* Soft pile: low-frequency undulation + tight weave (subtle bumps). */
      const pile =
        Math.sin(ux * Math.PI * 5 + uy * Math.PI * 3.2) * 0.14 +
        Math.sin(ux * Math.PI * 11 - uy * Math.PI * 7) * 0.09
      const wave =
        Math.sin(ux * Math.PI * 20) * Math.cos(uy * Math.PI * 16) * 0.11 +
        Math.sin(ux * Math.PI * 28 + uy * Math.PI * 9) * 0.07
      const weave = Math.sin((x + y) * 0.32) * 0.045
      let dx = pile + wave + weave
      let dy =
        Math.sin(uy * Math.PI * 18 - ux * Math.PI * 11) * 0.12 +
        Math.cos(x * 0.11 + y * 0.07) * 0.05
      const seamGrid = 48
      const onSeam = (x % seamGrid) < 2 || (y % seamGrid) < 2
      const seam = onSeam ? 0.1 : 0
      dx += seam * Math.sin(ux * Math.PI * 2)
      dy += seam * Math.cos(uy * Math.PI * 2)
      const micro = (hash2(x, y) - 0.5) * 0.04
      dx += micro
      dy += (hash2(x + 17, y + 41) - 0.5) * 0.04
      const nx = Math.max(8, Math.min(247, Math.floor(128 + dx * 62)))
      const ny = Math.max(8, Math.min(247, Math.floor(128 + dy * 62)))
      d[i] = nx
      d[i + 1] = ny
      d[i + 2] = 255
      d[i + 3] = 255
    }
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas
}

/**
 * Roughness map (green channel): stays near mid-high so base roughness lands between
 * satin plush and chalky matte — never mirror-like, never dead flat.
 */
function buildRoughnessVariationCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('plushMaterials: 2d context unavailable')
  const imageData = ctx.createImageData(size, size)
  const d = imageData.data
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const ux = x / size
      const uy = y / size
      const n =
        Math.sin(ux * Math.PI * 9) * Math.cos(uy * Math.PI * 7) * 0.55 +
        Math.sin(ux * Math.PI * 23 + uy * Math.PI * 17) * 0.28 +
        Math.sin((x + y) * 0.11) * 0.2 +
        (hash2(x * 0.7, y * 0.7) - 0.5) * 0.14
      /* Green multiplies material roughness — keep high so result stays soft, not plastic. */
      const v = Math.floor(Math.max(218, Math.min(255, 244 + n * 11)))
      d[i] = v
      d[i + 1] = v
      d[i + 2] = v
      d[i + 3] = 255
    }
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas
}

/**
 * Fabric-like albedo: multi-scale mottle, nap shading, faint “fiber” streaks — not a flat dye.
 */
function buildAlbedoWashCanvas(size: number, baseHex: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('plushMaterials: 2d context unavailable')
  const br = new Color(baseHex)
  const imageData = ctx.createImageData(size, size)
  const d = imageData.data
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const ux = x / size
      const uy = y / size
      const large =
        Math.sin(ux * Math.PI * 4.2 + uy * Math.PI * 2.8) * 0.055 +
        Math.sin(ux * Math.PI * 7 - uy * Math.PI * 5) * 0.038
      const mottle =
        Math.sin(ux * Math.PI * 13) * Math.cos(uy * Math.PI * 11) * 0.042 +
        Math.sin((x + y * 0.72) * 0.085) * 0.032
      const streak =
        Math.sin(ux * 38 + uy * 14 + Math.sin(uy * 12) * 2) * 0.018 +
        Math.cos(uy * 44 + x * 0.09) * 0.015
      const napShade = (1 - uy) * 0.028 - Math.sin(ux * Math.PI * 2) * 0.012
      const grain = (hash2(x, y) - 0.5) * 0.022
      const warm = Math.sin(ux * 6.8 + uy * 4.4) * 0.024 + streak * 0.5
      const c = br.clone()
      const lightMix = large + mottle + napShade + grain
      c.offsetHSL(warm * 0.1, (mottle + streak) * 0.14, lightMix * 0.11)
      d[i] = Math.floor(c.r * 255)
      d[i + 1] = Math.floor(c.g * 255)
      d[i + 2] = Math.floor(c.b * 255)
      d[i + 3] = 255
    }
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas
}

function newFabricNormalTexture(): CanvasTexture {
  const tex = new CanvasTexture(buildFabricNormalCanvas(320))
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.repeat.set(DEFAULT_REPEAT, DEFAULT_REPEAT)
  tex.colorSpace = NoColorSpace
  tex.needsUpdate = true
  return tex
}

function newRoughnessVariationTexture(): CanvasTexture {
  const tex = new CanvasTexture(buildRoughnessVariationCanvas(160))
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.repeat.set(DEFAULT_REPEAT, DEFAULT_REPEAT)
  tex.colorSpace = NoColorSpace
  tex.needsUpdate = true
  return tex
}

function newAlbedoWashTexture(baseHex: number): CanvasTexture {
  const tex = new CanvasTexture(buildAlbedoWashCanvas(160, baseHex))
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.repeat.set(DEFAULT_REPEAT, DEFAULT_REPEAT)
  tex.colorSpace = SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

export type PlushFabricOptions = {
  roughness?: number
  normalScale?: number
  sheen?: number
  clearcoat?: number
  clearcoatRoughness?: number
  envMapIntensity?: number
  emissive?: number
  emissiveIntensity?: number
  /** Skip woven albedo / roughness maps (eyes, flat accents). */
  skipSurfaceMaps?: boolean
}

/**
 * Soft stuffed-toy fabric: fiber normal, roughness variation, tint wash, sheen, light clearcoat.
 * Each call allocates its own textures so per-mesh dispose stays safe.
 */
export function createPlushFabricMaterial(
  color: number,
  opts: PlushFabricOptions = {},
): MeshPhysicalMaterial {
  const roughness = opts.roughness ?? 0.81
  const normalScale = opts.normalScale ?? 0.26
  const sheen = opts.sheen ?? 0.68
  const clearcoat = opts.clearcoat ?? 0.1
  const clearcoatRoughness = opts.clearcoatRoughness ?? 0.52
  const envMapIntensity = opts.envMapIntensity ?? 0.78
  const c = new Color(color)
  const sheenColor = c.clone().lerp(new Color(0xffffff), 0.38)
  const mat = new MeshPhysicalMaterial({
    color,
    roughness,
    metalness: 0,
    normalMap: newFabricNormalTexture(),
    normalScale: new Vector2(normalScale, -normalScale),
    sheen,
    sheenRoughness: 0.5,
    sheenColor,
    clearcoat,
    clearcoatRoughness,
    envMapIntensity,
    specularIntensity: 0.38,
    specularColor: new Color(0xffffff).lerp(c, 0.28),
  })
  if (!opts.skipSurfaceMaps) {
    mat.map = newAlbedoWashTexture(color)
    mat.roughnessMap = newRoughnessVariationTexture()
  }
  if (opts.emissive !== undefined) {
    mat.emissive.setHex(opts.emissive)
    mat.emissiveIntensity = opts.emissiveIntensity ?? 0.22
  }
  return mat
}

/** Snoot / belly patches: smoother pile, less normal. */
export function createPlushSoftPatchMaterial(
  color: number,
  opts: PlushFabricOptions = {},
): MeshPhysicalMaterial {
  return createPlushFabricMaterial(color, {
    roughness: opts.roughness ?? 0.76,
    normalScale: opts.normalScale ?? 0.14,
    sheen: opts.sheen ?? 0.52,
    clearcoat: opts.clearcoat ?? 0.14,
    emissive: opts.emissive,
    emissiveIntensity: opts.emissiveIntensity,
    skipSurfaceMaps: opts.skipSurfaceMaps,
  })
}

/** Teeth, claws, glossy toy accents. */
export function createPlushGlossAccentMaterial(
  color: number,
  opts: PlushFabricOptions = {},
): MeshPhysicalMaterial {
  const roughness = opts.roughness ?? 0.38
  const clearcoat = opts.clearcoat ?? 0.48
  const ns = opts.normalScale ?? 0.06
  const c = new Color(color)
  const mat = new MeshPhysicalMaterial({
    color,
    roughness,
    metalness: 0,
    normalMap: newFabricNormalTexture(),
    normalScale: new Vector2(ns, -ns),
    sheen: 0.28,
    sheenRoughness: 0.32,
    sheenColor: c.clone().lerp(new Color(0xffffff), 0.5),
    clearcoat,
    clearcoatRoughness: 0.26,
    envMapIntensity: 0.95,
    specularIntensity: 0.85,
    specularColor: new Color(0xffffff),
  })
  if (!opts.skipSurfaceMaps) {
    mat.map = newAlbedoWashTexture(color)
    mat.roughnessMap = newRoughnessVariationTexture()
  }
  return mat
}

/** Eye whites — satin plush vinyl read. */
export function createPlushEyeScleraMaterial(color: number = 0xf5f8fc): MeshPhysicalMaterial {
  return createPlushGlossAccentMaterial(color, {
    roughness: 0.28,
    clearcoat: 0.55,
    normalScale: 0.04,
    skipSurfaceMaps: true,
  })
}

/** Dark pupil — slight wet catchlight. */
export function createPlushPupilMaterial(color: number = 0x0a1620): MeshPhysicalMaterial {
  const mat = new MeshPhysicalMaterial({
    color,
    roughness: 0.22,
    metalness: 0,
    sheen: 0.15,
    sheenRoughness: 0.25,
    sheenColor: new Color(0x223344),
    clearcoat: 0.35,
    clearcoatRoughness: 0.2,
    envMapIntensity: 0.55,
    specularIntensity: 0.65,
    specularColor: new Color(0x8899aa),
  })
  return mat
}
