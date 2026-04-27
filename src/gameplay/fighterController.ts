import type { Scene } from 'three'
import { Color, Mesh, MeshBasicMaterial, MeshPhysicalMaterial } from 'three'
import type { FrameSnapshot } from '../input'
import { EMPTY_FRAME_SNAPSHOT } from '../input'
import { readMoveAxis } from '../input'
import {
  advanceAttackState,
  attackFullCycleForAnimSync,
  createIdleAttackState,
  isAttackBusy,
  type AttackAdvanceHooks,
  type AttackKind,
  type AttackState,
} from './combat/attackTimeline'
import {
  isAttackTimingDebugEnabled,
  type AttackTimingDebugRow,
} from './combat/attackTimingDebug'
import { CHARACTER_PLACEHOLDER_DEFAULT } from './character/characterPresets'
import { resolveCharacterRuntime } from './character/defaults'
import type {
  CharacterDefinition,
  FighterTuning,
  HitboxShape,
  JumpArc,
  MovementTuning,
} from './character/types'
import { FIGHT_PLANE_Z, snapRootToFightingPlane } from './fightingPlane'
import { GROUND_CONTACT_EPS, GROUND_SURFACE_Y, resolveFeetOnGroundPlane } from './groundPlane'
import { createFighterContactShadow } from '../rendering/fighterContactShadow'
import {
  createPlaceholderFighterMesh,
  disposePlaceholderFighterMesh,
  type PlaceholderFighterMesh,
} from '../rendering/placeholderFighterMesh'

export type { FighterTuning, JumpArc, MovementTuning } from './character/types'

const LAND_SQUASH_DURATION = 0.13
const RECEIVE_HIT_VISUAL_DUR = 0.1
/** Longer hit presentation so Bibi’s GLB reaction can read; anim time-scale matches this window. */
const RECEIVE_HIT_VISUAL_DUR_BIBI = 0.12
/** Plush KO flop on {@link PlaceholderFighterMesh.visuals} (seconds). */
const KO_FLOP_DURATION = 1.05
/** GLB victory pose window after winning a round (syncs clip length roughly to this). */
const ROUND_WIN_PRESENTATION_SEC = 2.65
const ENABLE_ROUND_WIN_PRESENTATION = false

