import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  NormalBlending,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  Vector3,
} from 'three'
import type { AttackKind } from '../gameplay/combat/attackTimeline'
import { COMBAT_TUNING } from '../gameplay/combat/combatTuning'
import { getViolenceMode } from '../presentation/violenceMode'
import { TOYBOX_FIGHT_CAMERA_POS, TOYBOX_FIGHT_LOOK_AT } from '../scenes/toyboxArena'

/**
 * Tunable hit juice — keep numbers small for browser-friendly feel.
 * These values apply to every violence mode; {@link getViolenceMode} must not branch here.
 */
export const HIT_FEEL_TUNING = {
  /** Decay only after hit-stop ends so the hold reads as one beat. */
  shakeDecayPerSec: 18,
  /** Combo dampening: avoid messy over-shake on rapid successive hits. */
  shakeRetriggerCooldownMs: 70,
  shakeRetriggerDampen: 0.65,
  screenFlashMs: 108,
  sparkLife: 0.26,
  sparkCount: 34,
  /** Directional camera kick as a fraction of random shake (world X / Y). */
  shakeDirWeightHit: 1.75,
  shakeDirWeightBlock: 1.15,
  /** Hard cap to keep particle storms from spiraling frame-time. */
  maxActiveBursts: 30,
  mobileBurstCountScale: 0.52,
  mobileShakeScale: 0.5,
} as const

function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: coarse)').matches
}

type Burst = {
  points: Points
  geom: BufferGeometry
  mat: PointsMaterial
  poolKey: string
  life: number
  maxLife: number
  positions: Float32Array
  velocities: Float32Array
  gravity: number
}

type StrikeOrKoKind = AttackKind | 'ko'

type BurstPoolSpec = {
  n: number
  life: number
  gravity: number
  size: number
  opacity: number
  blending: typeof AdditiveBlending | typeof NormalBlending
  vertexColors: boolean
  color?: number
}

const burstPool = new Map<string, Burst[]>()

function poolKeyFor(spec: BurstPoolSpec): string {
  return [
    spec.n,
    spec.size.toFixed(3),
    spec.opacity.toFixed(3),
    spec.life.toFixed(3),
    spec.gravity.toFixed(3),
    spec.vertexColors ? 'vc' : 'c',
    spec.blending === AdditiveBlending ? 'add' : 'norm',
    spec.color ?? 'none',
  ].join('|')
}

function acquireBurst(scene: Scene, spec: BurstPoolSpec): Burst {
  const key = poolKeyFor(spec)
  const bucket = burstPool.get(key)
  const pooled = bucket?.pop()
  if (pooled) {
    pooled.poolKey = key
    pooled.life = spec.life
    pooled.maxLife = spec.life
    pooled.gravity = spec.gravity
    pooled.mat.opacity = spec.opacity
    if (!spec.vertexColors && spec.color !== undefined) {
      pooled.mat.color.setHex(spec.color)
    }
    pooled.points.visible = true
    if (!pooled.points.parent) scene.add(pooled.points)
    return pooled
  }

  const positions = new Float32Array(spec.n * 3)
  const velocities = new Float32Array(spec.n * 3)
  const geom = new BufferGeometry()
  geom.setAttribute('position', new BufferAttribute(positions, 3))
  const colors = spec.vertexColors ? new Float32Array(spec.n * 3) : null
  if (colors) geom.setAttribute('color', new BufferAttribute(colors, 3))
  const mat = new PointsMaterial({
    color: spec.color,
    vertexColors: spec.vertexColors,
    size: spec.size,
    transparent: true,
    opacity: spec.opacity,
    depthWrite: false,
    blending: spec.blending,
    sizeAttenuation: true,
  })
  const points = new Points(geom, mat)
  points.frustumCulled = false
  scene.add(points)
  return {
    points,
    geom,
    mat,
    poolKey: key,
    life: spec.life,
    maxLife: spec.life,
    positions,
    velocities,
    gravity: spec.gravity,
  }
}

function recycleBurst(b: Burst): void {
  b.points.visible = false
  b.mat.opacity = 0
  let bucket = burstPool.get(b.poolKey)
  if (!bucket) {
    bucket = []
    burstPool.set(b.poolKey, bucket)
  }
  bucket.push(b)
}

function hexToRgb01(hex: number): [number, number, number] {
  const r = ((hex >> 16) & 255) / 255
  const g = ((hex >> 8) & 255) / 255
  const b = (hex & 255) / 255
  return [r, g, b]
}

