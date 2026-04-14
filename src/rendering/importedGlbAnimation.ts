import type { Object3D } from 'three'
import {
  AnimationClip,
  AnimationMixer,
  LoopOnce,
  LoopRepeat,
  type AnimationAction,
} from 'three'
import type { AttackKind, AttackPhase } from '../gameplay/combat/attackTimeline'

export type ImportedGlbAnimCombatSnapshot = {
  defeated: boolean
  koFlopActive: boolean
  grounded: boolean
  velX: number
  velY: number
  attackPhase: AttackPhase
  attackKind: AttackKind | null
  receiveHitT: number
  /** Initial hit-presentation window (constant while `receiveHitT` counts down). */
  receiveHitMaxT: number
  blocking: boolean
  hitStun: number
  blockStun: number
  walkSpeedRef: number
  /**
   * Nominal full attack cycle (startup + active + max recovery) — used to time-scale attack clips.
   */
  attackCycleDuration: number | null
  /** Round / match just won — play victory clip while this counts down (see fighter `beginRoundWinPresentation`). */
  roundWinPresentationT: number
  /** Initial win window length (constant while {@link roundWinPresentationT} counts down). */
  roundWinPresentationMaxT: number
}

export type ImportedGlbCombatAnimDebugRow = {
  clipName: string
  clipDuration: number
  clipTime: number
  effectiveTimeScale: number
}

export type ImportedGlbAnimationHandle = {
  syncFromState(snapshot: ImportedGlbAnimCombatSnapshot): void
  updateMixer(dt: number): void
  resetPose(): void
  dispose(): void
  /** True if a GLB clip is mapped for this attack (matches what sync will play). */
  attackKindUsesClip(kind: AttackKind): boolean
  /** When the current mixer action is this fighter’s attack clip for the active swing. */
  readCombatAnimDebug?: () => ImportedGlbCombatAnimDebugRow | null
  readonly usesSkeletonClips: boolean
  readonly hasLightClip: boolean
  readonly hasHeavyClip: boolean
  readonly hasSpecialClip: boolean
  readonly hasHurtClip: boolean
  readonly hasKoClip: boolean
  readonly hasWinClip: boolean
  /**
   * After the backing clip array is mutated (staged GLB loading), re-run fuzzy binding
   * and refresh the current pose from the last snapshot.
   */
  rescanAnimationClips?(): void
}

export type ImportedGlbAnimationOptions = {
  /**
   * Standing / idle: play clips in order, one loop each (`LoopOnce`), then cross-fade to the next.
   * Use for e.g. long breath ↔ look around. If length is 1, that clip loops as normal idle.
   */
  idleAlternationClips?: readonly AnimationClip[]
  /**
   * Roster GLB pipeline: clips arrive in stages; keep mixer alive even if the first batch is only bind-pose junk.
   */
  stagedLoading?: boolean
  /** Per-fighter attack playback tuning; multiplies computed attack clip timescale. */
  attackPlaybackScaleByKind?: Partial<Record<AttackKind, number>>
  /**
   * Optional explicit clip-name patterns (first match wins) to avoid fuzzy mis-mapping.
   * Useful when a roster asset has ambiguous clip names.
   */
  clipPatterns?: Partial<Record<'idle' | 'walk' | 'run' | 'light' | 'heavy' | 'special', readonly string[]>>
  /** If true, idle never falls back to walk / arbitrary legacy clip. */
  strictIdleOnly?: boolean
  /**
   * If true, when a new attack starts (startup edge), restart the attack clip from frame 0
   * even when the same clip/action was previously active.
   */
  restartAttackClipOnStartup?: boolean
  /** If true, do not fallback heavy<->special clip selection when one is missing. */
  strictAttackClipByKind?: boolean
  /** Optional per-fighter idle loop playback scale (1 = unchanged). */
  idlePlaybackScale?: number
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[\s_-]+/g, '')
}