function smoothstep01(t: number): number {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

export type HitPresentationMeta = {
  strikeKind?: AttackKind
  /** World X component of strike travel (attacker → defender); drives sideways tilt. */
  recoilX?: number
}

function splitLegacyTuning(t: Partial<FighterTuning>): {
  movement: Partial<MovementTuning>
  jump: Partial<JumpArc>
} {
  const { gravity, jumpVelocity, ...movement } = t
  const jump: Partial<JumpArc> = {}
  if (gravity !== undefined) jump.gravity = gravity
  if (jumpVelocity !== undefined) jump.jumpVelocity = jumpVelocity
  return { movement, jump }
}

export type PlanarPosition = { x: number; z: number }

export type FighterHealth = { current: number; max: number }

export type StrikeOutcome = {
  damage: number
  hitStun: number
  blockStunDefender: number
  blockStunAttacker: number
}

export type PlaceholderFighter = {
  mesh: PlaceholderFighterMesh
  grounded: boolean
  getCharacterId(): string
  getPlanarPosition(): PlanarPosition
  getPlanarX(): number
  getPushHalfX(): number
  shiftPlanarX(delta: number): void
  getAttackState(): AttackState
  getHealth(): FighterHealth
  getHitboxShape(kind: AttackKind): HitboxShape
  getStrikeOutcome(kind: AttackKind): StrikeOutcome
  isCombatStunned(): boolean
  isStrikeConsumed(): boolean
  markStrikeConsumed(): void
  markSwingConnected(): void
  applyDamage(amount: number): void
  applyHitStun(seconds: number): void
  applyBlockStun(seconds: number): void
  faceToward(worldX: number, worldZ: number): void
  integrateMotion(snapshot: FrameSnapshot, dt: number): void
  advanceCombatTimeline(snapshot: FrameSnapshot, dt: number): void
  update(snapshot: FrameSnapshot, dt: number): void
  resetForRound(opts: { startX: number }): void
  /**
   * First frame of pre-round countdown lock: strip momentum and transient combat presentation
   * so GLB / logic stay in idle until the round starts.
   */
  applyPreRoundCountdownEngaged(): void
  /** Visual-only: hurt squash / flash / recoil (does not affect hitboxes). */
  registerHitPresentation(blocked: boolean, meta?: HitPresentationMeta): void
  /** Start plush KO fallover (call when lethal damage is applied). */
  beginKnockoutPresentation(fallSign: number): void
  /** Victory GLB when this fighter wins the round (no-op without a win clip). */
  beginRoundWinPresentation(): void
  /** Advance KO / presentation clocks when sim dt is zero (wall-clock seconds). */
  tickCombatPresentation(realDt: number): void
  /** One-shot SFX cue after a real landing (consume clears). */
  consumeLandSoundCue(): boolean
  /** GLB skeleton mixer + procedural clock; call once per render frame with real `dt`. */
  tickImportedGlbMixer?(dt: number): void
  /** Dev-only: `?attackDebug=1` overlay; null when debug off or idle attack. */
  getAttackTimingDebug(): AttackTimingDebugRow | null
  dispose(): void
}

export function createFighter(
  scene: Scene,
  options: {
    definition: CharacterDefinition
    startX?: number
  },
): PlaceholderFighter {
  const runtime = resolveCharacterRuntime(options.definition)
  const meshAssets = options.definition.createMesh()
  /** Facing correction lives on the GLB holder via `glbFighterImportConfig` when needed. */
  const visualBaseYaw = 0
  meshAssets.root.traverse((obj) => {
    if (obj instanceof Mesh) {
      obj.castShadow = true
      obj.receiveShadow = true
    }
  })
  scene.add(meshAssets.root)

  let x = options.startX ?? 0
  let feetY = 0
  let velX = 0
  let velY = 0
  let grounded = true
  let wasGrounded = true
  let landImpactTimer = 0
  let receiveHitT = 0
  let receiveHitMaxT = RECEIVE_HIT_VISUAL_DUR
  let receiveBlocked = false
  let hurtStrikeKind: AttackKind = 'light'
  let hurtRecoilX = 0
  let koFlopActive = false
  let koElapsed = 0
  let koFallSign = 1
  let landSoundPending = false
  let roundWinPresentationT = 0
  let roundWinPresentationMaxT = 0
  const attackState = createIdleAttackState()

  const contact = createFighterContactShadow(0.58)
  contact.mesh.position.set(0, -meshAssets.standHalfHeight + 0.018, 0)
  meshAssets.root.add(contact.mesh)

  const maxHp: number = runtime.combat.maxHp
  let hp: number = maxHp
  let hitStun = 0
  let blockStun = 0
  let strikeConsumed = false
  let swingConnected = false

  const bodyMat = meshAssets.body.material as MeshPhysicalMaterial
  const bodyBaseColor = new Color().copy(bodyMat.color)

  const attackHooks: AttackAdvanceHooks = {
    onBeginSwing: () => {
      strikeConsumed = false
      swingConnected = false
    },
    getSwingConnected: () => swingConnected,
    clearSwingConnected: () => {
      swingConnected = false
    },
  }

  let visAnimT = 0

  const applyMeshFromState = (snapshot: FrameSnapshot): void => {
    const anim = runtime.animation
    const defeated = hp <= 0
    const stunned = hitStun > 0 || blockStun > 0
    const busy = isAttackBusy(attackState)
    const blocking = !defeated && !stunned && grounded && snapshot.held.has('block')
    const lockedMove = defeated || busy || stunned || blocking

    const rig = meshAssets.rig
    if (rig?.armL) rig.armL.rotation.set(0, 0, 0)
    if (rig?.armR) rig.armR.rotation.set(0, 0, 0)
    if (rig?.head) rig.head.rotation.set(0, 0, 0)

    if (!defeated) {
      meshAssets.visuals.rotation.set(0, visualBaseYaw, 0)
      meshAssets.visuals.position.y = 0
    }

    const wantsCrouch = !lockedMove && snapshot.held.has('crouch')
    const crouching = wantsCrouch && grounded

    let scaleY = crouching ? anim.crouchScaleY : 1
    let scaleX = 1
    let scaleZ = 1
    if (attackState.phase === 'startup') {
      scaleX = anim.attackScale.startup.x
      scaleZ = anim.attackScale.startup.z
    } else if (attackState.phase === 'active') {
      scaleX = anim.attackScale.active.x
      scaleZ = anim.attackScale.active.z
    } else if (attackState.phase === 'recovery') {
      scaleX = anim.attackScale.recovery.x
      scaleZ = anim.attackScale.recovery.z
    }

    if (!grounded && !defeated) {
      if (velY > 1.55) {
        scaleY *= 1.07
        scaleX *= 0.94
        scaleZ *= 0.94
      } else if (velY < -1.55) {
        scaleY *= 0.89
        scaleX *= 1.07
        scaleZ *= 1.05
      } else {
        scaleY *= 1.03
      }
    }

    if (landImpactTimer > 0) {
      const u = landImpactTimer / LAND_SQUASH_DURATION
      const bump = Math.sin((1 - u) * Math.PI)
      scaleY *= 1 - 0.17 * bump
      scaleX *= 1 + 0.12 * bump
      scaleZ *= 1 + 0.1 * bump
    }

    if (blocking && grounded && !defeated) {
      scaleX *= 0.93
      scaleZ *= 1.07
    }

    if (stunned && grounded && !defeated) {
      scaleX *= 0.92
      scaleY *= 0.97
    }

    meshAssets.root.scale.set(scaleX, scaleY, scaleZ)

    bodyMat.emissive.setRGB(0, 0, 0)
    const e = anim.emissive
    if (blocking) {
      // Block hold glow: faint cool rim only.
      bodyMat.emissive.setRGB(
        Math.min(0.08, e.block[0] * 0.18),
        Math.min(0.1, e.block[1] * 0.22),
        Math.min(0.12, e.block[2] * 0.26),
      )
    }

    if (stunned && !defeated && attackState.phase === 'idle') {
      bodyMat.emissive.r = Math.max(bodyMat.emissive.r, 0.14)
      bodyMat.emissive.g = Math.max(bodyMat.emissive.g, 0.07)
    }

    if (!grounded && !defeated) {
      const ar = anim.airReadEmissive
      bodyMat.emissive.r = Math.max(bodyMat.emissive.r, ar[0])
      bodyMat.emissive.g = Math.max(bodyMat.emissive.g, ar[1])
      bodyMat.emissive.b = Math.max(bodyMat.emissive.b, ar[2])
    }

    /** Torso + limbs — root stays planar; hurtboxes use {@link meshAssets.root} position. */
    let bodyRx = 0
    let bodyRy = 0
    let bodyRz = 0
    const walkRef = Math.max(0.08, runtime.tuning.walkSpeed)
    const lunge01 = Math.min(1, Math.abs(velX) / (walkRef * 1.35))

    const animHandle = meshAssets.importedGlbAnim
    const skeletonClips = animHandle?.usesSkeletonClips === true
    const skipProceduralAttackLean =
      roundWinPresentationT > 0 ||
      (skeletonClips &&
        animHandle &&
        attackState.phase !== 'idle' &&
        attackState.kind !== null &&
        animHandle.attackKindUsesClip(attackState.kind))

    if (!defeated && attackState.kind && !skipProceduralAttackLean) {
      const ak = attackState.kind
      const frames = runtime.attackFrames[ak]
      const ph = attackState.phase
      const tIn = attackState.timeInPhase
      const ease = (p: number) => 1 - Math.pow(1 - Math.min(1, p), 2.2)

      if (ph === 'startup') {
        const dur = Math.max(1e-5, frames.startup)
        const p = Math.min(1, tIn / dur)
        const w = ease(p)
        if (ak === 'light') {
          bodyRx = -0.1 * w
          bodyRy = -0.07 * w
          if (rig?.armR) {
            rig.armR.rotation.x = -0.52 * w
            rig.armR.rotation.z = -0.12 * w
          }
          if (rig?.armL) rig.armL.rotation.x = 0.18 * w
        } else if (ak === 'heavy') {
          bodyRx = -0.19 * w
          bodyRy = 0.32 * w
          bodyRz = 0.06 * Math.sin(p * Math.PI)
          if (rig?.armR) {
            rig.armR.rotation.x = -0.92 * w
            rig.armR.rotation.z = -0.2 * w
          }
          if (rig?.armL) rig.armL.rotation.x = 0.38 * w
        } else {
          bodyRx = -0.24 * w - 0.12 * w * lunge01
          bodyRy = -0.38 * w
          bodyRz = 0.11 * Math.sin(p * Math.PI)
          if (rig?.armR) {
            rig.armR.rotation.x = -0.72 * w
            rig.armR.rotation.y = 0.35 * w
          }
          if (rig?.armL) {
            rig.armL.rotation.x = 0.42 * w
            rig.armL.rotation.y = -0.22 * w
          }
        }
        if (rig?.head) rig.head.rotation.x = -0.08 * w
      } else if (ph === 'active') {
        if (ak === 'light') {
          bodyRx = 0.1
          bodyRy = 0.05
          if (rig?.armR) {
            rig.armR.rotation.x = 0.78
            rig.armR.rotation.z = 0.08
          }
          if (rig?.armL) rig.armL.rotation.x = -0.22
        } else if (ak === 'heavy') {
          bodyRx = 0.14
          bodyRy = -0.26
          bodyRz = -0.12
          if (rig?.armR) {
            rig.armR.rotation.x = 1.12
            rig.armR.rotation.z = 0.18
          }
          if (rig?.armL) rig.armL.rotation.x = -0.35
        } else {
          bodyRx = 0.2 + 0.14 * lunge01
          bodyRy = 0.22
          bodyRz = -0.16 * (1 - lunge01 * 0.35)
          if (rig?.armR) {
            rig.armR.rotation.x = 1.05 + 0.2 * lunge01
            rig.armR.rotation.y = -0.28 * (1 - lunge01)
          }
          if (rig?.armL) {
            rig.armL.rotation.x = -0.55
            rig.armL.rotation.y = 0.2
          }
        }
        if (rig?.head) {
          rig.head.rotation.x = 0.12 + 0.08 * lunge01
          rig.head.rotation.z = -0.06 * lunge01
        }
      } else if (ph === 'recovery' && attackState.recoveryDuration > 1e-5) {
        const p = Math.min(1, tIn / attackState.recoveryDuration)
        const follow = Math.sin(p * Math.PI) * (1 - p * 0.35)
        const decay = 1 - p
        if (ak === 'light') {
          bodyRx = 0.08 * (1 - p) + 0.05 * follow
          if (rig?.armR) rig.armR.rotation.x = 0.35 * decay
        } else if (ak === 'heavy') {
          bodyRx = 0.1 * (1 - p) + 0.12 * follow
          bodyRy = -0.18 * follow
          if (rig?.armR) rig.armR.rotation.x = 0.45 * decay
        } else {
          bodyRx = 0.12 * (1 - p) + 0.15 * follow
          bodyRy = 0.2 * follow
          if (rig?.armR) rig.armR.rotation.x = 0.5 * decay
          if (rig?.armL) rig.armL.rotation.x = -0.22 * decay
        }
        if (rig?.head) rig.head.rotation.z = 0.14 * follow
      }
    }

    if (!defeated && blocking && grounded) {
      bodyRx = Math.max(bodyRx, 0.068)
    }

    if (!defeated && stunned && grounded) {
      if (attackState.phase === 'idle') {
        const stunP = Math.min(1, hitStun / 0.52)
        bodyRz += 0.1 + 0.14 * stunP
        bodyRx += -0.06 - 0.1 * stunP
        if (rig?.armL) rig.armL.rotation.z = 0.22 + 0.2 * stunP
        if (rig?.armR) rig.armR.rotation.z = -0.08 - 0.12 * stunP
        if (rig?.head) {
          rig.head.rotation.x = -0.05 * stunP
          rig.head.rotation.z = 0.12 * stunP
        }
      } else {
        bodyRz += 0.06
      }
    }

    if (!defeated && !grounded) {
      if (velY > 1.55) bodyRx = Math.max(bodyRx, 0.088)
      else if (velY < -1.55) bodyRx = Math.min(bodyRx, -0.12)
    }

    let bsx = 1
    let bsy = 1
    let bsz = 1
    const skipProceduralHitLean =
      skeletonClips && animHandle && receiveHitT > 0 && animHandle.hasHurtClip

    if (receiveHitT > 0 && receiveHitMaxT > 1e-6) {
      const u = receiveHitT / receiveHitMaxT
      const s = Math.sin((1 - u) * Math.PI)
      const str = receiveBlocked
        ? 0.48
        : hurtStrikeKind === 'special'
          ? 1.35
          : hurtStrikeKind === 'heavy'
            ? 1.18
            : 1
      const amp = (receiveBlocked ? 0.025 : 0.055) * str
      bsx = 1 + amp * s
      bsy = 1 - amp * 0.72 * s
      bsz = 1 + amp * 0.45 * s
      if (!skipProceduralHitLean) {
        bodyRx += (-0.11 - 0.12 * str) * s * (receiveBlocked ? 0.55 : 1)
        bodyRz += -hurtRecoilX * (0.38 + 0.25 * str) * s * (receiveBlocked ? 0.45 : 1)
        bodyRy += hurtRecoilX * 0.12 * s * (1 - Math.abs(hurtRecoilX))
        if (rig?.head) {
          rig.head.rotation.z += hurtRecoilX * (0.55 + 0.25 * str) * s
          rig.head.rotation.x -= 0.2 * s * str * (receiveBlocked ? 0.5 : 1)
        }
        if (rig?.armR) rig.armR.rotation.x += 0.35 * s * str * (receiveBlocked ? 0.4 : 1)
        if (rig?.armL) rig.armL.rotation.x += -0.28 * s * str * (receiveBlocked ? 0.35 : 1)
      }
      const flash = s * (receiveBlocked ? 0.02 : 0.22 + 0.04 * str)
      bodyMat.emissive.r = Math.max(bodyMat.emissive.r, flash * (receiveBlocked ? 0.72 : 1))
      bodyMat.emissive.g = Math.max(bodyMat.emissive.g, flash * (receiveBlocked ? 0.92 : 0.82))
      bodyMat.emissive.b = Math.max(bodyMat.emissive.b, flash * (receiveBlocked ? 1.12 : 0.74))
    }

    const motionRoot = meshAssets.proceduralMotionRoot

    if (motionRoot) {
      meshAssets.body.rotation.set(0, 0, 0)
      meshAssets.body.scale.set(1, 1, 1)
    }

    let procBobY = 0
    let procAddRx = 0
    let procAddRz = 0
    if (motionRoot && !skeletonClips && !defeated) {
      procBobY = Math.sin(visAnimT * 2.35) * 0.015
      procAddRx = Math.sin(visAnimT * 1.65) * 0.02
      const walkPulse = Math.sin(visAnimT * 9.2) * 0.008
      if (grounded && Math.abs(velX) > walkRef * 0.12) {
        const mv = Math.min(1, Math.abs(velX) / (walkRef * 1.15))
        procAddRz -= Math.sign(velX || 1) * (0.065 * mv + walkPulse * mv)
        procAddRx += 0.045 * mv
        procBobY += Math.sin(visAnimT * 12.5) * 0.006 * mv
      }
    }

    const motionTarget = motionRoot ?? meshAssets.body
    motionTarget.rotation.x = bodyRx + procAddRx
    motionTarget.rotation.y = bodyRy
    motionTarget.rotation.z = bodyRz + procAddRz
    motionTarget.scale.set(bsx, bsy, bsz)

    if (motionRoot && meshAssets.proceduralMotionRootBaseY !== undefined) {
      motionRoot.position.y = meshAssets.proceduralMotionRootBaseY + procBobY
    }

    let attackCycleDuration: number | null = null
    if (attackState.kind && attackState.phase !== 'idle') {
      const f = runtime.attackFrames[attackState.kind]
      attackCycleDuration = attackFullCycleForAnimSync(f)
    }

    meshAssets.importedGlbAnim?.syncFromState({
      defeated,
      koFlopActive,
      grounded,
      velX,
      velY,
      attackPhase: attackState.phase,
      attackKind: attackState.kind,
      receiveHitT,
      receiveHitMaxT,
      blocking,
      hitStun,
      blockStun,
      walkSpeedRef: walkRef,
      attackCycleDuration,
      roundWinPresentationT,
      roundWinPresentationMaxT,
    })

    if (defeated) {
      bodyMat.color.copy(bodyBaseColor).multiplyScalar(anim.koColorMul)
      if (koFlopActive) {
        const tipEnd = 0.48
        const bounceEnd = 0.64
        const sign = koFallSign
        let rx = 0
        let rz = 0
        let vy = 0
        if (koElapsed < tipEnd) {
          const p = smoothstep01(koElapsed / tipEnd)
          const e = 1 - Math.pow(1 - p, 2.4)
          rz = sign * (1.15 * e)
          rx = 0.36 * e
          vy = -0.11 * Math.sin(p * Math.PI)
        } else if (koElapsed < bounceEnd) {
          const u = (koElapsed - tipEnd) / (bounceEnd - tipEnd)
          const bump = Math.sin(u * Math.PI)
          rz = sign * (1.15 - 0.14 * bump)
          rx = 0.36 + 0.04 * bump
          vy = 0.055 * bump
        } else {
          const tail = Math.max(1e-5, KO_FLOP_DURATION - bounceEnd)
          const u = Math.min(1, (koElapsed - bounceEnd) / tail)
          rz = sign * (1.01 - 0.05 * u)
          rx = 0.34 * (1 - 0.1 * u)
        }
        meshAssets.visuals.rotation.x = rx
        meshAssets.visuals.rotation.y = visualBaseYaw
        meshAssets.visuals.rotation.z = rz
        meshAssets.visuals.position.y = vy
        if (rig?.head) rig.head.rotation.x += 0.22 * smoothstep01(Math.min(1, koElapsed / 0.35))
      } else {
        meshAssets.visuals.rotation.x = 0.12
        meshAssets.visuals.rotation.y = visualBaseYaw
        meshAssets.visuals.rotation.z = 0.04 * Math.sign(x || 1)
      }
    } else {
      bodyMat.color.copy(bodyBaseColor)
    }

    const half = meshAssets.standHalfHeight * scaleY
    meshAssets.root.position.set(x, feetY + half, FIGHT_PLANE_Z)
    snapRootToFightingPlane(meshAssets.root)

    // Keep floor contact shadow visually synced (smaller + lighter when airborne).
    const air01 = Math.max(0, Math.min(1, feetY / 1.35))
    const groundedMul = grounded ? 1 : 1 - air01 * 0.28
    const sx = 1 + air01 * 0.42
    const sz = 1 + air01 * 0.36
    contact.mesh.scale.set(sx * groundedMul, 1, sz * groundedMul)
    const coreMesh = contact.mesh.children[1]
    const coreMat = coreMesh instanceof Mesh ? coreMesh.material : null
    if (coreMat instanceof MeshBasicMaterial) {
      coreMat.opacity = grounded ? 1 : 1 - air01 * 0.62
    }
    const glowMesh = contact.mesh.children[0]
    const glowMat = glowMesh instanceof Mesh ? glowMesh.material : null
    if (glowMat instanceof MeshBasicMaterial) {
      glowMat.opacity = grounded ? 0.28 : 0.16 - air01 * 0.08
    }
  }

  const api = {} as PlaceholderFighter

  api.mesh = meshAssets
  Object.defineProperty(api, 'grounded', { get: () => grounded })
  api.getCharacterId = () => runtime.id
  api.getPlanarPosition = () => ({ x, z: FIGHT_PLANE_Z })
  api.getPlanarX = () => x
  api.getPushHalfX = () => {
    const sy = meshAssets.root.scale.y
    return runtime.tuning.pushHalfX * Math.max(0.62, Math.min(1, sy))
  }
  api.shiftPlanarX = (delta: number) => {
    x = Math.max(-runtime.tuning.xLimit, Math.min(runtime.tuning.xLimit, x + delta))
    const scaleY = meshAssets.root.scale.y
    const half = meshAssets.standHalfHeight * scaleY
    meshAssets.root.position.set(x, feetY + half, FIGHT_PLANE_Z)
    snapRootToFightingPlane(meshAssets.root)
  }
  api.getAttackState = () => ({ ...attackState })
  api.getHealth = () => ({ current: hp, max: maxHp })
  api.getHitboxShape = (kind: AttackKind) => runtime.hitboxes[kind]
  api.getStrikeOutcome = (kind: AttackKind) => {
    const c = runtime.combat
    return {
      damage: c.damage[kind],
      hitStun: c.hitStun[kind],
      blockStunDefender: c.blockStunDefender[kind],
      blockStunAttacker: c.blockStunAttacker[kind],
    }
  }
  api.isCombatStunned = () => hitStun > 0 || blockStun > 0
  api.isStrikeConsumed = () => strikeConsumed
  api.markStrikeConsumed = () => {
    strikeConsumed = true
  }
  api.markSwingConnected = () => {
    swingConnected = true
  }
  api.applyDamage = (amount: number) => {
    if (hp <= 0) return
    hp = Math.max(0, hp - amount)
    blockStun = 0
  }
  api.applyHitStun = (seconds: number) => {
    hitStun = Math.max(hitStun, seconds)
  }
  api.applyBlockStun = (seconds: number) => {
    blockStun = Math.max(blockStun, seconds)
  }
  api.faceToward = (worldX: number, worldZ: number) => {
    const dx = worldX - x
    const dz = worldZ - FIGHT_PLANE_Z
    meshAssets.root.rotation.y = Math.atan2(dx, dz)
    snapRootToFightingPlane(meshAssets.root)
  }

  api.applyPreRoundCountdownEngaged = () => {
    velX = 0
    if (grounded) velY = 0
    hitStun = 0
    blockStun = 0
    receiveHitT = 0
    roundWinPresentationT = 0
    roundWinPresentationMaxT = 0
    strikeConsumed = false
    swingConnected = false
    attackState.kind = null
    attackState.phase = 'idle'
    attackState.timeInPhase = 0
    attackState.recoveryDuration = 0
    applyMeshFromState(EMPTY_FRAME_SNAPSHOT)
  }

  api.integrateMotion = (snapshot: FrameSnapshot, dt: number) => {
    hitStun = Math.max(0, hitStun - dt)
    blockStun = Math.max(0, blockStun - dt)

    const tuning = runtime.tuning
    const defeated = hp <= 0
    const stunned = hitStun > 0 || blockStun > 0
    const busy = isAttackBusy(attackState)
    const blocking = !defeated && !stunned && grounded && snapshot.held.has('block')
    const lockedMove = defeated || busy || stunned || blocking

    const axis = lockedMove ? 0 : readMoveAxis(snapshot)
    const wantsCrouch = !lockedMove && snapshot.held.has('crouch')

    if (lockedMove) {
      velX = 0
    } else if (grounded) {
      const speed = tuning.walkSpeed * (wantsCrouch ? tuning.crouchSpeedFactor : 1)
      velX = axis * speed
    } else {
      const target = axis * tuning.walkSpeed * tuning.airControl
      const k = 1 - Math.exp(-14 * dt)
      velX += (target - velX) * k
    }

    if (
      !lockedMove &&
      snapshot.pressed.has('jump') &&
      grounded &&
      feetY <= GROUND_SURFACE_Y + GROUND_CONTACT_EPS
    ) {
      velY = tuning.jumpVelocity
      grounded = false
    }

    velY -= tuning.gravity * dt

    const ground = resolveFeetOnGroundPlane(feetY, velY, dt, GROUND_SURFACE_Y, GROUND_CONTACT_EPS)
    feetY = ground.feetY
    velY = ground.velY
    grounded = ground.grounded

    if (!wasGrounded && grounded) {
      landImpactTimer = LAND_SQUASH_DURATION
      if (dt > 0) landSoundPending = true
    }
    wasGrounded = grounded
    const landDec = dt > 0 ? dt : landImpactTimer > 0 ? 1 / 60 : 0
    landImpactTimer = Math.max(0, landImpactTimer - landDec)
    const rvDec = dt > 0 ? dt : receiveHitT > 0 ? 1 / 60 : 0
    receiveHitT = Math.max(0, receiveHitT - rvDec)
    const winDec = dt > 0 ? dt : roundWinPresentationT > 0 ? 1 / 60 : 0
    roundWinPresentationT = Math.max(0, roundWinPresentationT - winDec)

    x += velX * dt
    x = Math.max(-tuning.xLimit, Math.min(tuning.xLimit, x))

    applyMeshFromState(snapshot)
  }

  api.advanceCombatTimeline = (snapshot: FrameSnapshot, dt: number) => {
    const defeated = hp <= 0
    const stunned = hitStun > 0 || blockStun > 0
    const blocking =
      !defeated && !stunned && grounded && snapshot.held.has('block')
    const canStartNew =
      !defeated && !stunned && grounded && attackState.phase === 'idle' && !blocking

    advanceAttackState(
      attackState,
      snapshot,
      dt,
      canStartNew,
      attackHooks,
      runtime.attackFrames,
    )
    if (attackState.phase === 'idle') {
      // Ensure no stale strike flags carry over into idle / next swing.
      strikeConsumed = false
      swingConnected = false
    }
    applyMeshFromState(snapshot)
  }

  api.update = (snapshot: FrameSnapshot, dt: number) => {
    api.integrateMotion(snapshot, dt)
    api.advanceCombatTimeline(snapshot, dt)
  }

  api.resetForRound = (opts: { startX: number }) => {
    hp = maxHp
    hitStun = 0
    blockStun = 0
    strikeConsumed = false
    swingConnected = false
    x = opts.startX
    velX = 0
    velY = 0
    feetY = GROUND_SURFACE_Y
    grounded = true
    wasGrounded = true
    landImpactTimer = 0
    receiveHitT = 0
    receiveHitMaxT =
      runtime.id === 'bibi' ? RECEIVE_HIT_VISUAL_DUR_BIBI : RECEIVE_HIT_VISUAL_DUR
    receiveBlocked = false
    hurtStrikeKind = 'light'
    hurtRecoilX = 0
    koFlopActive = false
    koElapsed = 0
    landSoundPending = false
    roundWinPresentationT = 0
    roundWinPresentationMaxT = 0
    meshAssets.visuals.rotation.set(0, visualBaseYaw, 0)
    meshAssets.visuals.position.y = 0
    meshAssets.body.scale.set(1, 1, 1)
    meshAssets.body.rotation.set(0, 0, 0)
    visAnimT = 0
    if (meshAssets.proceduralMotionRoot) {
      const by = meshAssets.proceduralMotionRootBaseY ?? 0
      meshAssets.proceduralMotionRoot.position.set(0, by, 0)
      meshAssets.proceduralMotionRoot.rotation.set(0, 0, 0)
      meshAssets.proceduralMotionRoot.scale.set(1, 1, 1)
    }
    meshAssets.importedGlbAnim?.resetPose()
    attackState.kind = null
    attackState.phase = 'idle'
    attackState.timeInPhase = 0
    attackState.recoveryDuration = 0
    applyMeshFromState(EMPTY_FRAME_SNAPSHOT)
  }

  api.registerHitPresentation = (blocked: boolean, meta?: HitPresentationMeta) => {
    receiveBlocked = blocked
    hurtStrikeKind = meta?.strikeKind ?? 'light'
    const rx = meta?.recoilX
    hurtRecoilX = rx === undefined || Number.isNaN(rx) ? 0 : Math.max(-1, Math.min(1, rx))
    const sm = blocked
      ? 0.52
      : hurtStrikeKind === 'special'
        ? 1.48
        : hurtStrikeKind === 'heavy'
          ? 1.25
          : 1
    const hitBase =
      runtime.id === 'bibi' ? RECEIVE_HIT_VISUAL_DUR_BIBI : RECEIVE_HIT_VISUAL_DUR
    receiveHitMaxT = hitBase * sm
    receiveHitT = receiveHitMaxT
  }

  api.beginKnockoutPresentation = (fallSign: number) => {
    if (hp > 0 || koFlopActive) return
    koFlopActive = true
    koElapsed = 0
    koFallSign = fallSign >= 0 ? 1 : -1
  }

  api.beginRoundWinPresentation = () => {
    if (!ENABLE_ROUND_WIN_PRESENTATION) return
    if (hp <= 0) return
    const h = meshAssets.importedGlbAnim
    if (!h?.usesSkeletonClips || !h.hasWinClip) return
    roundWinPresentationMaxT = ROUND_WIN_PRESENTATION_SEC
    roundWinPresentationT = ROUND_WIN_PRESENTATION_SEC
  }

  api.tickCombatPresentation = (realDt: number) => {
    if (koFlopActive && hp <= 0) koElapsed += realDt
  }

  api.consumeLandSoundCue = () => {
    if (!landSoundPending) return false
    landSoundPending = false
    return true
  }

  api.tickImportedGlbMixer = (dt: number) => {
    if (dt > 0) visAnimT += dt
    meshAssets.importedGlbAnim?.updateMixer(dt)
  }

  api.getAttackTimingDebug = (): AttackTimingDebugRow | null => {
    if (!isAttackTimingDebugEnabled()) return null
    const st = attackState
    if (st.phase === 'idle' || !st.kind) {
      return {
        characterId: runtime.id,
        attackKind: null,
        attackPhase: st.phase,
        timeInPhase: st.timeInPhase,
        cycleSeconds: null,
        startupS: 0,
        activeS: 0,
        recoveryMaxS: 0,
        hitActive: false,
        activeStartNorm: null,
        activeEndNorm: null,
        clipLabel: null,
        clipDuration: null,
        clipTime: null,
        clipNorm: null,
        playbackSpeed: null,
      }
    }
    const f = runtime.attackFrames[st.kind]
    const cycle = attackFullCycleForAnimSync(f)
    const animDbg = meshAssets.importedGlbAnim?.readCombatAnimDebug?.() ?? null
    const clipDur = animDbg?.clipDuration ?? null
    const clipTime = animDbg?.clipTime ?? null
    const clipNorm =
      clipDur !== null && clipTime !== null && clipDur > 1e-6 ? clipTime / clipDur : null
    return {
      characterId: runtime.id,
      attackKind: st.kind,
      attackPhase: st.phase,
      timeInPhase: st.timeInPhase,
      cycleSeconds: cycle,
      startupS: f.startup,
      activeS: f.active,
      recoveryMaxS: Math.max(f.recoveryOnConnect, f.recoveryOnWhiff),
      hitActive: st.phase === 'active',
      activeStartNorm: f.startup / cycle,
      activeEndNorm: (f.startup + f.active) / cycle,
      clipLabel: animDbg?.clipName ?? null,
      clipDuration: clipDur,
      clipTime,
      clipNorm,
      playbackSpeed: animDbg?.effectiveTimeScale ?? null,
    }
  }

  api.dispose = () => {
    meshAssets.root.remove(contact.mesh)
    contact.dispose()
    disposePlaceholderFighterMesh(meshAssets)
  }

  return api
}

export function createPlaceholderFighter(
  scene: Scene,
  options: {
    startX?: number
    movement?: Partial<MovementTuning>
    jump?: Partial<JumpArc>
    /** Prefer `movement` + `jump`; maps gravity / jumpVelocity to `jump`, the rest to `movement`. */
    tuning?: Partial<FighterTuning>
    bodyColor?: number
    headColor?: number
  } = {},
): PlaceholderFighter {
  let movement = options.movement
  let jump = options.jump
  if (options.tuning) {
    const split = splitLegacyTuning(options.tuning)
    movement = { ...split.movement, ...movement }
    jump = { ...split.jump, ...jump }
  }
  const def: CharacterDefinition = {
    ...CHARACTER_PLACEHOLDER_DEFAULT,
    movement,
    jump,
    createMesh: () =>
      createPlaceholderFighterMesh({
        bodyColor: options.bodyColor,
        headColor: options.headColor,
      }),
  }
  return createFighter(scene, { definition: def, startX: options.startX })
}