/** Soft mode: fluffy stuffing puff — plush-safe, low contrast. */
function spawnStuffingBurst(
  scene: Scene,
  origin: Vector3,
  blocked: boolean,
  strikeDir: Vector3,
): Burst {
  const mobileScale = isMobileDevice() ? HIT_FEEL_TUNING.mobileBurstCountScale : 1
  const n = Math.max(5, Math.round((blocked ? 8 : 22) * mobileScale))
  const life = 0.36
  const gravity = 1.85
  const color = blocked ? 0xe4ecf8 : 0xf7f0e6
  const b = acquireBurst(scene, {
    n,
    life,
    gravity,
    color,
    size: 0.05,
    opacity: blocked ? 0.18 : 0.88,
    blending: NormalBlending,
    vertexColors: false,
  })
  const { positions, velocities } = b
  const push = blocked ? 0.7 : 1.55

  for (let i = 0; i < n; i++) {
    const ix = i * 3
    positions[ix] = origin.x + (Math.random() - 0.5) * 0.04
    positions[ix + 1] = origin.y + (Math.random() - 0.5) * 0.04
    positions[ix + 2] = origin.z + (Math.random() - 0.5) * 0.04
    const spread = blocked ? 0.9 : 1.9
    velocities[ix] = (Math.random() - 0.5) * spread + strikeDir.x * push * (0.55 + Math.random() * 0.45)
    velocities[ix + 1] = Math.random() * 1.55 + 0.55
    velocities[ix + 2] = (Math.random() - 0.5) * (spread * 0.45) + strikeDir.z * push * (0.55 + Math.random() * 0.45)
  }

  const posAttr = b.geom.getAttribute('position') as BufferAttribute
  posAttr.needsUpdate = true
  return b
}

/** Soft mode: tiny confetti chips — pastel, celebratory. */
function spawnConfettiBurst(
  scene: Scene,
  origin: Vector3,
  blocked: boolean,
  strikeDir: Vector3,
  countMul = 1,
): Burst {
  const mobileScale = isMobileDevice() ? HIT_FEEL_TUNING.mobileBurstCountScale : 1
  const palette = blocked
    ? [0xa8d4ff, 0xc8e8ff, 0xe0f0ff, 0xb8c8f0, 0xd8e8f8]
    : [0xffb8c8, 0xffe8a8, 0xa8f0c8, 0xd8b8ff, 0xffc8e8, 0xfff0c0]
  const n = Math.max(4, Math.round((blocked ? 6 : 14) * countMul * mobileScale))
  const life = 0.42
  const gravity = 3.1
  const b = acquireBurst(scene, {
    n,
    life,
    gravity,
    size: 0.062,
    opacity: blocked ? 0.16 : 0.94,
    blending: NormalBlending,
    vertexColors: true,
  })
  const { positions, velocities } = b
  const colors = (b.geom.getAttribute('color') as BufferAttribute).array as Float32Array

  for (let i = 0; i < n; i++) {
    const ix = i * 3
    positions[ix] = origin.x
    positions[ix + 1] = origin.y
    positions[ix + 2] = origin.z
    const c = palette[(Math.random() * palette.length) | 0]
    const [cr, cg, cb] = hexToRgb01(c)
    colors[ix] = cr
    colors[ix + 1] = cg
    colors[ix + 2] = cb
    const s = blocked ? 0.95 : 2.35
    const along = blocked ? 0.5 : 1.35
    velocities[ix] = (Math.random() - 0.5) * s + strikeDir.x * along
    velocities[ix + 1] = Math.random() * 2.0 + 0.65
    velocities[ix + 2] = (Math.random() - 0.5) * (s * 0.55) + strikeDir.z * along
  }

  ;(b.geom.getAttribute('position') as BufferAttribute).needsUpdate = true
  ;(b.geom.getAttribute('color') as BufferAttribute).needsUpdate = true
  return b
}