/** Bind / rest pose: exclude from combat locomotion (Meshy often exports `Armature|clip0|baselayer` as ~1 frame). */
function isTposeishClip(c: AnimationClip): boolean {
  const n = norm(c.name)
  const microBind = c.duration < 0.085 && (n.includes('clip0') || n.includes('tpose'))
  return (
    microBind ||
    n.includes('tpose') ||
    n.includes('apose') ||
    n.includes('bindpose') ||
    n.includes('reference') ||
    n === 'default'
  )
}

/** First pattern match wins (order = priority). Exported for per-fighter clip wiring. */
export function pickAnimationClipByNamePatterns(
  clips: readonly AnimationClip[],
  patterns: readonly string[],
): AnimationClip | undefined {
  for (const pat of patterns) {
    const p = norm(pat)
    const hit = clips.find((c) => norm(c.name).includes(p))
    if (hit) return hit
  }
  return undefined
}

function pickClip(
  clips: AnimationClip[],
  patterns: readonly string[],
): AnimationClip | undefined {
  return pickAnimationClipByNamePatterns(clips, patterns)
}

function pickFightingIdle(usable: AnimationClip[]): AnimationClip | undefined {
  const scored = usable
    .filter((c) => !isTposeishClip(c))
    .map((c) => {
      const n = norm(c.name)
      let score = 0
      if (n.includes('fight') || n.includes('combat') || n.includes('brawl')) score += 12
      if (n.includes('guard') || n.includes('block') || n.includes('stance')) score += 11
      if (n.includes('box') || n.includes('ready')) score += 9
      if (n.includes('idle') || n.includes('stand') || n.includes('relax') || n.includes('breath'))
        score += 6
      if (n.includes('crouch') && !n.includes('walk')) score += 4
      return { c, score }
    })
    .filter((x) => x.score > 0)
  if (scored.length) {
    scored.sort((a, b) => b.score - a.score)
    return scored[0].c
  }
  return pickClip(usable, ['idle', 'stand', 'breath', 'relax', 'neutral'])
}

function logAnimMap(
  label: string,
  map: {
    idle: string
    walk: string
    run: string
    light: string
    heavy: string
    special: string
    hurt: string
    ko: string
    win: string
  },
): void {
  console.info(
    `[ANIM_DEBUG] ${label} map idle=${map.idle} walk=${map.walk} run=${map.run} light=${map.light} heavy=${map.heavy} special=${map.special} hurt=${map.hurt} ko=${map.ko} win=${map.win}`,
  )
}

const fmt = (c: AnimationClip | undefined) => (c ? c.name : '(none)')

/**
 * AnimationMixer + fuzzy clip names for Meshy / Mixamo-style GLBs.
 */
