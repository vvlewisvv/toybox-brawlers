/**
 * Standard rigged fighter GLB pipeline.
 *
 * **Asset expectations** (Meshy / similar exports):
 * - Feet near world origin / ground; forward = +Z or consistent with existing roster after optional yaw override.
 * - Skinned hierarchy under one scene root; bind pose in character GLB, locomotion in optional extra GLBs.
 * - Similar native scale across characters (normalize visible mesh height to `REFERENCE_VISUAL_HEIGHT` × `MODEL_RELATIVE_SCALE`).
 *
 * **Per-fighter wiring**: add `*GlbMesh.ts` with URL bundle + `preload*Glb` / `create*GlbMesh` calling {@link loadGlbFighterBundle} and {@link createRiggedGlbFighterMesh}.
 * **Tuning**: roster height = `MODEL_RELATIVE_SCALE`; facing / foot Y = `GLB_FIGHTER_IMPORT_OVERRIDES` in `glbFighterImportConfig.ts`.
 */
import { AnimationClip, Group } from 'three'
import type { Object3D } from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'
import { getGlbFighterImportOverrides } from '../gameplay/character/glbFighterImportConfig'
import {
  applyStandardGlbHolderSizing,
  pickTorsoMesh,
  tryPresentationRigFromGlbBones,
  upgradeToPhysicalForCombat,
} from './glbFighterShared'
import type { ImportedGlbAnimationHandle } from './importedGlbAnimation'
import {
  createImportedGlbAnimationDriver,
  pickAnimationClipByNamePatterns,
  type ImportedGlbAnimationOptions,
} from './importedGlbAnimation'
import { createFighterVisualsRoot, type PlaceholderFighterMesh } from './placeholderFighterMesh'

const P = '[GLB_IMPORT]'

export type GlbFighterUrlBundle = {
  character: string
  walk?: string
  run?: string
  special?: string
  idleBreath?: string
  idleLook?: string
  /** Extra split GLBs: clips merged with `prefix_` for fuzzy matching in the anim driver. */
  extra?: readonly { url: string; prefix: string }[]
}

export function mergeTaggedClips(source: GLTF, prefix: string): AnimationClip[] {
  return source.animations.map((c) => {
    const cl = c.clone()
    cl.name = `${prefix}_${c.name || 'clip'}`
    return cl
  })
}

export type LoadGlbFighterBundleResult = {
  ok: boolean
  gltf: GLTF | null
  mergedAnimations: AnimationClip[]
  error?: unknown
}

/** Load split GLBs and merge clips with {@link mergeTaggedClips} (for staged roster loading). */
export async function loadTaggedAnimationClips(
  items: readonly { url: string; prefix: string }[],
): Promise<AnimationClip[]> {
  const loader = new GLTFLoader()
  const out: AnimationClip[] = []
  const gltfs = await Promise.all(items.map((e) => loader.loadAsync(e.url).catch(() => null)))
  for (let i = 0; i < items.length; i++) {
    const g = gltfs[i]
    if (g) out.push(...mergeTaggedClips(g, items[i]!.prefix))
  }
  return out
}

/** Base character GLB only (rig + embedded clips, often bind pose). */
export async function loadGlbCharacterTemplate(
  characterUrl: string,
): Promise<{ gltf: GLTF | null; error?: unknown }> {
  const loader = new GLTFLoader()
  try {
    const gltf = await loader.loadAsync(characterUrl)
    return { gltf }
  } catch (err) {
    console.warn(`${P} character template load failed url=${characterUrl}`, err)
    return { gltf: null, error: err }
  }
}

/**
 * Load character GLB plus optional split animation files; merge clips with stable name prefixes.
 */
export async function loadGlbFighterBundle(
  fighterId: string,
  urls: GlbFighterUrlBundle,
): Promise<LoadGlbFighterBundleResult> {
  const loader = new GLTFLoader()
  try {
    const extra = urls.extra ?? []
    const [char, walk, run, special, breath, look, ...extraGltfs] = await Promise.all([
      loader.loadAsync(urls.character),
      urls.walk ? loader.loadAsync(urls.walk).catch(() => null) : Promise.resolve(null),
      urls.run ? loader.loadAsync(urls.run).catch(() => null) : Promise.resolve(null),
      urls.special ? loader.loadAsync(urls.special).catch(() => null) : Promise.resolve(null),
      urls.idleBreath ? loader.loadAsync(urls.idleBreath).catch(() => null) : Promise.resolve(null),
      urls.idleLook ? loader.loadAsync(urls.idleLook).catch(() => null) : Promise.resolve(null),
      ...extra.map((e) => loader.loadAsync(e.url).catch(() => null)),
    ])

    const clips: AnimationClip[] = []
    for (const c of char.animations) clips.push(c.clone())
    if (walk) clips.push(...mergeTaggedClips(walk, 'walk'))
    if (run) clips.push(...mergeTaggedClips(run, 'run'))
    if (special) clips.push(...mergeTaggedClips(special, 'special'))
    if (breath) clips.push(...mergeTaggedClips(breath, 'idle_breath'))
    if (look) clips.push(...mergeTaggedClips(look, 'idle_look'))
    extra.forEach((e, i) => {
      const g = extraGltfs[i]
      if (g) clips.push(...mergeTaggedClips(g, e.prefix))
    })

    return { ok: true, gltf: char, mergedAnimations: clips }
  } catch (err) {
    console.warn(`${P} fighter=${fighterId} preload=failed`, err)
    return { ok: false, gltf: null, mergedAnimations: [], error: err }
  }
}

