import type { AnimationClip } from 'three'
import type { Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { collectAnimDebugInfo, logAnimDebug, logGltfDebug } from './gltfInspect'
import {
  loadGlbCharacterTemplate,
  loadTaggedAnimationClips,
  mergeTaggedClips,
} from './glbFighterPipeline'
import {
  getAllRequiredRosterGlbUrls,
  ROSTER_GLB_FIGHTER_IDS,
  type RosterGlbFighterId,
  ROSTER_GLB_STAGE_MANIFEST,
} from './rosterGlbStageManifest'

type CacheEntry = {
  template: Object3D | null
  clips: AnimationClip[]
  loadedUrls: Set<string>
  bootDone: boolean
  combatDone: boolean
  roundEndDone: boolean
  bootPromise: Promise<boolean> | null
  combatPromise: Promise<boolean> | null
  roundEndPromise: Promise<boolean> | null
}

function emptyEntry(): CacheEntry {
  return {
    template: null,
    clips: [],
    loadedUrls: new Set(),
    bootDone: false,
    combatDone: false,
    roundEndDone: false,
    bootPromise: null,
    combatPromise: null,
    roundEndPromise: null,
  }
}

const cache = new Map<RosterGlbFighterId, CacheEntry>()
let runtimeGlbUrlProbeDone = false

for (const id of ROSTER_GLB_FIGHTER_IDS) {
  cache.set(id, emptyEntry())
}

function getEntry(id: RosterGlbFighterId): CacheEntry {
  return cache.get(id) ?? emptyEntry()
}

function markUrlsLoaded(e: CacheEntry, urls: readonly string[]): void {
  for (const u of urls) e.loadedUrls.add(u)
}

function appendClips(e: CacheEntry, clips: readonly AnimationClip[]): void {
  e.clips.push(...clips)
}

async function loadUrlListIfNeeded(
  e: CacheEntry,
  items: readonly { url: string; prefix: string }[],
): Promise<AnimationClip[]> {
  const pending = items.filter((it) => !e.loadedUrls.has(it.url))
  if (!pending.length && items.length > 0) {
    console.info('[assets] already loaded:', items.map((i) => i.url).join(', '))
    return []
  }
  const clips = await loadTaggedAnimationClips(pending)
  markUrlsLoaded(
    e,
    pending.map((p) => p.url),
  )
  return clips
}

export async function probeRequiredRosterGlbUrls(): Promise<string[]> {
  if (runtimeGlbUrlProbeDone) return []
  runtimeGlbUrlProbeDone = true
  const urls = getAllRequiredRosterGlbUrls()
  const missing: string[] = []
  await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetch(url, { method: 'HEAD' })
        if (!res.ok) missing.push(url)
      } catch {
        missing.push(url)
      }
    }),
  )
  if (missing.length) {
    console.error('[assets] missing GLB files (fallback placeholders will be used)', missing)
  } else {
    console.info('[assets] all required GLB files reachable', { count: urls.length })
  }
  return missing
}

export function getRosterGlbTemplate(id: RosterGlbFighterId): Object3D | null {
  return getEntry(id).template
}

/** Live array; staged loaders append in place (drivers use {@link rescanAnimationClips}). */
export function getRosterGlbClipArray(id: RosterGlbFighterId): AnimationClip[] {
  return getEntry(id).clips
}

/**
 * Stage 1: rig + embedded clips + idle GLB only.
 */
