import './style.css'
import {
  ensureMatchGlbAssetsReady,
  loadBootAssets,
  loadCharacterSelectAssets,
  setActiveFightersForAssetPipeline,
} from './assets/gameAssetPipeline'
import { gameMusic } from './audio/gameMusic'
import { gameSfx } from './audio/gameSfx'
import {
  COMBAT_TEST_BOT_ALLOW_RUNTIME_TOGGLE,
  computeFighterCollisionVolumes,
  createCombatTestBotFrameSource,
  createFighter,
  DEFAULT_ROSTER_TEST_P1_ID,
  DEFAULT_ROSTER_TEST_P2_ID,
  getRosterTestDefinition,
  isCombatTestBotActive,
  resolvePushboxPair,
  resolveStrike,
  rosterEntriesToSelectPresenters,
  ROSTER_TEST_ENTRIES,
  toggleCombatTestBotRuntime,
  initArcadeBotDebugFromUrl,
  type PlaceholderFighter,
} from './gameplay'
import {
  initAttackTimingDebugFromUrl,
  updateAttackTimingDebugOverlay,
} from './gameplay/combat/attackTimingDebug'
import {
  createKeyboardInput,
  createMobileTouchInput,
  EMPTY_FRAME_SNAPSHOT,
  readMoveAxis,
  type FrameSnapshot,
  type InputAction,
} from './input'
import { getViolenceMode, subscribeViolenceMode } from './presentation'
import { CollisionDebugRenderer } from './rendering/collisionDebugRenderer'
import { HitFeelController } from './rendering/hitFeel'
import { warmupRosterGpuOnce } from './rendering/rosterGpuWarmup'
import { startMinimalStage, TOYBOX_FIGHT_LOOK_AT } from './scenes'
import {
  mountAppShell,
  mountCombatMatchHud,
  mountMainMenu,
  mountOnlineLobby,
  type AppFlowMode,
  type MatchHudController,
  type OnlineCharacterSelectApi,
  type OnlineLobbyMount,
  wireOnlineCharacterSelect,
  wireMusicSettings,
  wireSfxSettings,
  wireViolenceModeSettings,
  wireVsBotCharacterSelect,
  type VsBotCharacterSelectApi,
} from './ui'
import {
  ONLINE_SIM_DT,
  type MatchSyncPayload,
  type SyncedMatchPhase,
} from './net/onlineSession'

const root = document.getElementById('app')
if (!root) {
  throw new Error('#app missing')
}

initAttackTimingDebugFromUrl()
initArcadeBotDebugFromUrl()

const {
  canvas,
  overlay,
  mobileRotateOverlay,
  matchHudMount,
  screenPunch,
  koMoment,
  pauseMenuRoot,
  matchEndRoot,
} = mountAppShell(root)

let rotateOverlayBlockingGameplay = false

function syncMobileOrientationGate(): void {
  const isTouchMobile =
    window.matchMedia('(pointer: coarse)').matches &&
    window.matchMedia('(hover: none)').matches
  const isPortrait = window.innerHeight > window.innerWidth
  const mobilePortraitBlocked = isTouchMobile && isPortrait
  rotateOverlayBlockingGameplay = mobilePortraitBlocked
  mobileRotateOverlay.hidden = !mobilePortraitBlocked
  mobileRotateOverlay.classList.toggle('mobile-rotate-overlay--open', mobilePortraitBlocked)
  mobileRotateOverlay.setAttribute('aria-hidden', mobilePortraitBlocked ? 'false' : 'true')
}

const KO_ROUND_DRAMA_SEC = 2.35
let koRoundHaltTimer = 0
let koPendingRoundResult: 'p1' | 'p2' | null = null
let koOverlayHideAt = 0

function showKoMomentOverlay(): void {
  gameSfx.playKo()
  koMoment.hidden = false
  koMoment.removeAttribute('hidden')
  koMoment.setAttribute('aria-hidden', 'false')
  void koMoment.offsetWidth
  koMoment.classList.add('ko-moment--visible')
}

function hideKoMomentOverlay(): void {
  koMoment.classList.remove('ko-moment--visible')
  koMoment.setAttribute('aria-hidden', 'true')
  koMoment.hidden = true
}

screenPunch.dataset.violenceMode = getViolenceMode()
subscribeViolenceMode((mode) => {
  screenPunch.dataset.violenceMode = mode
})

let matchHudCtrl: MatchHudController | undefined
let unmountMatchHud: (() => void) | undefined
const matchEndSubEl = matchEndRoot.querySelector<HTMLElement>('#match-end-sub')
if (!matchEndSubEl) {
  throw new Error('#match-end-sub missing')
}
const matchEndSub: HTMLElement = matchEndSubEl
const matchEndRematchHint = matchEndRoot.querySelector<HTMLElement>(
  '[data-match-end-rematch-hint]',
)
const matchPlayAgainBtn = matchEndRoot.querySelector<HTMLButtonElement>(
  '[data-match-play-again]',
)
const matchOnlineLeaveBtn = matchEndRoot.querySelector<HTMLButtonElement>(
  '[data-match-online-leave]',
)
const matchCancelRematchBtn = matchEndRoot.querySelector<HTMLButtonElement>(
  '[data-online-rematch-cancel-vote]',
)

let onlineLobbyMount: OnlineLobbyMount | undefined
let onlineCharSelectApi: OnlineCharacterSelectApi | undefined

/** Set before `navigateTo('online-select')` when coming from post-match rematch. */
let pendingOnlineRematchCharSelect = false
/** Set before `navigateTo('vs-bot-select')` when coming from post-match rematch only. */
let pendingVsBotRematchCharSelect = false
let onlineRematchDeclineNavigateTimer: ReturnType<typeof setTimeout> | null = null

/** Host-only: coalesce identical `match_sync` payloads (was ~60 Hz during countdown). */
const ONLINE_MATCH_SYNC_COALESCE_MS = 120
let lastOnlineMatchSyncSerialized: string | null = null
let lastOnlineMatchSyncSentMs = 0
let onlineMatchSyncCoalesceModeLogged = false

function logOnlineDebug(tag: string, message: string, detail?: Record<string, unknown>): void {
  if (detail) {
    console.info(`[Plushdown:OnlineDebug] ${tag} · ${message}`, detail)
  } else {
    console.info(`[Plushdown:OnlineDebug] ${tag} · ${message}`)
  }
}

/** If this string never appears in the console, you are not running this bundle (stale tab or wrong server). */
const PLUSHDOWN_ONLINE_VERIFY_BUILD_ID = 'verify-2026-04-12-04'
console.info('[VERIFY_BUILD]', PLUSHDOWN_ONLINE_VERIFY_BUILD_ID)

/** Round length in seconds (tunable). */
const ROUND_DURATION_SEC = 99
const WINS_TO_MATCH = 2
const ROUND_BREAK_SEC = 2.25
/** Full seconds of 3 → 2 → 1 on screen; fighters reset at start (GPU / state warmup). */
const PRE_ROUND_COUNTDOWN_SEC = 3
const P1_START_X = -2.2
const P2_START_X = 2.2

type VsBotPhase = SyncedMatchPhase

/** Drives overlay visibility (vs internal `VsBotPhase` + `AppFlowMode`). */
type GameUiState =
  | 'main_menu'
  | 'character_select'
  | 'countdown'
  | 'in_match'
  | 'paused'
  | 'round_over'
  | 'match_over'

/** Combat HUD (health, timer, round/score line, banners, countdown digit). */
const MATCH_HUD_VISIBLE_STATES: ReadonlySet<GameUiState> = new Set([
  'countdown',
  'in_match',
  'round_over',
])

function shouldShowMatchHud(): boolean {
  return MATCH_HUD_VISIBLE_STATES.has(getGameUiState())
}

let roundTimeLeft = ROUND_DURATION_SEC
let p1Wins = 0
let p2Wins = 0
let vsBotPhase: VsBotPhase = 'fighting'
let roundBreakTimer = 0
let roundBanner: string | null = null
let countdownRemaining = 0
/** Log once when online fighting begins after countdown. */
let loggedOnlineMovementEnabled = false

let sfxPrevVsPhase: VsBotPhase = 'fighting'
let sfxLastCdInt = -1
let sfxFootAcc = 0

const SYNC_PHASES: ReadonlySet<SyncedMatchPhase> = new Set([
  'fighting',
  'round_break',
  'countdown',
  'match_done',
])

let flowMode: AppFlowMode = 'main'
/** Host-only: prevent duplicate `match_start` + double `beginOnlineMatchFromCharacterSelect`. */
let charSelectOnlineStartInProgress = false
let charSelectOnlineStartCompleted = false
/** Host: re-run start gate while on fighter select (covers ordering / missed microtasks). */
let charSelectHostGatePollTimer: ReturnType<typeof setInterval> | null = null
let matchPaused = false
let lastLoggedGameUiState: GameUiState | null = null
let lastLoggedSimActiveOnline: boolean | null = null
let lastLockstepStarveLogMs = 0
let loggedOnlineControlBootstrap = false
let lastOnlineControlMoveLogMs = 0
let lastOnlineControlAttackLogMs = 0