/** Shared Meshy-style idle alternation (long breath + look around) when those clips exist. */
export function buildIdleAlternationClips(merged: AnimationClip[]): AnimationClip[] {
  const breath = pickAnimationClipByNamePatterns(merged, [
    'longbreath',
    'long_breath',
    'deepbreath',
    'breathing',
    'breathidle',
    'idle_breath',
    'breath',
  ])
  const look = pickAnimationClipByNamePatterns(merged, [
    'lookaround',
    'look_around',
    'lookround',
    'headlook',
    'survey',
    'glance',
    'idle_look',
  ])
  const out: AnimationClip[] = []
  if (breath) out.push(breath)
  if (look) out.push(look)
  return out
}

export function logGlbImportSummary(opts: {
  fighterId: string
  holderName: string
  gltfRootName: string
  rawHeight: number
  finalScale: number
  rotationOffsetRad: number
  modelYOffset: number
  hasAnimations: boolean
  clipCount: number
}): void {
  console.info(`${P} fighter=${opts.fighterId}`)
  console.info(`${P} rootNode=${opts.holderName}`)
  console.info(`${P} gltfSceneRoot=${opts.gltfRootName}`)
  console.info(`${P} rawHeight=${opts.rawHeight.toFixed(6)}`)
  console.info(`${P} finalScale=${opts.finalScale.toFixed(6)}`)
  console.info(`${P} rotationOffset=${opts.rotationOffsetRad.toFixed(6)}rad`)
  console.info(`${P} modelYOffset=${opts.modelYOffset.toFixed(6)}`)
  console.info(`${P} hasAnimations=${opts.hasAnimations}`)
  console.info(`${P} clipCount=${opts.clipCount}`)
}

export type CreateRiggedGlbFighterMeshOpts = {
  fighterId: string
  holderName: string
  templateScene: Object3D
  mergedAnimations: AnimationClip[]
  combatBodyProxyName: string
  /** When true, uses {@link buildIdleAlternationClips} for optional two-clip standing cycle. */
  useIdleAlternation: boolean
  /** Roster staged loading: animation driver keeps mixer while clip list grows. */
  stagedGlbLoading?: boolean
  extraAnimOptions?: ImportedGlbAnimationOptions
  /** When set, skips the default fuzzy clip driver (e.g. Bibi state machine). */
  createAnimationHandle?: (
    cloned: Object3D,
    mergedAnimations: readonly AnimationClip[],
    fighterId: string,
  ) => ImportedGlbAnimationHandle
}

/**
 * Standard rigged GLB → {@link PlaceholderFighterMesh}: clone, holder, normalize scale, ground, mixer, rig fallback.
 * Caller must return procedural mesh when `templateScene` is null.
 */
export function createRiggedGlbFighterMesh(opts: CreateRiggedGlbFighterMeshOpts): PlaceholderFighterMesh {
  const cloned = cloneSkinned(opts.templateScene)
  const { root, visuals } = createFighterVisualsRoot()

  const holder = new Group()
  holder.name = opts.holderName
  holder.add(cloned)

  const sizing = applyStandardGlbHolderSizing(holder, opts.fighterId)
  visuals.add(holder)

  const body = pickTorsoMesh(cloned, opts.combatBodyProxyName)
  upgradeToPhysicalForCombat(body)

  const importedGlbAnim = opts.createAnimationHandle
    ? opts.createAnimationHandle(cloned, opts.mergedAnimations, opts.fighterId)
    : (() => {
        const idleAlt = opts.useIdleAlternation
          ? buildIdleAlternationClips(opts.mergedAnimations)
          : []
        const animOptions: ImportedGlbAnimationOptions | undefined =
          opts.extraAnimOptions ??
          (idleAlt.length ? { idleAlternationClips: idleAlt } : undefined)
        return createImportedGlbAnimationDriver(cloned, opts.mergedAnimations, opts.fighterId, {
          ...animOptions,
          stagedLoading: opts.stagedGlbLoading ?? animOptions?.stagedLoading,
        })
      })()
  const rig =
    !importedGlbAnim.usesSkeletonClips ? tryPresentationRigFromGlbBones(cloned) : undefined

  const imp = getGlbFighterImportOverrides(opts.fighterId)
  logGlbImportSummary({
    fighterId: opts.fighterId,
    holderName: opts.holderName,
    gltfRootName: cloned.name || '(unnamed)',
    rawHeight: sizing.intrinsicY,
    finalScale: sizing.scale,
    rotationOffsetRad: imp.visualYawOffsetRad ?? 0,
    modelYOffset: imp.modelYOffset ?? 0,
    hasAnimations: opts.mergedAnimations.length > 0,
    clipCount: opts.mergedAnimations.length,
  })

  return {
    root,
    visuals,
    body,
    standHalfHeight: sizing.standHalfHeight,
    rig,
    proceduralMotionRoot: holder,
    proceduralMotionRootBaseY: sizing.proceduralMotionRootBaseY,
    importedGlbAnim,
  }
}