/** Soft mode: fabric thread / scrap flecks — dusty toy tones. */
function spawnFabricDebrisBurst(
  scene: Scene,
  origin: Vector3,
  blocked: boolean,
  strikeDir: Vector3,
): Burst {
  const mobileScale = isMobileDevice() ? HIT_FEEL_TUNING.mobileBurstCountScale : 1
  const palette = blocked
    ? [0x8898b0, 0xa0a8c0, 0x7888a0]
    : [0xc4a882, 0xb89890, 0xa89880, 0x8a7868, 0xd4b8a8]
  const n = Math.max(4, Math.round((blocked ? 5 : 11) * mobileScale))
  const life = 0.38
  const gravity = 2.65
  const b = acquireBurst(scene, {
    n,
    life,
    gravity,
    size: 0.078,
    opacity: blocked ? 0.15 : 0.9,
    blending: NormalBlending,
    vertexColors: true,
  })
  const { positions, velocities } = b
  const colors = (b.geom.getAttribute('color') as BufferAttribute).array as Float32Array

  for (let i = 0; i < n; i++) {
    const ix = i * 3
    positions[ix] = origin.x + (Math.random() - 0.5) * 0.03
    positions[ix + 1] = origin.y + (Math.random() - 0.5) * 0.03
    positions[ix + 2] = origin.z + (Math.random() - 0.5) * 0.03
    const c = palette[(Math.random() * palette.length) | 0]
    const [cr, cg, cb] = hexToRgb01(c)
    colors[ix] = cr
    colors[ix + 1] = cg
    colors[ix + 2] = cb
    const d = blocked ? 0.45 : 1.05
    velocities[ix] = (Math.random() - 0.5) * 1.65 + strikeDir.x * d
    velocities[ix + 1] = Math.random() * 1.35 + 0.35
    velocities[ix + 2] = (Math.random() - 0.5) * 0.95 + strikeDir.z * d
  }

  ;(b.geom.getAttribute('position') as BufferAttribute).needsUpdate = true
  ;(b.geom.getAttribute('color') as BufferAttribute).needsUpdate = true
  return b
}

/**
 * Planar impact shell: particles spawn on a ring around the hit and blow out along {@link strikeDir}.
 */
function spawnImpactRingBurst(
  scene: Scene,
  origin: Vector3,
  blocked: boolean,
  strikeDir: Vector3,
  chaos: boolean,
): Burst {
  const mobileScale = isMobileDevice() ? HIT_FEEL_TUNING.mobileBurstCountScale : 1
  const n = Math.max(5, Math.round((chaos ? (blocked ? 10 : 26) : blocked ? 7 : 16) * mobileScale))
  const life = chaos ? HIT_FEEL_TUNING.sparkLife * 0.9 : 0.34
  const gravity = chaos ? 5.5 : 2.15
  const perpX = -strikeDir.z
  const perpZ = strikeDir.x
  const color = blocked ? (chaos ? 0x66c8ff : 0xd0dcf0) : chaos ? 0xff5533 : 0xf5ead8
  const size = chaos ? (blocked ? 0.041 : 0.05) : blocked ? 0.045 : 0.056
  const opacity = blocked ? 0.18 : chaos ? 0.96 : 0.9
  const blending = blocked ? NormalBlending : chaos ? AdditiveBlending : NormalBlending
  const b = acquireBurst(scene, {
    n,
    life,
    gravity,
    color,
    size,
    opacity,
    blending,
    vertexColors: false,
  })
  const { positions, velocities } = b

  for (let i = 0; i < n; i++) {
    const ix = i * 3
    const ringT = (i / n) * Math.PI * 2
    const jit = 0.82 + Math.random() * 0.36
    const ringR = chaos ? 0.042 : 0.052
    const ox = (perpX * Math.cos(ringT) * ringR + strikeDir.x * 0.018) * jit
    const oz = (perpZ * Math.cos(ringT) * ringR + strikeDir.z * 0.018) * jit
    positions[ix] = origin.x + ox
    positions[ix + 1] = origin.y + (Math.random() - 0.5) * 0.032
    positions[ix + 2] = origin.z + oz
    const fwd = blocked ? 0.9 + Math.random() * 0.55 : chaos ? 4.0 + Math.random() * 2.8 : 1.65 + Math.random() * 1.05
    const side = (Math.random() - 0.5) * (blocked ? 0.32 : chaos ? 1.25 : 0.62)
    velocities[ix] = strikeDir.x * fwd + perpX * side
    velocities[ix + 1] = Math.random() * (chaos ? 2.05 : 1.05) + 0.48
    velocities[ix + 2] = strikeDir.z * fwd + perpZ * side
  }

  ;(b.geom.getAttribute('position') as BufferAttribute).needsUpdate = true
  return b
}