const ONLINE_ATTACK_EDGE: ReadonlySet<InputAction> = new Set([
  'light',
  'heavy',
  'special',
  'jump',
])

function pressedHasCombatEdge(pressed: ReadonlySet<InputAction>): boolean {
  for (const a of pressed) {
    if (ONLINE_ATTACK_EDGE.has(a)) return true
  }
  return false
}

/** Must exist before `mountMainMenu` — `onFlowChange('main')` calls `resetFightersForRound()` synchronously. */
let playerFighter: PlaceholderFighter | undefined
let botFighter: PlaceholderFighter | undefined

/** Roster picks (character select + dev dropdown); each id maps to a full `CharacterDefinition`. */
let rosterTestP1Id = DEFAULT_ROSTER_TEST_P1_ID
let rosterTestP2Id = DEFAULT_ROSTER_TEST_P2_ID

let vsBotCharSelectApi: VsBotCharacterSelectApi | undefined

/** Prevents stacking async `enterRoundCountdown` calls from the round-break timer. */
let roundCountdownEnterInFlight = false

/** While true, `countdownRemaining` does not tick (waiting on staged GLB pipeline). */
let countdownHoldForAssets = false

/** Previous frame’s pre-round lock (for edge-triggered idle snap + input-edge clear). */
let prevPreRoundControlsLocked = false

setActiveFightersForAssetPipeline(() => [playerFighter, botFighter])

const keyboard = createKeyboardInput({ preventBrowserDefaults: false })
const mobileTouch = createMobileTouchInput()

keyboard.attach()
mobileTouch.attach(root)
syncMobileOrientationGate()
window.addEventListener('resize', syncMobileOrientationGate, { passive: true })
window.addEventListener('orientationchange', syncMobileOrientationGate)

function mergeSnapshots(a: FrameSnapshot, b: FrameSnapshot): FrameSnapshot {
  return {
    held: new Set([...a.held, ...b.held]),
    pressed: new Set([...a.pressed, ...b.pressed]),
    released: new Set([...a.released, ...b.released]),
  }
}

/** Factories for background GPU warmup on character select (meshes disposed after compile). */
const rosterWarmupFactories = ROSTER_TEST_ENTRIES.map(
  (e) => () => e.definition.createMesh(),
)

function getGameUiState(): GameUiState {
  if (flowMode === 'vs-bot-select' || flowMode === 'online-select') return 'character_select'
  if (flowMode !== 'vs-bot-match' && flowMode !== 'online-match') {
    return 'main_menu'
  }
  if (matchPaused) return 'paused'
  if (vsBotPhase === 'match_done') return 'match_over'
  if (vsBotPhase === 'round_break') return 'round_over'
  if (vsBotPhase === 'countdown') return 'countdown'
  return 'in_match'
}

function logGameUiState(): void {
  const s = getGameUiState()
  if (s !== lastLoggedGameUiState) {
    console.info('[Plushdown:State]', lastLoggedGameUiState ?? '(init)', '→', s)
    const hudPhaseActive = MATCH_HUD_VISIBLE_STATES.has(s)
    console.info(
      '[Plushdown:HUD]',
      `phase=${hudPhaseActive ? 'active' : 'inactive'} mounted=${!!matchHudCtrl} state=${s}`,
    )
    if (s === 'main_menu') {
      console.info('[Plushdown:UI] main_menu · active layers', {
        canvas: true,
        uiOverlay: true,
        combatHudMounted: !!matchHudCtrl,
        pauseMenuVisible: !pauseMenuRoot.hidden,
        matchEndVisible: !matchEndRoot.hidden,
        flowMode,
      })
    }
    lastLoggedGameUiState = s
  }
}

/** Mount or unmount combat HUD DOM from `matchHudMount` — only valid states keep it in the document. */
function syncMatchHudLifecycle(): void {
  const want = shouldShowMatchHud()
  if (want && !matchHudCtrl) {
    const { controller, unmount } = mountCombatMatchHud(matchHudMount)
    matchHudCtrl = controller
    unmountMatchHud = unmount
    console.info('[Plushdown:HUD] mounted', { state: getGameUiState() })
  } else if (!want && matchHudCtrl) {
    unmountMatchHud?.()
    unmountMatchHud = undefined
    matchHudCtrl = undefined
    console.info('[Plushdown:HUD] unmounted', { state: getGameUiState() })
  }
}

function setFightersVisible(visible: boolean): void {
  if (playerFighter?.mesh?.root) playerFighter.mesh.root.visible = visible
  if (botFighter?.mesh?.root) botFighter.mesh.root.visible = visible
}

function syncOnlineMatchEndUi(): void {
  if (!matchPlayAgainBtn) return
  const onlineMatchOver = flowMode === 'online-match' && getGameUiState() === 'match_over'
  if (!onlineMatchOver) {
    matchPlayAgainBtn.textContent = 'Play again'
    if (matchOnlineLeaveBtn) matchOnlineLeaveBtn.hidden = true
    if (matchCancelRematchBtn) matchCancelRematchBtn.hidden = true
    if (matchEndRematchHint) {
      matchEndRematchHint.hidden = true
      matchEndRematchHint.textContent = ''
    }
    return
  }
  matchPlayAgainBtn.textContent = 'Rematch'
  if (matchOnlineLeaveBtn) matchOnlineLeaveBtn.hidden = false
  if (matchEndRematchHint) {
    matchEndRematchHint.hidden = false
    matchEndRematchHint.textContent =
      'Opens fighter select with the same matchup — both players must accept rematch to continue.'
  }
  if (matchCancelRematchBtn) {
    matchCancelRematchBtn.hidden = true
  }
}

function syncGameUiOverlays(): void {
  logGameUiState()
  const st = getGameUiState()
  const pauseOpen = st === 'paused'
  const matchEndOpen = st === 'match_over'

  pauseMenuRoot.hidden = !pauseOpen
  pauseMenuRoot.setAttribute('aria-hidden', pauseOpen ? 'false' : 'true')

  matchEndRoot.hidden = !matchEndOpen
  matchEndRoot.setAttribute('aria-hidden', matchEndOpen ? 'false' : 'true')
  matchEndSub.textContent = matchEndOpen ? (roundBanner ?? '') : ''
  if (matchEndOpen) {
    syncOnlineMatchEndUi()
  }

  overlay.classList.toggle('plushdown--online-match', flowMode === 'online-match')

  overlay
    .querySelectorAll<HTMLElement>('[data-menu-view="vs-bot-match"], [data-menu-view="online-match"]')
    .forEach((panel) => {
      panel.classList.toggle(
        'main-menu__panel--session-hidden',
        flowMode === 'vs-bot-match' || flowMode === 'online-match',
      )
    })
}

function roundLabelText(): string {
  if (vsBotPhase === 'match_done') return 'Match over'
  return `Round ${p1Wins + p2Wins + 1}`
}

/** Stops delayed `endVsBotRound` from firing after the player restarts (Play again / rematch). */
function cancelPendingKoRoundResolution(): void {
  koRoundHaltTimer = 0
  koPendingRoundResult = null
  koOverlayHideAt = 0
  hideKoMomentOverlay()
}

function resetFightersForRound(): void {
  cancelPendingKoRoundResolution()
  playerFighter?.resetForRound({ startX: P1_START_X })
  botFighter?.resetForRound({ startX: P2_START_X })
}

function buildOnlineMatchSync(opts?: { fightersReset?: boolean }): MatchSyncPayload {
  return {
    ph: vsBotPhase,
    p1: p1Wins,
    p2: p2Wins,
    rt: roundTimeLeft,
    cd: countdownRemaining,
    br: roundBreakTimer,
    bn: roundBanner,
    rz: opts?.fightersReset ? 1 : undefined,
  }
}

/**
 * @param throttleCoalesce - when true (host HUD tick), skip redundant sends; game events use immediate.
 */
function pushOnlineMatchSyncFromHost(
  opts?: { fightersReset?: boolean },
  throttleCoalesce = false,
): void {
  if (flowMode !== 'online-match' || !onlineLobbyMount?.session.isHost()) return
  const payload = buildOnlineMatchSync(opts)
  const now = performance.now()
  const serialized = JSON.stringify(payload)

  if (throttleCoalesce) {
    if (!onlineMatchSyncCoalesceModeLogged) {
      onlineMatchSyncCoalesceModeLogged = true
      logOnlineDebug('sync', `host periodic match_sync coalesced (min interval ${ONLINE_MATCH_SYNC_COALESCE_MS}ms)`)
    }
    if (serialized !== lastOnlineMatchSyncSerialized) {
      lastOnlineMatchSyncSerialized = serialized
      lastOnlineMatchSyncSentMs = now
      onlineLobbyMount.session.sendMatchSync(payload)
      return
    }
    if (now - lastOnlineMatchSyncSentMs < ONLINE_MATCH_SYNC_COALESCE_MS) return
    lastOnlineMatchSyncSentMs = now
    onlineLobbyMount.session.sendMatchSync(payload)
    return
  }

  lastOnlineMatchSyncSerialized = serialized
  lastOnlineMatchSyncSentMs = now
  onlineLobbyMount.session.sendMatchSync(payload)
}