export async function preloadRosterGlbBoot(id: RosterGlbFighterId): Promise<boolean> {
  const e = getEntry(id)
  if (e.bootDone) return !!e.template
  if (e.bootPromise) return e.bootPromise

  e.bootPromise = (async (): Promise<boolean> => {
    const m = ROSTER_GLB_STAGE_MANIFEST[id]
    const charRes = await loadGlbCharacterTemplate(m.character)
    if (!charRes.gltf) {
      console.warn(`[assets] fighter=${id} failed to load character template ${m.character}`)
      e.template = null
      e.clips.length = 0
      e.bootDone = true
      return false
    }
    e.template = charRes.gltf.scene
    markUrlsLoaded(e, [m.character])
    for (const c of charRes.gltf.animations) {
      e.clips.push(c.clone())
    }
    logGltfDebug(charRes.gltf, id)

    const bootExtra = await loadUrlListIfNeeded(e, m.bootTagged)
    appendClips(e, bootExtra)

    logAnimDebug(
      id,
      collectAnimDebugInfo(charRes.gltf, e.clips.map((c) => c.name || '(unnamed clip)')),
    )
    console.info(`[assets] roster boot clips fighter=${id} count=${e.clips.length}`)
    e.bootDone = true
    return true
  })()

  try {
    return await e.bootPromise
  } finally {
    e.bootPromise = null
  }
}

/**
 * Stage 2: walk/run + combat clips (no KO / win).
 */
export async function preloadRosterGlbCombat(id: RosterGlbFighterId): Promise<boolean> {
  const e = getEntry(id)
  if (!e.bootDone) {
    const ok = await preloadRosterGlbBoot(id)
    if (!ok && !e.template) return false
  }
  if (e.combatDone) return true
  if (e.combatPromise) return e.combatPromise

  e.combatPromise = (async (): Promise<boolean> => {
    const m = ROSTER_GLB_STAGE_MANIFEST[id]
    const { walk, run } = m.combatWalkRun
    const gltfLoader = new GLTFLoader()
    const extraClips: AnimationClip[] = []

    if (!e.loadedUrls.has(walk)) {
      const w = await gltfLoader.loadAsync(walk).catch(() => null)
      if (w) {
        markUrlsLoaded(e, [walk])
        extraClips.push(...mergeTaggedClips(w, 'walk'))
      } else {
        console.warn(`[assets] fighter=${id} missing walk GLB: ${walk}`)
      }
    }
    if (!e.loadedUrls.has(run)) {
      const r = await gltfLoader.loadAsync(run).catch(() => null)
      if (r) {
        markUrlsLoaded(e, [run])
        extraClips.push(...mergeTaggedClips(r, 'run'))
      } else {
        console.warn(`[assets] fighter=${id} missing run GLB: ${run}`)
      }
    }

    const tagged = await loadUrlListIfNeeded(e, m.combatTagged)
    appendClips(e, extraClips)
    appendClips(e, tagged)

    console.info(`[assets] roster combat clips fighter=${id} totalClips=${e.clips.length}`)
    e.combatDone = true
    return true
  })()

  try {
    return await e.combatPromise
  } finally {
    e.combatPromise = null
  }
}

/**
 * Stage 3: KO + win for one roster fighter.
 */
export async function preloadRosterGlbRoundEnd(id: RosterGlbFighterId): Promise<boolean> {
  const e = getEntry(id)
  if (!e.combatDone) {
    await preloadRosterGlbCombat(id)
  }
  if (e.roundEndDone) return true
  if (e.roundEndPromise) return e.roundEndPromise

  e.roundEndPromise = (async (): Promise<boolean> => {
    const m = ROSTER_GLB_STAGE_MANIFEST[id]
    const tagged = await loadUrlListIfNeeded(e, m.roundEndTagged)
    appendClips(e, tagged)
    console.info(`[assets] roster round-end clips fighter=${id} totalClips=${e.clips.length}`)
    e.roundEndDone = true
    return true
  })()

  try {
    return await e.roundEndPromise
  } finally {
    e.roundEndPromise = null
  }
}

export async function preloadAllRosterGlbBoot(): Promise<void> {
  await Promise.all(ROSTER_GLB_FIGHTER_IDS.map((id) => preloadRosterGlbBoot(id)))
}

export async function preloadAllRosterGlbCombat(): Promise<void> {
  await Promise.all(ROSTER_GLB_FIGHTER_IDS.map((id) => preloadRosterGlbCombat(id)))
}

export { isRosterGlbFighterId, ROSTER_GLB_FIGHTER_IDS, type RosterGlbFighterId } from './rosterGlbStageManifest'