function spawnSoftPlushBursts(
  scene: Scene,
  origin: Vector3,
  blocked: boolean,
  strikeDir: Vector3,
): Burst[] {
  return [
    spawnStuffingBurst(scene, origin, blocked, strikeDir),
    spawnConfettiBurst(scene, origin, blocked, strikeDir),
    spawnFabricDebrisBurst(scene, origin, blocked, strikeDir),
    spawnImpactRingBurst(scene, origin, blocked, strikeDir, false),
  ]
}

/** Chaos mode: same plush-forward base + extra pastel fibers (no metallic sparks). */
function spawnPastelFiberAccent(
  scene: Scene,
  origin: Vector3,
  blocked: boolean,
  strikeDir: Vector3,
): Burst {
  const mobileScale = isMobileDevice() ? HIT_FEEL_TUNING.mobileBurstCountScale : 1
  const palette = blocked
    ? [0xb8dcff, 0xd0e8ff, 0xa8c8f0, 0xe0f0ff]
    : [0xffc8d8, 0xffe0c0, 0xf0d8ff, 0xffd0e8, 0xfff0d8]
  const n = Math.max(10, Math.round(26 * mobileScale))
  const life = 0.34
  const gravity = 2.2
  const b = acquireBurst(scene, {
    n,
    life,
    gravity,
    size: 0.048,
    opacity: 0.92,
    blending: NormalBlending,
    vertexColors: true,
  })
  const { positions, velocities } = b
  const colors = (b.geom.getAttribute('color') as BufferAttribute).array as Float32Array
  const perpX = -strikeDir.z
  const perpZ = strikeDir.x

  for (let i = 0; i < n; i++) {
    const ix = i * 3
    const hex = palette[(Math.random() * palette.length) | 0]!
    const [cr, cg, cb] = hexToRgb01(hex)
    colors[ix] = cr
    colors[ix + 1] = cg
    colors[ix + 2] = cb
    positions[ix] = origin.x + (Math.random() - 0.5) * 0.04
    positions[ix + 1] = origin.y + (Math.random() - 0.5) * 0.04
    positions[ix + 2] = origin.z + (Math.random() - 0.5) * 0.04
    const along = 1.1 + Math.random() * 1.6
    velocities[ix] = strikeDir.x * along + perpX * (Math.random() - 0.5) * 1.5
    velocities[ix + 1] = Math.random() * 1.65 + 0.4
    velocities[ix + 2] = strikeDir.z * along + perpZ * (Math.random() - 0.5) * 1.5
  }

  ;(b.geom.getAttribute('position') as BufferAttribute).needsUpdate = true
  ;(b.geom.getAttribute('color') as BufferAttribute).needsUpdate = true
  return b
}

function spawnChaosBursts(
  scene: Scene,
  origin: Vector3,
  blocked: boolean,
  strikeDir: Vector3,
  strikeKind: AttackKind,
): Burst[] {
  const bloodOrigin = origin.clone()
  bloodOrigin.y += 0.035
  return [
    // Chaos mode is blood-forward: add a denser red spray and keep plush bursts as support.
    spawnBloodBurst(scene, bloodOrigin, blocked, strikeDir, strikeKind),
    ...spawnSoftPlushBursts(scene, origin, blocked, strikeDir),
    spawnConfettiBurst(scene, origin, blocked, strikeDir, blocked ? 0.5 : 1.15),
    spawnPastelFiberAccent(scene, origin, blocked, strikeDir),
    spawnImpactRingBurst(scene, origin, blocked, strikeDir, true),
  ]
}