/** Guest: mirror host round flow, scores, and timers (combat still lockstep). */
function applyOnlineMatchSync(p: MatchSyncPayload): void {
  if (!SYNC_PHASES.has(p.ph)) {
    console.warn('[MATCH_SYNC_RECV] FAIL reason=invalid_phase', { ph: p.ph, flowMode })
    return
  }
  if (
    flowMode === 'online-match' &&
    onlineLobbyMount?.session.getRole() === 'guest' &&
    p.ph === 'countdown' &&
    p.rz === 1
  ) {
    console.info('[COUNTDOWN_START] guest via match_sync', { cd: p.cd, rz: p.rz })
    console.info('[Plushdown:OnlineDebug] match · countdown start received (match_sync guest, rz)', {
      cd: p.cd,
    })
  }
  if (p.rz) {
    resetFightersForRound()
    hitFeel?.clearTransientEffects()
  }
  vsBotPhase = p.ph
  p1Wins = p.p1
  p2Wins = p.p2
  roundTimeLeft = p.rt
  countdownRemaining = p.cd
  roundBreakTimer = p.br
  roundBanner = p.bn
}

/**
 * Clears inter-round UI, resets fighters and round clock, then holds `PRE_ROUND_COUNTDOWN_SEC`
 * for scene frames + stable state before `fighting`.
 */
async function enterRoundCountdown(): Promise<void> {
  const onlineMatch = flowMode === 'online-match'

  /**
   * VS Bot: leave `match_done` / `round_break` UI immediately so Play again feels responsive.
   * Online: keep prior phase until GLBs + fighter reset — avoids host `match_sync` with stale fighters mid-load.
   */
  if (!onlineMatch) {
    countdownHoldForAssets = true
    vsBotPhase = 'countdown'
    countdownRemaining = PRE_ROUND_COUNTDOWN_SEC
    roundBreakTimer = 0
    roundBanner = null
    resetFightersForRound()
  } else {
    countdownHoldForAssets = true
  }

  try {
    console.info('[rematch] ensuring combat + round-end GLBs (pre-countdown gate)')
    await Promise.race([
      ensureMatchGlbAssetsReady([rosterTestP1Id, rosterTestP2Id]),
      new Promise<void>((resolve) => {
        setTimeout(() => {
          console.warn('[rematch] GLB gate timeout (12s) — continuing with fallbacks')
          resolve()
        }, 12_000)
      }),
    ])
  } catch (err) {
    console.warn('[assets] pre-round GLB ensure failed; match continues with fallbacks', err)
  }

  countdownHoldForAssets = false

  console.info('[COUNTDOWN_START]', {
    flowMode,
    role: onlineLobbyMount?.session.getRole() ?? null,
    preRoundSeconds: PRE_ROUND_COUNTDOWN_SEC,
  })
  console.info('[rematch] entering countdown · reset fighters + match_sync')
  loggedOnlineMovementEnabled = false
  matchPaused = false
  roundTimeLeft = ROUND_DURATION_SEC
  vsBotPhase = 'countdown'
  countdownRemaining = PRE_ROUND_COUNTDOWN_SEC
  roundBreakTimer = 0
  roundBanner = null
  resetFightersForRound()
  pushOnlineMatchSyncFromHost({ fightersReset: true })
  if (flowMode === 'online-match') {
    const role = onlineLobbyMount?.session.getRole() ?? null
    console.info('[Plushdown:OnlineDebug] match · countdown started (host push match_sync)', {
      role,
    })
  }
}

function resetOnlineCharacterSelectStartGuards(): void {
  charSelectOnlineStartInProgress = false
  charSelectOnlineStartCompleted = false
}

function stopOnlineCharSelectHostGatePoll(): void {
  if (charSelectHostGatePollTimer !== null) {
    clearInterval(charSelectHostGatePollTimer)
    charSelectHostGatePollTimer = null
  }
}

/** Host only: periodically re-run the start gate until match begins or flow leaves fighter select. */
function startOnlineCharSelectHostGatePoll(): void {
  stopOnlineCharSelectHostGatePoll()
  const tick = (): void => {
    if (flowMode !== 'online-select' || charSelectOnlineStartCompleted) {
      stopOnlineCharSelectHostGatePoll()
      return
    }
    const sess = onlineLobbyMount?.session
    if (!sess || sess.getRole() !== 'host') {
      stopOnlineCharSelectHostGatePoll()
      return
    }
    tryStartOnlineMatchFromCharacterSelect()
  }
  tick()
  charSelectHostGatePollTimer = setInterval(tick, 200)
}

/**
 * Single host-only entry: authoritative session gate + one `match_start` + local transition only after send succeeds.
 */
function tryStartOnlineMatchFromCharacterSelect(): void {
  console.info('[VERIFY_GATE] tryStartOnlineMatchFromCharacterSelect tick')
  const sess = onlineLobbyMount?.session
  const gate = sess?.getCharSelectGateDebug() ?? {
    connected: false,
    peerPresent: false,
    role: null,
    selfReadyFighter: null,
    peerReadyFighter: null,
    isHost: false,
  }
  const uiSel = onlineCharSelectApi?.getSelectionDebug()
  const localSelectedUiId = uiSel?.localConfirmedId ?? uiSel?.localPreviewId ?? null
  const peerSelectedUiId = uiSel?.remoteConfirmedId ?? uiSel?.remotePreviewId ?? null

  console.info('[CHARSEL_HOST_GATE] state', {
    role: gate.role,
    localReadyFighterId: gate.selfReadyFighter,
    peerReadyFighterId: gate.peerReadyFighter,
    localSelectedUiId,
    peerSelectedUiId,
    peerPresent: gate.peerPresent,
    isOpen: gate.connected,
    phase: vsBotPhase,
    flowMode,
  })

  if (charSelectOnlineStartCompleted) {
    console.info('[CHARSEL_HOST_GATE] FAIL reason=start_already_triggered', {
      variant: 'match_start_already_done',
    })
    return
  }
  if (charSelectOnlineStartInProgress) {
    console.info('[CHARSEL_HOST_GATE] FAIL reason=start_already_triggered', {
      variant: 'gate_reentrant_in_progress',
    })
    return
  }
  if (flowMode !== 'online-select') {
    console.info('[CHARSEL_HOST_GATE] FAIL reason=invalid_phase', {
      detail: 'flowMode_not_online_select',
      flowMode,
    })
    return
  }
  if (!sess) {
    console.info('[CHARSEL_HOST_GATE] FAIL reason=invalid_phase', {
      detail: 'no_online_lobby_mount_session',
      flowMode,
    })
    return
  }
  if (!gate.isHost) {
    console.info('[CHARSEL_HOST_GATE] FAIL reason=not_host', { role: gate.role })
    return
  }
  if (!gate.connected) {
    console.info('[CHARSEL_HOST_GATE] FAIL reason=session_not_open')
    return
  }
  if (!gate.peerPresent) {
    console.info('[CHARSEL_HOST_GATE] FAIL reason=peer_not_present')
    return
  }
  if (!gate.selfReadyFighter && !gate.peerReadyFighter) {
    console.info('[CHARSEL_HOST_GATE] FAIL reason=both_ready_ids_missing', {
      localReadyFighterId: gate.selfReadyFighter,
      peerReadyFighterId: gate.peerReadyFighter,
      localSelectedUiId,
      peerSelectedUiId,
    })
    return
  }
  if (!gate.selfReadyFighter) {
    console.info('[CHARSEL_HOST_GATE] FAIL reason=local_ready_id_missing', {
      localReadyFighterId: gate.selfReadyFighter,
      peerReadyFighterId: gate.peerReadyFighter,
      localSelectedUiId,
      peerSelectedUiId,
    })
    return
  }
  if (!gate.peerReadyFighter) {
    console.info('[CHARSEL_HOST_GATE] FAIL reason=peer_ready_id_missing', {
      localReadyFighterId: gate.selfReadyFighter,
      peerReadyFighterId: gate.peerReadyFighter,
      localSelectedUiId,
      peerSelectedUiId,
    })
    return
  }

  if (sess.isRematchCharacterSelectFlow() && !sess.bothRematchAccepted()) {
    console.info('[CHARSEL_HOST_GATE] FAIL reason=rematch_needs_mutual_accept', {
      rematch: sess.getRematchNegotiationDebug(),
    })
    return
  }

  const picks = sess.getCharSelectStartPicksIfHost()
  if (!picks) {
    console.info('[CHARSEL_HOST_GATE] FAIL reason=invalid_phase', {
      detail: 'picks_unresolved_after_ready_ids_present',
      localReadyFighterId: gate.selfReadyFighter,
      peerReadyFighterId: gate.peerReadyFighter,
    })
    return
  }

  console.info('[VERIFY_C] host_gate_pass', { ...picks, buildId: PLUSHDOWN_ONLINE_VERIFY_BUILD_ID })
  console.info('[CHARSEL_HOST_GATE] PASS', picks)

  charSelectOnlineStartInProgress = true
  try {
    const sent = sess.sendMatchStart(picks.hostCharId, picks.guestCharId)
    if (!sent) {
      console.warn('[SCENE_TRANSITION] FAIL reason=match_start_not_sent_host_stays_in_char_select')
      return
    }
    charSelectOnlineStartCompleted = true
    beginOnlineMatchFromCharacterSelect(picks.hostCharId, picks.guestCharId)
  } finally {
    charSelectOnlineStartInProgress = false
  }
}