export function createImportedGlbAnimationDriver(
  root: Object3D,
  animations: readonly AnimationClip[],
  label: string,
  options?: ImportedGlbAnimationOptions,
): ImportedGlbAnimationHandle {
  const stagedLoading = !!options?.stagedLoading
  const animationSource = animations as readonly AnimationClip[]

  const buildUsable = (): AnimationClip[] =>
    animationSource.filter(
      (c) => c.duration > 1e-3 && c.tracks.length > 0 && !isTposeishClip(c),
    )

  let usable = buildUsable()
  const usesSkeletonClips = usable.length > 0 || stagedLoading
  if (!usesSkeletonClips && animationSource.length === 0) {
    console.info(
      `[GLB_DEBUG] ${label} mixer=off (no usable clips; procedural motion only). rawCount=${animationSource.length}`,
    )
    const emptyMap = {
      idle: '(none)',
      walk: '(none)',
      run: '(none)',
      light: '(none)',
      heavy: '(none)',
      special: '(none)',
      hurt: '(none)',
      ko: '(none)',
      win: '(none)',
    }
    logAnimMap(label, emptyMap)
    return {
      usesSkeletonClips: false,
      hasLightClip: false,
      hasHeavyClip: false,
      hasSpecialClip: false,
      hasHurtClip: false,
      hasKoClip: false,
      hasWinClip: false,
      attackKindUsesClip: () => false,
      readCombatAnimDebug: () => null,
      syncFromState() {},
      updateMixer() {},
      resetPose() {},
      dispose() {},
      rescanAnimationClips() {},
    }
  }

  if (usable.length === 0 && stagedLoading) {
    console.info(
      `[GLB_DEBUG] ${label} mixer=on stagedLoading · usableClips=0 (awaiting more GLB stages); raw=${animationSource.length}`,
    )
  } else {
    console.info(
      `[GLB_DEBUG] ${label} mixer=on usableClips=${JSON.stringify(usable.map((c) => c.name))}`,
    )
  }

  const mixer = new AnimationMixer(root)

  const idleAltRaw = (options?.idleAlternationClips ?? []).filter(
    (c) => c.duration >= 0.05 && c.tracks.length > 0 && !isTposeishClip(c),
  )
  const useIdleAlternation = idleAltRaw.length >= 2
  const idleAlternationClips = useIdleAlternation ? [...idleAltRaw] : []
  let idleAltIndex = 0

  let byIdle: AnimationClip | undefined
  let byWalk: AnimationClip | undefined
  let byRun: AnimationClip | undefined
  let byLight: AnimationClip | undefined
  let byHeavy: AnimationClip | undefined
  let bySpecial: AnimationClip | undefined
  let byBlock: AnimationClip | undefined
  let byHurt: AnimationClip | undefined
  let byKo: AnimationClip | undefined
  let byWin: AnimationClip | undefined

  let useSlowWalkAsIdle = false
  let legacyIdleClip: AnimationClip | undefined

  const clipFlags = {
    hasLightClip: false,
    hasHeavyClip: false,
    hasSpecialClip: false,
    hasHurtClip: false,
    hasKoClip: false,
    hasWinClip: false,
  }

  function refreshClipBindings(): void {
    const p = options?.clipPatterns
    usable = buildUsable()
    if (useIdleAlternation) {
      byIdle = idleAlternationClips[0]
    } else if (idleAltRaw.length === 1) {
      byIdle = idleAltRaw[0]
    } else if (p?.idle?.length) {
      byIdle = pickClip(usable, p.idle)
    } else {
      byIdle = pickFightingIdle(usable)
    }
    byWalk = p?.walk?.length
      ? pickClip(usable, p.walk)
      : pickClip(usable, [
      'walk',
      'jog',
      'move',
      'forward',
      'crouchwalk',
      'sneak',
      'stride',
    ])
    byRun = p?.run?.length ? pickClip(usable, p.run) : pickClip(usable, ['run', 'sprint', 'dash'])
    byLight = p?.light?.length
      ? pickClip(usable, p.light)
      : pickClip(usable, [
      'jab',
      'punch',
      'hook',
      'cross',
      'strike',
      'slap',
      'chop',
      'combo',
      'melee',
      'attack',
      'slash',
      'swing',
      'light',
      'hit1',
    ])
    byHeavy = p?.heavy?.length
      ? pickClip(usable, p.heavy)
      : pickClip(usable, [
      'atkmed',
      'kick',
      'roundhouse',
      'stomp',
      'knee',
      'leg',
      'medium',
      'heavy',
      'smash',
      'uppercut',
      'upper',
      'drop',
      'slam',
      'attack2',
    ])
    bySpecial = p?.special?.length
      ? pickClip(usable, p.special)
      : pickClip(usable, [
      'atkheavy',
      'spin',
      '360',
      'special',
      'power',
      'ultimate',
      'charge',
      'jumpattack',
      'leap',
      'heavy',
    ])
    byBlock = pickClip(usable, ['block', 'guard', 'defend', 'stance', 'cover'])
    byHurt = pickClip(usable, [
      'hurt',
      'hit',
      'damage',
      'react',
      'stagger',
      'impact',
      'flinch',
      'recoil',
      'pain',
      'knockback',
    ])
    byKo = pickClip(usable, [
      'death',
      'die',
      'ko',
      'knock',
      'knockdown',
      'fall',
      'defeat',
      'collapse',
      'ragdoll',
      'down',
    ])
    byWin = pickClip(usable, ['win', 'victory', 'triumph', 'celebrat', 'cheer'])

    const strictIdleOnly = options?.strictIdleOnly === true
    useSlowWalkAsIdle = !strictIdleOnly && !byIdle && !useIdleAlternation && !!byWalk
    legacyIdleClip =
      !strictIdleOnly && !byIdle && !useIdleAlternation && !useSlowWalkAsIdle
        ? usable[0]
        : undefined

    clipFlags.hasLightClip = !!byLight
    clipFlags.hasHeavyClip = !!byHeavy
    clipFlags.hasSpecialClip = !!bySpecial
    clipFlags.hasHurtClip = !!byHurt
    clipFlags.hasKoClip = !!byKo
    clipFlags.hasWinClip = !!byWin

    logAnimMap(label, {
      idle: useIdleAlternation
        ? idleAlternationClips.map((c) => c.name).join(' ~ ')
        : fmt(byIdle),
      walk: fmt(byWalk),
      run: fmt(byRun),
      light: fmt(byLight),
      heavy: fmt(byHeavy),
      special: fmt(bySpecial),
      hurt: fmt(byHurt),
      ko: fmt(byKo),
      win: fmt(byWin),
    })
  }

  refreshClipBindings()

  let current: AnimationAction | null = null
  let lastSnapshot: ImportedGlbAnimCombatSnapshot | null = null
  /** After attack clip ends, locomotion is blended in once until phase returns to idle. */
  let blendedLocomotionDuringAttack = false

  const fade = 0.18
  const fadeAttack = 0.12
  const idlePlaybackScale = Math.max(0.2, Math.min(2.5, options?.idlePlaybackScale ?? 1))

  function playClip(
    clip: AnimationClip | undefined,
    loop: boolean,
    weight = 1,
    timeScale = 1,
    crossFadeDur = fade,
    forceRestart = false,
  ): void {
    if (!clip) return
    const next = mixer.clipAction(clip)
    next.enabled = true
    next.setEffectiveWeight(weight)
    next.clampWhenFinished = !loop
    if (loop) next.setLoop(LoopRepeat, Infinity)
    else next.setLoop(LoopOnce, 1)

    const sameAction = current === next

    if (current && !sameAction) {
      next.setEffectiveTimeScale(timeScale)
      next.reset().play()
      current.crossFadeTo(next, crossFadeDur, false)
      current = next
    } else if (sameAction && current) {
      current.setEffectiveTimeScale(timeScale)
      if (forceRestart) current.reset().play()
    } else {
      next.setEffectiveTimeScale(timeScale)
      next.reset().play()
      current = next
    }
  }

  function locomotionIdleStationary(s: ImportedGlbAnimCombatSnapshot): boolean {
    const speed = Math.abs(s.velX)
    return (
      s.grounded &&
      !s.defeated &&
      speed <= s.walkSpeedRef * 0.22 &&
      s.attackPhase === 'idle' &&
      s.receiveHitT <= 0
    )
  }

  /** Plays one shot of the current alternation clip; advances on mixer `finished`. */
  function playIdleAlternationAt(index: number, weight = 1, crossFadeDur = fade): void {
    if (!idleAlternationClips.length) return
    const clip = idleAlternationClips[index % idleAlternationClips.length]
    const next = mixer.clipAction(clip)
    next.enabled = true
    next.setEffectiveWeight(weight)
    next.setLoop(LoopOnce, 1)
    next.clampWhenFinished = true
    next.setEffectiveTimeScale(idlePlaybackScale)
    if (current && current !== next) {
      next.reset().play()
      current.crossFadeTo(next, crossFadeDur, false)
      current = next
    } else if (current === next) {
      if (!current.isRunning() || current.time >= clip.duration - 1e-4) {
        next.reset().play()
      }
    } else {
      next.reset().play()
      current = next
    }
  }

  function playIdleAlternationOrIdleLoop(): void {
    if (useIdleAlternation) {
      const clip = idleAlternationClips[idleAltIndex % idleAlternationClips.length]
      if (current?.getClip() === clip && current.isRunning()) return
      playIdleAlternationAt(idleAltIndex, 1, fade)
      return
    }
    if (byIdle) {
      playClip(byIdle, true, 1, idlePlaybackScale, fade)
      return
    }
    if (legacyIdleClip) {
      playClip(legacyIdleClip, true, 1, idlePlaybackScale, fade)
    }
  }

  function playLocomotion(s: ImportedGlbAnimCombatSnapshot): void {
    const speed = Math.abs(s.velX)
    if (s.grounded && speed > s.walkSpeedRef * 0.78 && byRun) {
      idleAltIndex = 0
      playClip(byRun, true, 1, 1, fade)
      return
    }
    if (s.grounded && speed > s.walkSpeedRef * 0.22 && byWalk) {
      idleAltIndex = 0
      playClip(byWalk, true, 1, 1, fade)
      return
    }
    if (useSlowWalkAsIdle && byWalk) {
      idleAltIndex = 0
      playClip(byWalk, true, 1, 0.14, fade)
      return
    }
    playIdleAlternationOrIdleLoop()
  }

  function attackTimeScale(clip: AnimationClip, s: ImportedGlbAnimCombatSnapshot): number {
    const window = s.attackCycleDuration
    const atkKind = s.attackKind
    const kindMul =
      atkKind && options?.attackPlaybackScaleByKind?.[atkKind] != null
        ? options.attackPlaybackScaleByKind[atkKind]!
        : 1
    if (!window || window < 1e-3) return kindMul
    const r = clip.duration / window
    return Math.max(0.5, Math.min(2.75, r * kindMul))
  }

  function winTimeScale(clip: AnimationClip, s: ImportedGlbAnimCombatSnapshot): number {
    const maxT = Math.max(s.roundWinPresentationMaxT, 1e-4)
    const raw = clip.duration / maxT
    return Math.max(0.85, Math.min(2.35, raw))
  }

  function clipForAttackKind(kind: AttackKind): AnimationClip | undefined {
    const strictKindMap = options?.strictAttackClipByKind === true
    if (kind === 'heavy') return strictKindMap ? byHeavy : byHeavy ?? bySpecial
    if (kind === 'special') return strictKindMap ? bySpecial : bySpecial ?? byHeavy
    return byLight ?? byHeavy
  }

  function tryBlendLocomotionAfterAttackClip(): void {
    const s = lastSnapshot
    if (!s || s.defeated || s.attackPhase === 'idle' || !s.attackKind) return
    if (blendedLocomotionDuringAttack) return
    if (!current || current.loop) return
    const clip = current.getClip()
    if (clip !== byLight && clip !== byHeavy && clip !== bySpecial) return
    const dur = clip.duration
    if (dur < 1e-4) return
    if (current.time < dur - 0.05) return

    blendedLocomotionDuringAttack = true
    playLocomotion(s)
  }

  function readCombatAnimDebug(): ImportedGlbCombatAnimDebugRow | null {
    if (!current || !lastSnapshot) return null
    if (lastSnapshot.attackPhase === 'idle' || !lastSnapshot.attackKind) return null
    const expected = clipForAttackKind(lastSnapshot.attackKind)
    if (!expected || current.getClip() !== expected) return null
    const clip = current.getClip()
    return {
      clipName: clip.name,
      clipDuration: clip.duration,
      clipTime: current.time,
      effectiveTimeScale: current.getEffectiveTimeScale(),
    }
  }

  mixer.addEventListener('finished', (e: { action?: AnimationAction }) => {
    const a = e.action
    if (!a) return
    const c = a.getClip()
    if (
      useIdleAlternation &&
      idleAlternationClips.includes(c) &&
      lastSnapshot &&
      locomotionIdleStationary(lastSnapshot)
    ) {
      idleAltIndex = (idleAltIndex + 1) % idleAlternationClips.length
      playIdleAlternationAt(idleAltIndex, 1, fade)
      return
    }
    if (c !== byLight && c !== byHeavy && c !== bySpecial) return
    if (lastSnapshot && lastSnapshot.attackPhase !== 'idle') {
      blendedLocomotionDuringAttack = true
      playLocomotion(lastSnapshot)
    }
  })

  function rescanAnimationClips(): void {
    refreshClipBindings()
    if (lastSnapshot) {
      syncFromState(lastSnapshot)
    }
  }

  function syncFromState(s: ImportedGlbAnimCombatSnapshot): void {
      const prevSnapshot = lastSnapshot
      lastSnapshot = s

      if (s.attackPhase === 'idle') {
        blendedLocomotionDuringAttack = false
      }

      if (s.defeated) {
        if (byKo) playClip(byKo, false, 1, 1, fadeAttack)
        else if (useIdleAlternation && idleAlternationClips[0])
          playClip(idleAlternationClips[0], true, 0.35, idlePlaybackScale, fade)
        else if (byIdle) playClip(byIdle, true, 0.35, idlePlaybackScale, fade)
        else if (useSlowWalkAsIdle && byWalk) playClip(byWalk, true, 0.35, 0.08, fade)
        else if (legacyIdleClip) playClip(legacyIdleClip, true, 0.35, idlePlaybackScale, fade)
        else {
          mixer.stopAllAction()
          current = null
        }
        return
      }
      if (s.roundWinPresentationT > 0 && byWin) {
        playClip(byWin, false, 1, winTimeScale(byWin, s), fadeAttack)
        return
      }
      if (s.receiveHitT > 0 && byHurt) {
        playClip(byHurt, false, 1, 1, fadeAttack)
        return
      }
      if (s.blocking && byBlock) {
        playClip(byBlock, true, 1, 1, fadeAttack)
        return
      }
      if (s.attackPhase !== 'idle' && s.attackKind) {
        if (blendedLocomotionDuringAttack) {
          playLocomotion(s)
          return
        }

        const atk = clipForAttackKind(s.attackKind)
        if (atk) {
          const ts = attackTimeScale(atk, s)
          const attackStartupEdge =
            s.attackPhase === 'startup' &&
            (!prevSnapshot ||
              prevSnapshot.attackPhase === 'idle' ||
              prevSnapshot.attackKind !== s.attackKind)
          playClip(
            atk,
            false,
            1,
            ts,
            fadeAttack,
            !!options?.restartAttackClipOnStartup && attackStartupEdge,
          )
          return
        }
      }

      const speed = Math.abs(s.velX)
      if (s.grounded && speed > s.walkSpeedRef * 0.78 && byRun) {
        idleAltIndex = 0
        playClip(byRun, true, 1, 1, fade)
        return
      }
      if (s.grounded && speed > s.walkSpeedRef * 0.22 && byWalk) {
        idleAltIndex = 0
        playClip(byWalk, true, 1, 1, fade)
        return
      }
      if (useSlowWalkAsIdle && byWalk) {
        idleAltIndex = 0
        playClip(byWalk, true, 1, 0.14, fade)
        return
      }
      playIdleAlternationOrIdleLoop()
      if (current) return
      mixer.stopAllAction()
      current = null
  }

  return {
    usesSkeletonClips: true,
    get hasLightClip() {
      return clipFlags.hasLightClip
    },
    get hasHeavyClip() {
      return clipFlags.hasHeavyClip
    },
    get hasSpecialClip() {
      return clipFlags.hasSpecialClip
    },
    get hasHurtClip() {
      return clipFlags.hasHurtClip
    },
    get hasKoClip() {
      return clipFlags.hasKoClip
    },
    get hasWinClip() {
      return clipFlags.hasWinClip
    },
    attackKindUsesClip(kind: AttackKind): boolean {
      return !!clipForAttackKind(kind)
    },
    readCombatAnimDebug,
    syncFromState,
    rescanAnimationClips,
    updateMixer(dt: number): void {
      mixer.update(dt)
      tryBlendLocomotionAfterAttackClip()
    },
    resetPose(): void {
      lastSnapshot = null
      blendedLocomotionDuringAttack = false
      idleAltIndex = 0
      mixer.stopAllAction()
      current = null
    },
    dispose(): void {
      mixer.stopAllAction()
      mixer.uncacheRoot(root)
    },
  }
}