/** Chaos mode blood spray: short life, heavier downward arc, red-heavy palette. */
function spawnBloodBurst(
  scene: Scene,
  origin: Vector3,
  blocked: boolean,
  strikeDir: Vector3,
  strikeKind: StrikeOrKoKind,
): Burst {
  const mobileScale = isMobileDevice() ? HIT_FEEL_TUNING.mobileBurstCountScale : 1
  const palette = blocked
    ? [0x5a1820, 0x6e1f2a, 0x7b2a36]
    : [0x7a1119, 0x911521, 0xb61c2c, 0xd12b39, 0x5c0d14]
  const byKindBase: Record<StrikeOrKoKind, number> = {
    light: blocked ? 4 : 12,
    heavy: blocked ? 7 : 24,
    special: blocked ? 9 : 34,
    ko: 56,
  }
  const n = Math.max(7, Math.round(byKindBase[strikeKind] * mobileScale))
  const life = blocked ? 0.16 : 0.46
  const gravity = blocked ? 4.6 : 5.8
  const b = acquireBurst(scene, {
    n,
    life,
    gravity,
    size: blocked ? 0.042 : 0.064,
    opacity: blocked ? 0.16 : 0.93,
    blending: blocked ? NormalBlending : AdditiveBlending,
    vertexColors: true,
  })
  const { positions, velocities } = b
  const colors = (b.geom.getAttribute('color') as BufferAttribute).array as Float32Array
  const perpX = -strikeDir.z
  const perpZ = strikeDir.x

  for (let i = 0; i < n; i++) {
    const ix = i * 3
    const c = palette[(Math.random() * palette.length) | 0]
    const [cr, cg, cb] = hexToRgb01(c)
    colors[ix] = cr
    colors[ix + 1] = cg
    colors[ix + 2] = cb
    positions[ix] = origin.x + (Math.random() - 0.5) * 0.03
    positions[ix + 1] = origin.y + (Math.random() - 0.5) * 0.03
    positions[ix + 2] = origin.z + (Math.random() - 0.5) * 0.03
    const along = blocked ? 0.42 + Math.random() * 0.5 : 1.35 + Math.random() * 2.2
    const side = (Math.random() - 0.5) * (blocked ? 0.45 : 1.55)
    velocities[ix] = strikeDir.x * along + perpX * side
    velocities[ix + 1] = Math.random() * (blocked ? 0.5 : 2.35) + (blocked ? 0.05 : 0.45)
    velocities[ix + 2] = strikeDir.z * along + perpZ * side
  }

  ;(b.geom.getAttribute('position') as BufferAttribute).needsUpdate = true
  ;(b.geom.getAttribute('color') as BufferAttribute).needsUpdate = true
  return b
}

function spawnImpactBursts(
  scene: Scene,
  origin: Vector3,
  blocked: boolean,
  strikeDir: Vector3,
  strikeKind: AttackKind,
): Burst[] {
  if (getViolenceMode() === 'soft') {
    return spawnSoftPlushBursts(scene, origin, blocked, strikeDir)
  }
  return spawnChaosBursts(scene, origin, blocked, strikeDir, strikeKind)
}

export class HitFeelController {
  private hitPauseFor(kind: AttackKind): number {
    return COMBAT_TUNING.hitPause[kind]
  }

  private shakeFor(kind: AttackKind): number {
    return COMBAT_TUNING.cameraShake[kind]
  }

  private readonly camera: PerspectiveCamera
  private readonly basePosition: Vector3
  private readonly lookTarget: Vector3
  private readonly scene: Scene
  private readonly screenPunch: HTMLElement

  private hitStopRemaining = 0
  private shakeMagnitude = 0
  private readonly lastStrikeDir = new Vector3(1, 0, 0)
  private lastImpactBlocked = false
  /** Horizontal framing offset (centers both fighters). */
  private framingDx = 0
  /** Pull camera toward stage on impact (visual zoom). */
  private fightZoomPull = 0
  private bursts: Burst[] = []
  private punchTimer: ReturnType<typeof setTimeout> | null = null
  private lastShakeTriggerAtMs = -1

  constructor(opts: {
    camera: PerspectiveCamera
    basePosition: Vector3
    lookTarget: Vector3
    scene: Scene
    screenPunch: HTMLElement
  }) {
    this.camera = opts.camera
    this.basePosition = opts.basePosition.clone()
    this.lookTarget = opts.lookTarget.clone()
    this.scene = opts.scene
    this.screenPunch = opts.screenPunch
  }

  /** Call at frame start. Returns simulation `dt` (0 while hit-stop is active). */
  tickStart(realDt: number): number {
    if (this.hitStopRemaining > 0) {
      this.hitStopRemaining = Math.max(0, this.hitStopRemaining - realDt)
    }
    return this.hitStopRemaining > 0 ? 0 : realDt
  }