function beginOnlineMatchFromCharacterSelect(hostCharId: string, guestCharId: string): void {
  if (onlineLobbyMount?.session.isRematchCharacterSelectFlow()) {
    console.info('[rematch] starting match')
  }
  console.info('[VERIFY_D] scene_transition_begin', {
    hostCharId,
    guestCharId,
    role: onlineLobbyMount?.session.getRole() ?? null,
    flowMode,
    buildId: PLUSHDOWN_ONLINE_VERIFY_BUILD_ID,
  })
  const role = onlineLobbyMount?.session.getRole() ?? null
  const phaseBefore = flowMode
  console.info('[SCENE_TRANSITION] beginOnlineMatchFromCharacterSelect', {
    hostCharId,
    guestCharId,
    role,
    flowModeBefore: phaseBefore,
  })
  onlineLobbyMount?.hideSearchingOverlay()
  rosterTestP1Id = hostCharId
  rosterTestP2Id = guestCharId
  syncRosterTestDropdowns()
  recreateFightersFromRosterIds()
  resetFightersForRound()
  setFightersVisible(false)
  mainMenu.navigateTo('online-match')
  console.info('[SCENE_TRANSITION] navigated', {
    flowMode,
    fighterSelectPanelHidden: flowMode === 'online-match',
  })
  beginFreshMatch()
  console.info('[GAME_INIT]', {
    rosterTestP1Id,
    rosterTestP2Id,
    role,
    movementEnabled: vsBotPhase === 'fighting',
    countdownRunning: vsBotPhase === 'countdown',
  })
}

function beginFreshMatch(): void {
  console.info('[rematch] resetting match state · beginFreshMatch', { flowMode })
  cancelPendingKoRoundResolution()
  roundCountdownEnterInFlight = false
  countdownHoldForAssets = false

  if (flowMode === 'online-match') {
    console.info('[GAME_INIT] beginFreshMatch online · prepareForNewOnlineMatch + lockstep + countdown')
    logOnlineDebug('rematch', 'beginFreshMatch (online) · handshake + lockstep + countdown')
    onlineLobbyMount?.session.prepareForNewOnlineMatch()
    matchPaused = false
    p1Wins = 0
    p2Wins = 0
    onlineLobbyMount?.session.resetLockstep()
    hitFeel?.resetFightCameraPose()
    void enterRoundCountdown().catch((e) => console.error('[Plushdown] enterRoundCountdown', e))
    return
  }
  matchPaused = false
  p1Wins = 0
  p2Wins = 0
  onlineLobbyMount?.session.resetLockstep()
  hitFeel?.resetFightCameraPose()
  void enterRoundCountdown().catch((e) => console.error('[Plushdown] enterRoundCountdown', e))
}

/** Dispose and spawn fighters from current `rosterTestP1Id` / `rosterTestP2Id` (no match / round reset). */
function recreateFightersFromRosterIds(): void {
  logOnlineDebug('spawn', 'recreateFightersFromRosterIds · disposing previous fighters')
  playerFighter?.dispose()
  botFighter?.dispose()
  playerFighter = undefined
  botFighter = undefined

  const d1 = getRosterTestDefinition(rosterTestP1Id)
  const d2 = getRosterTestDefinition(rosterTestP2Id)

  try {
    playerFighter = createFighter(stage.scene, {
      definition: d1,
      startX: P1_START_X,
    })
  } catch (err) {
    console.error('[Plushdown] Player fighter failed to initialize:', err)
  }

  try {
    botFighter = createFighter(stage.scene, {
      definition: d2,
      startX: P2_START_X,
    })
  } catch (err) {
    console.error('[Plushdown] Bot fighter failed to initialize:', err)
  }
  logOnlineDebug('spawn', 'fighter spawn completed', {
    p1: rosterTestP1Id,
    p2: rosterTestP2Id,
    hasP1: !!playerFighter,
    hasP2: !!botFighter,
  })
}

/** Dev dropdown + any caller: rebuild fighters and sync menu vs match presentation. */
function applyRosterTestSelection(): void {
  recreateFightersFromRosterIds()
  if (flowMode === 'vs-bot-match' || flowMode === 'online-match') {
    beginFreshMatch()
  } else {
    resetFightersForRound()
    setFightersVisible(false)
  }
}

function syncRosterTestDropdowns(): void {
  if (!root) return
  const p1Sel = root.querySelector<HTMLSelectElement>('#roster-test-p1')
  const p2Sel = root.querySelector<HTMLSelectElement>('#roster-test-p2')
  if (p1Sel && ROSTER_TEST_ENTRIES.some((e) => e.id === rosterTestP1Id)) {
    p1Sel.value = rosterTestP1Id
  }
  if (p2Sel && ROSTER_TEST_ENTRIES.some((e) => e.id === rosterTestP2Id)) {
    p2Sel.value = rosterTestP2Id
  }
}

function mountRosterTestPanel(host: HTMLElement): void {
  const p1Sel = host.querySelector<HTMLSelectElement>('#roster-test-p1')
  const p2Sel = host.querySelector<HTMLSelectElement>('#roster-test-p2')
  if (!p1Sel || !p2Sel) return

  for (const entry of ROSTER_TEST_ENTRIES) {
    const a = document.createElement('option')
    a.value = entry.id
    a.textContent = entry.label
    p1Sel.appendChild(a)
    const b = document.createElement('option')
    b.value = entry.id
    b.textContent = entry.label
    p2Sel.appendChild(b)
  }

  p1Sel.value = rosterTestP1Id
  p2Sel.value = rosterTestP2Id

  p1Sel.addEventListener('change', () => {
    rosterTestP1Id = p1Sel.value
    vsBotCharSelectApi?.syncSelection(rosterTestP1Id, rosterTestP2Id)
    applyRosterTestSelection()
  })
  p2Sel.addEventListener('change', () => {
    rosterTestP2Id = p2Sel.value
    vsBotCharSelectApi?.syncSelection(rosterTestP1Id, rosterTestP2Id)
    applyRosterTestSelection()
  })
}

function endVsBotRound(result: 'p1' | 'p2' | 'draw'): void {
  if (flowMode === 'online-match' && onlineLobbyMount?.session.getRole() === 'guest') {
    return
  }
  const rivalTitle = flowMode === 'online-match' ? 'Opponent' : 'Bot'
  const rivalLower = flowMode === 'online-match' ? 'opponent' : 'bot'
  matchPaused = false
  if (result === 'draw') {
    vsBotPhase = 'round_break'
    roundBreakTimer = ROUND_BREAK_SEC
    const bothDown =
      (playerFighter?.getHealth().current ?? 1) <= 0 &&
      (botFighter?.getHealth().current ?? 1) <= 0
    roundBanner = bothDown ? 'Double K.O. — replay round' : 'Draw — replay round'
    pushOnlineMatchSyncFromHost()
    return
  }

  if (result === 'p1') p1Wins += 1
  else p2Wins += 1

  if (result === 'p1') playerFighter?.beginRoundWinPresentation()
  else botFighter?.beginRoundWinPresentation()

  const h1 = playerFighter?.getHealth().current ?? 0
  const h2 = botFighter?.getHealth().current ?? 0
  const ko = result === 'p1' ? h2 <= 0 : h1 <= 0

  if (p1Wins >= WINS_TO_MATCH || p2Wins >= WINS_TO_MATCH) {
    vsBotPhase = 'match_done'
    roundBreakTimer = 0
    roundBanner =
      result === 'p1' ? 'You win the match' : `${rivalTitle} wins the match`
    pushOnlineMatchSyncFromHost()
    return
  }

  vsBotPhase = 'round_break'
  roundBreakTimer = ROUND_BREAK_SEC
  roundBanner =
    result === 'p1'
      ? ko
        ? 'K.O. — you take the round'
        : 'Time — you take the round'
      : ko
        ? `K.O. — ${rivalLower} takes the round`
        : `Time — ${rivalLower} takes the round`
  pushOnlineMatchSyncFromHost()
}

const combatTestBotFrames = createCombatTestBotFrameSource()

let showCollisionDebug = false

let collisionDebug: CollisionDebugRenderer | undefined
let hitFeel: HitFeelController | undefined