  /**
   * After combat resolution; apply shake decay, particles, camera.
   * While hit-stop is active, gameplay sim dt is zero but we still age bursts in real time;
   * particle **motion** is frozen so the impact pose holds through the freeze.
   */
  tickEnd(realDt: number): void {
    const freezing = this.hitStopRemaining > 0
    const moveDt = freezing ? 0 : realDt
    if (!freezing) {
      this.shakeMagnitude *= Math.exp(-HIT_FEEL_TUNING.shakeDecayPerSec * realDt)
    }
    this.fightZoomPull *= Math.exp(-5.4 * realDt)

    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i]
      b.life -= realDt
      const posAttr = b.geom.getAttribute('position') as BufferAttribute
      const arr = posAttr.array as Float32Array
      for (let p = 0; p < b.positions.length; p += 3) {
        b.velocities[p + 1] -= b.gravity * moveDt
        arr[p] += b.velocities[p] * moveDt
        arr[p + 1] += b.velocities[p + 1] * moveDt
        arr[p + 2] += b.velocities[p + 2] * moveDt
      }
      posAttr.needsUpdate = true
      b.mat.opacity = Math.max(0, b.life / b.maxLife)

      if (b.life <= 0) {
        recycleBurst(b)
        this.bursts.splice(i, 1)
      }
    }

    this.applyCameraShake()
  }

  /**
   * Hit-stop and camera shake use {@link HIT_FEEL_TUNING} only — never {@link getViolenceMode}.
   * Violence mode affects impact particles and `flashScreen` CSS classes only.
   */
  triggerImpact(
    blocked: boolean,
    worldPoint: Vector3,
    strikeDir: Vector3,
    strikeKind: AttackKind,
  ): void {
    const t = HIT_FEEL_TUNING
    this.lastImpactBlocked = blocked
    this.lastStrikeDir.copy(strikeDir)

    // Apply micro hitstop + camera shake on confirmed hit only.
    if (!blocked) {
      const stop = this.hitPauseFor(strikeKind)
      this.hitStopRemaining = Math.max(this.hitStopRemaining, stop)

      const baseShake = this.shakeFor(strikeKind)
      const nowMs = performance.now()
      const rapidRetrigger =
        this.lastShakeTriggerAtMs > 0 &&
        nowMs - this.lastShakeTriggerAtMs < t.shakeRetriggerCooldownMs
      const mobileShake = isMobileDevice() ? HIT_FEEL_TUNING.mobileShakeScale : 1
      const sh = (rapidRetrigger ? baseShake * t.shakeRetriggerDampen : baseShake) * mobileShake
      this.shakeMagnitude = Math.max(this.shakeMagnitude, sh)
      this.lastShakeTriggerAtMs = nowMs
    }

    const zoomBase =
      strikeKind === 'special' ? 0.36 : strikeKind === 'heavy' ? 0.22 : 0.12
    const zoom = zoomBase * (blocked ? 0 : 1)
    this.fightZoomPull = Math.max(this.fightZoomPull, zoom)

    for (const b of spawnImpactBursts(this.scene, worldPoint, blocked, strikeDir, strikeKind)) {
      this.bursts.push(b)
    }
    if (this.bursts.length > HIT_FEEL_TUNING.maxActiveBursts) {
      const overflow = this.bursts.length - HIT_FEEL_TUNING.maxActiveBursts
      for (let i = 0; i < overflow; i++) {
        const old = this.bursts.shift()
        if (!old) break
        recycleBurst(old)
      }
    }

    this.flashScreen(blocked)
    this.applyCameraShake()
  }

  /** Big finish beat when a fighter is knocked out (extra hold + shake + zoom). */
  triggerKoMoment(worldPoint?: Vector3, strikeDir?: Vector3): void {
    this.hitStopRemaining = Math.max(this.hitStopRemaining, 0.1)
    this.shakeMagnitude = Math.max(this.shakeMagnitude, this.shakeFor('special') * 1.45)
    this.fightZoomPull = Math.max(this.fightZoomPull, 0.48)
    if (getViolenceMode() !== 'soft' && worldPoint) {
      const dir = strikeDir?.clone().normalize() ?? new Vector3(1, 0, 0)
      this.bursts.push(spawnBloodBurst(this.scene, worldPoint.clone(), false, dir, 'ko'))
      if (this.bursts.length > HIT_FEEL_TUNING.maxActiveBursts) {
        const overflow = this.bursts.length - HIT_FEEL_TUNING.maxActiveBursts
        for (let i = 0; i < overflow; i++) {
          const old = this.bursts.shift()
          if (!old) break
          recycleBurst(old)
        }
      }
    }
    this.applyCameraShake()
  }

  /** During fights, gently track midpoint between fighters on X. */
  tickFightCamera(midFighterX: number, realDt: number): void {
    const target = midFighterX * 0.108
    const k = Math.min(1, 4 * realDt)
    this.framingDx += (target - this.framingDx) * k
  }

  private flashScreen(blocked: boolean): void {
    // Block should never trigger a bright full-screen flash.
    // Keep only tiny mesh/local VFX for blocked impacts.
    if (blocked) return
    if (this.punchTimer) {
      clearTimeout(this.punchTimer)
      this.punchTimer = null
    }
    this.screenPunch.classList.remove(
      'screen-punch--hit',
      'screen-punch--block',
      'screen-punch--plush-hit',
      'screen-punch--plush-block',
      'screen-punch--chaos-hit',
      'screen-punch--chaos-block',
    )
    void this.screenPunch.offsetWidth
    if (getViolenceMode() === 'soft') {
      this.screenPunch.classList.add(blocked ? 'screen-punch--plush-block' : 'screen-punch--plush-hit')
    } else {
      this.screenPunch.classList.add(
        blocked ? 'screen-punch--chaos-block' : 'screen-punch--chaos-hit',
      )
    }
    this.punchTimer = setTimeout(() => {
      this.screenPunch.classList.remove(
        'screen-punch--hit',
        'screen-punch--block',
        'screen-punch--plush-hit',
        'screen-punch--plush-block',
        'screen-punch--chaos-hit',
        'screen-punch--chaos-block',
      )
      this.punchTimer = null
    }, HIT_FEEL_TUNING.screenFlashMs)
  }

  private applyCameraShake(): void {
    const m = this.shakeMagnitude
    const t = HIT_FEEL_TUNING
    const dx = this.lastStrikeDir.x
    const dz = this.lastStrikeDir.z
    const dirW = this.lastImpactBlocked ? t.shakeDirWeightBlock : t.shakeDirWeightHit
    const dirPushX = dx * m * dirW
    const dirPushY = (Math.abs(dx) + Math.abs(dz)) * m * (dirW * 0.42) + m * 0.12
    const rndScale = 0.52
    const ox = dirPushX + (Math.random() - 0.5) * 2 * m * rndScale
    const oy = dirPushY + (Math.random() - 0.5) * 2 * m * rndScale
    const z = this.basePosition.z - this.fightZoomPull
    this.camera.position.set(this.basePosition.x + this.framingDx + ox, this.basePosition.y + oy, z)
    this.camera.lookAt(this.lookTarget)
  }

  /** Hit-stop, shake, screen flash, sparks — does not move the camera. */
  clearTransientEffects(): void {
    this.hitStopRemaining = 0
    this.shakeMagnitude = 0
    this.framingDx = 0
    this.fightZoomPull = 0
    this.lastShakeTriggerAtMs = -1
    if (this.punchTimer) {
      clearTimeout(this.punchTimer)
      this.punchTimer = null
    }
    this.screenPunch.classList.remove(
      'screen-punch--hit',
      'screen-punch--block',
      'screen-punch--plush-hit',
      'screen-punch--plush-block',
      'screen-punch--chaos-hit',
      'screen-punch--chaos-block',
    )
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      recycleBurst(this.bursts[i]!)
    }
    this.bursts = []
  }

  /** After external camera moves (e.g. menu framing), keep shake math aligned. */
  syncBaseFromCamera(): void {
    this.basePosition.copy(this.camera.position)
  }

  /**
   * Default fight framing (e.g. round / match start). Clears juice and snaps camera.
   */
  resetFightCameraPose(basePosition?: Vector3, lookTarget?: Vector3): void {
    this.clearTransientEffects()
    if (basePosition) this.basePosition.copy(basePosition)
    else this.basePosition.copy(TOYBOX_FIGHT_CAMERA_POS)
    if (lookTarget) this.lookTarget.copy(lookTarget)
    else this.lookTarget.copy(TOYBOX_FIGHT_LOOK_AT)
    this.framingDx = 0
    this.fightZoomPull = 0
    this.camera.position.copy(this.basePosition)
    this.camera.lookAt(this.lookTarget)
  }

  dispose(): void {
    if (this.punchTimer) clearTimeout(this.punchTimer)
    for (const b of this.bursts) {
      this.scene.remove(b.points)
      b.geom.dispose()
      b.mat.dispose()
    }
    this.bursts = []
    for (const bucket of burstPool.values()) {
      for (const b of bucket) {
        this.scene.remove(b.points)
        b.geom.dispose()
        b.mat.dispose()
      }
      bucket.length = 0
    }
    burstPool.clear()
  }
}