const stage = startMinimalStage(canvas, {
  beforeRender(dt) {
    syncMatchHudLifecycle()

    if (flowMode !== 'online-match') {
      loggedOnlineControlBootstrap = false
    }

    const touchCombatActive = getGameUiState() === 'in_match' && !rotateOverlayBlockingGameplay
    mobileTouch.setCombatActive(touchCombatActive)
    const localSnapRaw = mergeSnapshots(keyboard.readFrame(), mobileTouch.readFrame())
    const localSnap = rotateOverlayBlockingGameplay ? EMPTY_FRAME_SNAPSHOT : localSnapRaw
    const inMatch = flowMode === 'vs-bot-match' || flowMode === 'online-match'
    const preRoundControlsLocked =
      inMatch &&
      (vsBotPhase === 'countdown' || countdownHoldForAssets || rotateOverlayBlockingGameplay)
    const controlSnap = preRoundControlsLocked ? EMPTY_FRAME_SNAPSHOT : localSnap

    if (preRoundControlsLocked && !prevPreRoundControlsLocked) {
      console.info('[countdown] start - controls locked')
      playerFighter?.applyPreRoundCountdownEngaged()
      botFighter?.applyPreRoundCountdownEngaged()
      console.info('[countdown] fighters forced idle')
    } else if (!preRoundControlsLocked && prevPreRoundControlsLocked) {
      console.info('[countdown] end - controls unlocked')
      keyboard.clearFrameEdges()
    }

    if (inMatch && playerFighter && botFighter) {
      if (playerFighter.getHealth().current <= 0) playerFighter.tickCombatPresentation(dt)
      if (botFighter.getHealth().current <= 0) botFighter.tickCombatPresentation(dt)
    }

    const simActive =
      inMatch &&
      vsBotPhase === 'fighting' &&
      !matchPaused &&
      koRoundHaltTimer <= 0 &&
      !rotateOverlayBlockingGameplay
    const inOnlineFight = flowMode === 'online-match' && simActive
    const onlineConnected = Boolean(
      onlineLobbyMount?.session.isOpen() && onlineLobbyMount.session.hasPeer(),
    )
    const onlineRole =
      flowMode === 'online-match' ? (onlineLobbyMount?.session.getRole() ?? null) : null

    let onlinePair: { p1: FrameSnapshot; p2: FrameSnapshot } | null = null
    let simDt: number
    if (inOnlineFight) {
      if (onlineConnected) {
        onlinePair = onlineLobbyMount!.session.tryConsumeLockstepPair(localSnap)
        simDt = onlinePair ? ONLINE_SIM_DT : 0
        hitFeel?.tickStart(onlinePair ? dt : 0)
      } else {
        simDt = 0
        hitFeel?.tickStart(0)
      }
    } else if (hitFeel) {
      simDt = hitFeel.tickStart(dt)
    } else {
      simDt = dt
    }

    const botSnapVsCpu =
      flowMode !== 'online-match' &&
      simActive &&
      playerFighter &&
      botFighter &&
      isCombatTestBotActive()
        ? combatTestBotFrames(botFighter, playerFighter, simDt)
        : EMPTY_FRAME_SNAPSHOT

    let snapSim: FrameSnapshot
    let botSnapSim: FrameSnapshot
    let stepDt: number
    if (inOnlineFight && onlineConnected) {
      stepDt = onlinePair ? ONLINE_SIM_DT : 0
      if (onlinePair) {
        snapSim = onlinePair.p1
        botSnapSim = onlinePair.p2
      } else if (onlineRole === 'guest') {
        snapSim = EMPTY_FRAME_SNAPSHOT
        botSnapSim = localSnap
      } else {
        snapSim = localSnap
        botSnapSim = EMPTY_FRAME_SNAPSHOT
      }
    } else if (inOnlineFight && !onlineConnected) {
      stepDt = 0
      snapSim = localSnap
      botSnapSim = EMPTY_FRAME_SNAPSHOT
    } else {
      stepDt = simDt
      snapSim = controlSnap
      botSnapSim = botSnapVsCpu
    }

    if (flowMode === 'online-match') {
      if (inOnlineFight) {
        const simOn = Boolean(onlinePair && stepDt > 0)
        if (simOn !== lastLoggedSimActiveOnline) {
          lastLoggedSimActiveOnline = simOn
          logOnlineDebug(
            'movement',
            simOn ? 'online lockstep sim ACTIVE' : 'online lockstep sim PAUSED',
            {
              onlineConnected,
              hasPair: !!onlinePair,
              vsBotPhase,
            },
          )
        }
        if (onlineConnected && !onlinePair) {
          const t = performance.now()
          if (t - lastLockstepStarveLogMs > 1000) {
            lastLockstepStarveLogMs = t
            logOnlineDebug('movement', 'lockstep waiting for peer frame (no step this tick)')
          }
        }
      }
    } else if (lastLoggedSimActiveOnline !== null) {
      lastLoggedSimActiveOnline = null
    }

    if (!inMatch) {
      stage.setStagePresentation('menu')
      setFightersVisible(false)
      hitFeel?.syncBaseFromCamera()
    }

    if (simActive && stepDt > 0 && playerFighter && botFighter) {
      const localGuest = flowMode === 'online-match' && onlineRole === 'guest'
      const lf = localGuest ? botFighter : playerFighter
      const ls = localGuest ? botSnapSim : snapSim
      if (ls.pressed.has('jump') && lf.grounded && lf.getHealth().current > 0) {
        gameSfx.playJump()
      }
    }

    const lockIntegrateDt = preRoundControlsLocked ? dt : 0

    if (simActive) {
      playerFighter?.integrateMotion(snapSim, stepDt)
      botFighter?.integrateMotion(botSnapSim, stepDt)
    } else if (inMatch) {
      if (preRoundControlsLocked) {
        playerFighter?.integrateMotion(EMPTY_FRAME_SNAPSHOT, lockIntegrateDt)
        botFighter?.integrateMotion(EMPTY_FRAME_SNAPSHOT, lockIntegrateDt)
      } else if (flowMode === 'online-match' && onlineRole === 'guest') {
        playerFighter?.integrateMotion(EMPTY_FRAME_SNAPSHOT, 0)
        botFighter?.integrateMotion(localSnap, 0)
      } else {
        playerFighter?.integrateMotion(localSnap, 0)
        botFighter?.integrateMotion(EMPTY_FRAME_SNAPSHOT, 0)
      }
    } else {
      playerFighter?.integrateMotion(EMPTY_FRAME_SNAPSHOT, 0)
      botFighter?.integrateMotion(EMPTY_FRAME_SNAPSHOT, 0)
    }

    if (inMatch && playerFighter && botFighter) {
      if (playerFighter.consumeLandSoundCue()) gameSfx.playLand()
      if (botFighter.consumeLandSoundCue()) gameSfx.playLand()
    }

    if (playerFighter && botFighter) {
      if (inMatch) {
        const pa = playerFighter.getPlanarPosition()
        const pb = botFighter.getPlanarPosition()
        playerFighter.faceToward(pb.x, pb.z)
        botFighter.faceToward(pa.x, pa.z)
      }

      if (simActive && stepDt > 0) {
        if (flowMode === 'online-match' && onlinePair && onlineRole) {
          if (!loggedOnlineControlBootstrap) {
            loggedOnlineControlBootstrap = true
            const localId = onlineRole === 'guest' ? rosterTestP2Id : rosterTestP1Id
            console.info('[ONLINE_CONTROL] role=', onlineRole)
            console.info('[ONLINE_CONTROL] localFighterId=', localId)
            console.info(
              '[ONLINE_CONTROL] input enabled for fighter=',
              onlineRole === 'guest' ? 'screen_right (guest roster slot)' : 'screen_left (host roster slot)',
            )
          }
          const nowCtl = performance.now()
          if (readMoveAxis(localSnap) !== 0 && nowCtl - lastOnlineControlMoveLogMs > 1200) {
            lastOnlineControlMoveLogMs = nowCtl
            console.info('[ONLINE_CONTROL] movement input triggered', { role: onlineRole })
          }
          if (pressedHasCombatEdge(localSnap.pressed) && nowCtl - lastOnlineControlAttackLogMs > 1200) {
            lastOnlineControlAttackLogMs = nowCtl
            console.info('[ONLINE_CONTROL] attack input triggered', { role: onlineRole })
          }
        }

        const localGuestFoot = flowMode === 'online-match' && onlineRole === 'guest'
        const footFighter = localGuestFoot ? botFighter : playerFighter
        const footSnap = localGuestFoot ? botSnapSim : snapSim
        const footAxis = readMoveAxis(footSnap)
        if (
          footFighter.grounded &&
          footFighter.getHealth().current > 0 &&
          footAxis !== 0
        ) {
          sfxFootAcc += stepDt
          if (sfxFootAcc >= 0.16) {
            sfxFootAcc = 0
            gameSfx.playFootstep()
          }
        } else {
          sfxFootAcc = 0
        }

        resolvePushboxPair(playerFighter, botFighter, 4, {
          aMoveIntentX: readMoveAxis(snapSim),
          bMoveIntentX: readMoveAxis(botSnapSim),
        })
        const vP = computeFighterCollisionVolumes(playerFighter, botFighter)
        const vB = computeFighterCollisionVolumes(botFighter, playerFighter)
        const rP = resolveStrike(playerFighter, botFighter, snapSim, botSnapSim, vP, vB)
        if (rP.ok) {
          gameSfx.playHit(rP.blocked, rP.strikeKind)
          hitFeel?.triggerImpact(rP.blocked, rP.impact, rP.strikeDir, rP.strikeKind)
          botFighter.registerHitPresentation(rP.blocked, {
            strikeKind: rP.strikeKind,
            recoilX: rP.strikeDir.x,
          })
          if (!rP.blocked && botFighter.getHealth().current <= 0) {
            const fall = -Math.sign(rP.strikeDir.x)
            botFighter.beginKnockoutPresentation(fall === 0 ? 1 : fall)
            hitFeel?.triggerKoMoment()
            showKoMomentOverlay()
            koOverlayHideAt = performance.now() + (flowMode === 'online-match' ? 1550 : 2600)
            if (flowMode !== 'online-match') {
              koRoundHaltTimer = KO_ROUND_DRAMA_SEC
              koPendingRoundResult = 'p2'
            }
          }
        }
        const rB = resolveStrike(botFighter, playerFighter, botSnapSim, snapSim, vB, vP)
        if (rB.ok) {
          gameSfx.playHit(rB.blocked, rB.strikeKind)
          hitFeel?.triggerImpact(rB.blocked, rB.impact, rB.strikeDir, rB.strikeKind)
          playerFighter.registerHitPresentation(rB.blocked, {
            strikeKind: rB.strikeKind,
            recoilX: rB.strikeDir.x,
          })
          if (!rB.blocked && playerFighter.getHealth().current <= 0) {
            const fall = -Math.sign(rB.strikeDir.x)
            playerFighter.beginKnockoutPresentation(fall === 0 ? 1 : fall)
            hitFeel?.triggerKoMoment()
            showKoMomentOverlay()
            koOverlayHideAt = performance.now() + (flowMode === 'online-match' ? 1550 : 2600)
            if (flowMode !== 'online-match') {
              koRoundHaltTimer = KO_ROUND_DRAMA_SEC
              koPendingRoundResult = 'p1'
            }
          }
        }
        const atkPBefore = playerFighter.getAttackState()
        const atkBBefore = botFighter.getAttackState()
        playerFighter.advanceCombatTimeline(snapSim, stepDt)
        botFighter.advanceCombatTimeline(botSnapSim, stepDt)
        const atkPAfter = playerFighter.getAttackState()
        const atkBAfter = botFighter.getAttackState()
        if (atkPBefore.phase === 'idle' && atkPAfter.phase === 'startup' && atkPAfter.kind) {
          gameSfx.playAttackWind(atkPAfter.kind)
        }
        if (atkBBefore.phase === 'idle' && atkBAfter.phase === 'startup' && atkBAfter.kind) {
          gameSfx.playAttackWind(atkBAfter.kind)
        }

        roundTimeLeft = Math.max(0, roundTimeLeft - stepDt)

        const h1 = playerFighter.getHealth().current
        const h2 = botFighter.getHealth().current
        const onlineGuestResolve =
          flowMode === 'online-match' &&
          onlineLobbyMount?.session.getRole() === 'guest'
        if (!onlineGuestResolve) {
          if (h1 <= 0 && h2 <= 0) endVsBotRound('draw')
          else if (h1 <= 0) {
            if (koRoundHaltTimer <= 0) endVsBotRound('p2')
          } else if (h2 <= 0) {
            if (koRoundHaltTimer <= 0) endVsBotRound('p1')
          }
          else if (roundTimeLeft <= 0) {
            if (h1 > h2) endVsBotRound('p1')
            else if (h2 > h1) endVsBotRound('p2')
            else endVsBotRound('draw')
          }
        }
      }

      playerFighter.tickImportedGlbMixer?.(dt)
      botFighter.tickImportedGlbMixer?.(dt)

      if (inMatch) {
        const onlineGuestTimeline =
          flowMode === 'online-match' &&
          onlineLobbyMount?.session.getRole() === 'guest'

        if (!onlineGuestTimeline && vsBotPhase === 'round_break' && !matchPaused) {
          roundBreakTimer -= dt
          if (roundBreakTimer <= 0) {
            roundBreakTimer = 0
            if (!roundCountdownEnterInFlight) {
              roundCountdownEnterInFlight = true
              void enterRoundCountdown()
                .catch((e) => console.error('[Plushdown] enterRoundCountdown', e))
                .finally(() => {
                  roundCountdownEnterInFlight = false
                })
            }
          }
        } else if (!onlineGuestTimeline && vsBotPhase === 'countdown' && !matchPaused) {
          if (!countdownHoldForAssets) {
            countdownRemaining -= dt
          }
          if (countdownRemaining <= 0) {
            countdownRemaining = 0
            vsBotPhase = 'fighting'
            pushOnlineMatchSyncFromHost()
            if (flowMode === 'online-match' && !loggedOnlineMovementEnabled) {
              loggedOnlineMovementEnabled = true
              console.info('[GAME_INIT] movement_enabled true', {
                role: onlineLobbyMount?.session.getRole() ?? null,
                vsBotPhase,
              })
              console.info('[Plushdown:OnlineDebug] match · round started · movement enabled')
            }
          }
        }

        if (vsBotPhase === 'countdown' && countdownRemaining > 0) {
          const cdCeil = Math.ceil(countdownRemaining)
          if (cdCeil !== sfxLastCdInt && cdCeil > 0) {
            gameSfx.playCountdownTick(cdCeil)
            sfxLastCdInt = cdCeil
          }
        } else if (vsBotPhase !== 'countdown') {
          sfxLastCdInt = -1
        }

        if (sfxPrevVsPhase === 'countdown' && vsBotPhase === 'fighting') {
          gameSfx.playFightGo()
        }
        sfxPrevVsPhase = vsBotPhase

        if (
          flowMode === 'online-match' &&
          onlineLobbyMount?.session.isHost() &&
          !matchPaused &&
          (vsBotPhase === 'round_break' ||
            vsBotPhase === 'countdown' ||
            vsBotPhase === 'match_done')
        ) {
          pushOnlineMatchSyncFromHost(undefined, true)
        }

        if (matchHudCtrl && shouldShowMatchHud()) {
          const countdownLabel =
            vsBotPhase === 'countdown' && countdownRemaining > 0
              ? String(Math.ceil(countdownRemaining))
              : null

          const leftLabel =
            flowMode === 'online-match'
              ? onlineRole === 'guest'
                ? 'Opponent'
                : 'You'
              : 'You'
          const rightLabel =
            flowMode === 'online-match'
              ? onlineRole === 'guest'
                ? 'You'
                : 'Opponent'
              : 'Bot'

          matchHudCtrl.update({
            p1: playerFighter.getHealth(),
            p2: botFighter.getHealth(),
            roundSecondsLeft: roundTimeLeft,
            p1Wins,
            p2Wins,
            roundLabel: roundLabelText(),
            banner: vsBotPhase === 'match_done' ? null : roundBanner,
            countdown: countdownLabel,
            leftLabel,
            rightLabel,
            leftHealthAriaLabel: `${leftLabel} health`,
            rightHealthAriaLabel: `${rightLabel} health`,
          })
        }
      }

      if (collisionDebug) {
        if (inMatch && showCollisionDebug) {
          const va = computeFighterCollisionVolumes(playerFighter, botFighter)
          const vb = computeFighterCollisionVolumes(botFighter, playerFighter)
          collisionDebug.sync(va, vb, true)
        } else {
          collisionDebug.sync(null, null, false)
        }
      }
    } else if (collisionDebug) {
      collisionDebug.sync(null, null, false)
    }

    syncGameUiOverlays()

    updateAttackTimingDebugOverlay(
      playerFighter ?? null,
      botFighter ?? null,
      inMatch && Boolean(playerFighter && botFighter),
    )

    if (koRoundHaltTimer > 0) {
      koRoundHaltTimer -= dt
      if (koRoundHaltTimer <= 0 && koPendingRoundResult) {
        const r = koPendingRoundResult
        koPendingRoundResult = null
        endVsBotRound(r)
      }
    }

    if (koOverlayHideAt > 0 && performance.now() >= koOverlayHideAt) {
      koOverlayHideAt = 0
      hideKoMomentOverlay()
    }

    if (
      hitFeel &&
      inMatch &&
      playerFighter &&
      botFighter &&
      vsBotPhase === 'fighting' &&
      !matchPaused
    ) {
      const midX = (playerFighter.getPlanarX() + botFighter.getPlanarX()) * 0.5
      hitFeel.tickFightCamera(midX, dt)
    }
    hitFeel?.tickEnd(dt)

    prevPreRoundControlsLocked = preRoundControlsLocked
  },
})

try {
  collisionDebug = new CollisionDebugRenderer(stage.scene)
} catch (err) {
  console.error('[Plushdown] CollisionDebugRenderer failed to initialize:', err)
}

try {
  hitFeel = new HitFeelController({
    camera: stage.camera,
    basePosition: stage.camera.position.clone(),
    lookTarget: TOYBOX_FIGHT_LOOK_AT.clone(),
    scene: stage.scene,
    screenPunch,
  })
} catch (err) {
  console.error('[Plushdown] HitFeelController failed to initialize:', err)
}

await loadBootAssets()

applyRosterTestSelection()

const mainMenu = mountMainMenu(overlay, {
  onFlowChange(mode) {
    flowMode = mode
    if (mode !== 'online-select') {
      stopOnlineCharSelectHostGatePoll()
    }
    const inMatch = mode === 'vs-bot-match' || mode === 'online-match'
    gameMusic.setScene(inMatch ? 'match' : 'menu')
    keyboard.setPreventBrowserDefaults(inMatch)
    logOnlineDebug('input', `keyboard preventDefault ${inMatch ? 'ENABLED' : 'disabled'}`, {
      mode,
    })
    matchPaused = false
    if (mode === 'online-lobby') {
      console.info('[Plushdown:OnlineDebug] flow · online menu opened')
    }
    if (mode === 'vs-bot-select' || mode === 'online-select') {
      if (mode === 'vs-bot-select') {
        vsBotCharSelectApi?.syncSelection(rosterTestP1Id, rosterTestP2Id)
        if (pendingVsBotRematchCharSelect) {
          pendingVsBotRematchCharSelect = false
          vsBotCharSelectApi?.setRematchMode(true)
        } else {
          vsBotCharSelectApi?.setRematchMode(false)
        }
      }
      const charSelectMode = mode === 'online-select' ? 'online' : 'vs-bot'
      void loadCharacterSelectAssets(charSelectMode).catch((e) =>
        console.error('[assets] character select stage failed', e),
      )
      warmupRosterGpuOnce(stage.scene, stage.camera, stage.renderer, rosterWarmupFactories)
    }
    if (mode === 'online-select') {
      resetOnlineCharacterSelectStartGuards()
      // Do NOT clear session ready ids here: guest `player_ready` can arrive before this
      // navigation completes (quick match); wiping would drop peerReadyFighterId on the host.
      onlineCharSelectApi?.resetForSession()
      if (pendingOnlineRematchCharSelect) {
        pendingOnlineRematchCharSelect = false
        onlineLobbyMount?.session.setRematchCharacterSelectFlow(true)
        onlineCharSelectApi?.setRematchMode(true, rosterTestP1Id, rosterTestP2Id)
        refreshOnlineRematchNegotiationUi()
      } else if (onlineLobbyMount) {
        onlineCharSelectApi?.hydrateFromSessionGate(onlineLobbyMount.session)
      }
      console.info('[VERIFY_A] entering_fighter_select', {
        buildId: PLUSHDOWN_ONLINE_VERIFY_BUILD_ID,
        sessionGate: onlineLobbyMount?.session.getCharSelectGateDebug(),
      })
      console.info('[Plushdown:OnlineDebug] flow · fighter select entered')
      queueMicrotask(() => tryStartOnlineMatchFromCharacterSelect())
      if (onlineLobbyMount?.session.getRole() === 'host') {
        console.info('[VERIFY_POLL] host_gate_poll_started intervalMs=200')
        startOnlineCharSelectHostGatePoll()
      }
    }
    if (mode === 'main') {
      lastOnlineMatchSyncSerialized = null
      lastOnlineMatchSyncSentMs = 0
      onlineMatchSyncCoalesceModeLogged = false
      logOnlineDebug('sync', 'host coalesce state cleared (main menu)')
      onlineLobbyMount?.session.disconnect()
    }
    if (inMatch) {
      stage.setStagePresentation('fight')
      setFightersVisible(true)
      if (mode !== 'online-match') {
        beginFreshMatch()
      }
    } else {
      logOnlineDebug('scene', 'flow left match · menu presentation + fighter visibility off')
      hitFeel?.clearTransientEffects()
      stage.setStagePresentation('menu')
      setFightersVisible(false)
      hitFeel?.syncBaseFromCamera()
      resetFightersForRound()
    }
    syncMatchHudLifecycle()
  },
})

function refreshOnlineRematchNegotiationUi(): void {
  const sess = onlineLobbyMount?.session
  if (!sess || flowMode !== 'online-select' || !sess.isRematchCharacterSelectFlow()) return
  const d = sess.getRematchNegotiationDebug()
  if (d.peerDeclined) {
    onlineCharSelectApi?.syncRematchNegotiationUi('peer_declined')
  } else if (d.peerAccepted) {
    onlineCharSelectApi?.syncRematchNegotiationUi('peer_accepted')
  } else {
    onlineCharSelectApi?.syncRematchNegotiationUi('waiting')
  }
}

function clearOnlineRematchDeclineNavigateTimer(): void {
  if (onlineRematchDeclineNavigateTimer !== null) {
    clearTimeout(onlineRematchDeclineNavigateTimer)
    onlineRematchDeclineNavigateTimer = null
  }
}

function leaveOnlineRematchToLobby(): void {
  clearOnlineRematchDeclineNavigateTimer()
  pendingOnlineRematchCharSelect = false
  onlineLobbyMount?.session.setRematchCharacterSelectFlow(false)
  onlineCharSelectApi?.resetForSession()
  onlineLobbyMount?.resetLobbyVisuals()
  mainMenu.navigateTo('online-lobby')
}

/**
 * Post-match → online fighter select (same `rosterTestP1Id` / `rosterTestP2Id`).
 * Initiator sets `sendRequest: true` so the peer opens the same screen.
 */
function enterOnlineRematchCharacterSelectFromResults(opts: { sendRequest: boolean }): void {
  console.info('[Plushdown:OnlineDebug] scene · rematch cleanup → fighter select')
  console.info('[rematch] entering character select')
  if (opts.sendRequest) {
    onlineLobbyMount?.session.sendRematchRequest()
  }
  countdownHoldForAssets = false
  roundCountdownEnterInFlight = false
  lastOnlineMatchSyncSerialized = null
  lastOnlineMatchSyncSentMs = 0
  loggedOnlineMovementEnabled = false
  onlineMatchSyncCoalesceModeLogged = false
  matchPaused = false
  p1Wins = 0
  p2Wins = 0
  vsBotPhase = 'fighting'
  roundTimeLeft = ROUND_DURATION_SEC
  countdownRemaining = 0
  roundBreakTimer = 0
  roundBanner = null
  syncRosterTestDropdowns()
  onlineLobbyMount?.session.prepareForNewOnlineMatch()
  onlineLobbyMount?.session.resetLockstep()
  recreateFightersFromRosterIds()
  resetFightersForRound()
  setFightersVisible(false)
  hitFeel?.clearTransientEffects()
  hitFeel?.resetFightCameraPose()
  pendingOnlineRematchCharSelect = true
  mainMenu.navigateTo('online-select')
  syncMatchHudLifecycle()
}

function declineOnlineRematchFromCharacterSelect(): void {
  onlineLobbyMount?.session.sendRematchDecline()
  onlineLobbyMount?.session.disconnect()
  leaveOnlineRematchToLobby()
}

function enterVsBotRematchCharacterSelectFromResults(): void {
  console.info('[rematch] requested')
  console.info('[rematch] entering character select')
  cancelPendingKoRoundResolution()
  countdownHoldForAssets = false
  roundCountdownEnterInFlight = false
  matchPaused = false
  p1Wins = 0
  p2Wins = 0
  vsBotPhase = 'fighting'
  roundTimeLeft = ROUND_DURATION_SEC
  countdownRemaining = 0
  roundBreakTimer = 0
  roundBanner = null
  syncRosterTestDropdowns()
  recreateFightersFromRosterIds()
  resetFightersForRound()
  setFightersVisible(false)
  hitFeel?.clearTransientEffects()
  hitFeel?.resetFightCameraPose()
  pendingVsBotRematchCharSelect = true
  mainMenu.navigateTo('vs-bot-select')
  syncMatchHudLifecycle()
}

const onlineLobbyPanel = overlay.querySelector<HTMLElement>('[data-menu-view="online-lobby"]')
const onlineCharSelectPanel = overlay.querySelector<HTMLElement>('[data-menu-view="online-select"]')
if (onlineLobbyPanel) {
  onlineLobbyMount = mountOnlineLobby(onlineLobbyPanel, {
    onEnterCharacterSelect() {
      if (flowMode === 'online-select') return
      mainMenu.navigateTo('online-select')
    },
    onPeerLeftInMatch() {
      roundBanner = 'Opponent disconnected.'
      vsBotPhase = 'match_done'
      matchPaused = false
      onlineLobbyMount?.session.disconnect()
    },
    onPeerLeftDuringCharacterSelect() {
      clearOnlineRematchDeclineNavigateTimer()
      pendingOnlineRematchCharSelect = false
      onlineLobbyMount?.session.setRematchCharacterSelectFlow(false)
      onlineCharSelectApi?.resetForSession()
      onlineLobbyMount?.resetLobbyVisuals()
      mainMenu.navigateTo('online-lobby')
    },
    onBack() {
      mainMenu.navigateTo('main')
    },
    isInOnlineMatch: () => flowMode === 'online-match',
    isInOnlineCharacterSelect: () => flowMode === 'online-select',
    onMatchSync: applyOnlineMatchSync,
    onPeerRematchRequested() {
      if (flowMode !== 'online-match') return
      if (getGameUiState() !== 'match_over') return
      enterOnlineRematchCharacterSelectFromResults({ sendRequest: false })
    },
    onRematchAcceptanceChanged() {
      refreshOnlineRematchNegotiationUi()
      queueMicrotask(() => tryStartOnlineMatchFromCharacterSelect())
    },
    onRematchPeerDeclined() {
      if (flowMode !== 'online-select') return
      if (!onlineLobbyMount?.session.isRematchCharacterSelectFlow()) return
      onlineCharSelectApi?.syncRematchNegotiationUi('peer_declined')
      clearOnlineRematchDeclineNavigateTimer()
      onlineRematchDeclineNavigateTimer = setTimeout(() => {
        onlineRematchDeclineNavigateTimer = null
        onlineLobbyMount?.session.disconnect()
        leaveOnlineRematchToLobby()
      }, 2500)
    },
    onPeerFighterSelected(charId) {
      if (flowMode === 'online-select') onlineCharSelectApi?.onPeerFighterSelected(charId)
    },
    onPeerPlayerReady(charId) {
      console.info('[CHARSEL_RECV] main · onPeerPlayerReady', {
        charId,
        flowMode,
        role: onlineLobbyMount?.session.getRole() ?? null,
      })
      if (flowMode === 'online-select') {
        onlineCharSelectApi?.onPeerPlayerReady(charId)
      } else {
        console.info('[CHARSEL_RECV] main · skip UI peer ready (not on online-select)')
      }
      queueMicrotask(() => tryStartOnlineMatchFromCharacterSelect())
    },
    onMatchStartFromHost(picks) {
      console.info('[MATCH_START_RECV] main callback', {
        picks,
        flowMode,
        role: onlineLobbyMount?.session.getRole() ?? null,
      })
      if (flowMode !== 'online-select') {
        console.warn('[MATCH_START_RECV] FAIL reason=wrong_flowMode', { flowMode, picks })
        return
      }
      console.info('[MATCH_START_RECV] main · PASS → beginOnlineMatchFromCharacterSelect', picks)
      beginOnlineMatchFromCharacterSelect(picks.hostCharId, picks.guestCharId)
    },
  })
}

if (onlineCharSelectPanel && onlineLobbyMount) {
  onlineCharSelectApi = wireOnlineCharacterSelect(
    onlineCharSelectPanel,
    rosterEntriesToSelectPresenters(),
    onlineLobbyMount.session,
    {
      onBack() {
        onlineLobbyMount?.session.disconnect()
        onlineLobbyMount?.resetLobbyVisuals()
        onlineCharSelectApi?.resetForSession()
        mainMenu.navigateTo('online-lobby')
      },
      onDeclineRematch() {
        declineOnlineRematchFromCharacterSelect()
      },
      getDebugState() {
        return { flowMode, vsBotPhase }
      },
      onLocalReadyCommitted() {
        queueMicrotask(() => tryStartOnlineMatchFromCharacterSelect())
      },
    },
  )
}

const charSelectPanel = overlay.querySelector<HTMLElement>('[data-menu-view="vs-bot-select"]')
if (charSelectPanel) {
  vsBotCharSelectApi = wireVsBotCharacterSelect(
    charSelectPanel,
    rosterEntriesToSelectPresenters(),
    {
      initialP1Id: rosterTestP1Id,
      initialP2Id: rosterTestP2Id,
      onFight(p1Id, p2Id) {
        rosterTestP1Id = p1Id
        rosterTestP2Id = p2Id
        pendingVsBotRematchCharSelect = false
        vsBotCharSelectApi?.setRematchMode(false)
        syncRosterTestDropdowns()
        recreateFightersFromRosterIds()
        resetFightersForRound()
        setFightersVisible(false)
        mainMenu.navigateTo('vs-bot-match')
      },
      onBack() {
        pendingVsBotRematchCharSelect = false
        vsBotCharSelectApi?.setRematchMode(false)
        mainMenu.navigateTo('main')
      },
      onRematchDecline() {
        pendingVsBotRematchCharSelect = false
        vsBotCharSelectApi?.setRematchMode(false)
        console.info('[rematch] returning to menu')
        mainMenu.navigateTo('main')
      },
    },
  )
}

mountRosterTestPanel(root)

const mainMenuRoot = overlay.querySelector<HTMLElement>('.main-menu')
if (mainMenuRoot) {
  wireViolenceModeSettings(mainMenuRoot)
  wireSfxSettings(mainMenuRoot)
  wireMusicSettings(mainMenuRoot)
}

root.addEventListener(
  'pointerdown',
  () => {
    gameSfx.prime()
    gameMusic.prime()
  },
  { passive: true },
)

root.addEventListener('click', (e) => {
  const uiEl = e.target as HTMLElement
  if (
    !uiEl.closest('#stage-canvas') &&
    !uiEl.closest('[data-sfx-mute-toggle]') &&
    !uiEl.closest('[data-music-mute-toggle]')
  ) {
    const btn = uiEl.closest('button, [role="button"]')
    if (btn && root.contains(btn)) {
      gameSfx.prime()
      gameSfx.playUiClick()
    }
  }
  const target = e.target as HTMLElement
  if (target.closest('[data-pause-resume]')) {
    if (getGameUiState() === 'paused') matchPaused = false
    return
  }
  if (target.closest('[data-pause-restart]')) {
    if (flowMode === 'vs-bot-match') beginFreshMatch()
    return
  }
  if (target.closest('[data-pause-exit-main]')) {
    if (flowMode === 'online-match') {
      onlineLobbyMount?.session.disconnect()
    }
    mainMenu.navigateTo('main')
    return
  }
  if (target.closest('[data-match-play-again]')) {
    console.info('[rematch] button clicked', { flowMode })
    if (flowMode === 'vs-bot-match') enterVsBotRematchCharacterSelectFromResults()
    else if (flowMode === 'online-match') {
      enterOnlineRematchCharacterSelectFromResults({ sendRequest: true })
    }
    return
  }
  if (target.closest('[data-online-rematch-cancel-vote]')) {
    return
  }
  if (target.closest('[data-match-online-leave]')) {
    if (flowMode === 'online-match') {
      onlineLobbyMount?.session.disconnect()
      onlineLobbyMount?.resetLobbyVisuals()
      mainMenu.navigateTo('online-lobby')
    }
    return
  }
  if (target.closest('[data-match-exit-main]')) {
    if (flowMode === 'online-match') {
      onlineLobbyMount?.session.disconnect()
    }
    mainMenu.navigateTo('main')
    return
  }
})

window.addEventListener(
  'keydown',
  (e) => {
    if (e.repeat) return
    if (e.code === 'Escape' && flowMode === 'online-lobby') {
      e.preventDefault()
      mainMenu.navigateTo('main')
      return
    }
    if (e.code === 'Escape' && flowMode === 'vs-bot-select') {
      e.preventDefault()
      const rematchLede = charSelectPanel?.querySelector<HTMLElement>(
        '[data-vs-bot-char-lede-rematch]',
      )
      if (rematchLede && !rematchLede.hidden) {
        pendingVsBotRematchCharSelect = false
        vsBotCharSelectApi?.setRematchMode(false)
        console.info('[rematch] returning to menu')
        mainMenu.navigateTo('main')
        return
      }
      pendingVsBotRematchCharSelect = false
      vsBotCharSelectApi?.setRematchMode(false)
      mainMenu.navigateTo('main')
      return
    }
    if (e.code === 'Escape' && flowMode === 'online-select') {
      e.preventDefault()
      if (onlineLobbyMount?.session.isRematchCharacterSelectFlow()) {
        declineOnlineRematchFromCharacterSelect()
      } else {
        onlineLobbyMount?.session.disconnect()
        onlineLobbyMount?.resetLobbyVisuals()
        onlineCharSelectApi?.resetForSession()
        mainMenu.navigateTo('online-lobby')
      }
      return
    }
    if (e.code === 'Escape' && (flowMode === 'vs-bot-match' || flowMode === 'online-match')) {
      const st = getGameUiState()
      if (st === 'paused') {
        e.preventDefault()
        matchPaused = false
        return
      }
      if (st === 'match_over') return
      if (st === 'in_match' || st === 'countdown' || st === 'round_over') {
        e.preventDefault()
        matchPaused = true
        return
      }
    }
    if (e.code === 'Backquote') {
      e.preventDefault()
      showCollisionDebug = !showCollisionDebug
      return
    }
    if (
      COMBAT_TEST_BOT_ALLOW_RUNTIME_TOGGLE &&
      e.code === 'F2' &&
      flowMode === 'vs-bot-match'
    ) {
      e.preventDefault()
      toggleCombatTestBotRuntime()
    }
  },
  true,
)

console.info('[Plushdown:Boot] Main update loop: RAF tick via startMinimalStage → beforeRender → render')
console.info('[Plushdown:Boot] flowMode=%s vsBotPhase=%s', flowMode, vsBotPhase)
console.info(
  '[Plushdown:Boot] scene · children=%i · camera y=%s z=%s',
  stage.scene.children.length,
  stage.camera.position.y.toFixed(2),
  stage.camera.position.z.toFixed(2),
)
console.info(
  '[Plushdown:Boot] subsystems · hitFeel=%s collisionDebug=%s p1=%s p2=%s',
  hitFeel ? 'ok' : 'off',
  collisionDebug ? 'ok' : 'off',
  playerFighter ? 'ok' : 'off',
  botFighter ? 'ok' : 'off',
)
console.info(
  '[Plushdown:Boot] gameUiState=%s combatHudMounted=%s',
  getGameUiState(),
  String(!!matchHudCtrl),
)
