import type { FrameSnapshot } from '../input'
import {
  neutralFrameSnapshot,
  snapshotToWire,
  wireToSnapshot,
  type WireFrame,
} from './inputWire'
import type { ClientWireMessage, ServerWireMessage } from './wireTypes'

export type {
  ClientGameplayMessage,
  ClientToServer,
  ClientWireMessage,
  ServerGameplayRx,
  ServerLobbyMessage,
  ServerToClient,
  ServerWireMessage,
} from './wireTypes'

export type OnlineRole = 'host' | 'guest'

/** Payload from server `match_found` (queue pairing). */
export type MatchFoundPayload = {
  roomCode: string
  role: OnlineRole
  peerId: string
}

/** Host-authoritative phases relayed via `match_sync` (no pre-arena ready phase). */
export type SyncedMatchPhase = 'fighting' | 'round_break' | 'countdown' | 'match_done'

export type MatchSyncPayload = {
  ph: SyncedMatchPhase
  p1: number
  p2: number
  /** Round clock (fighting). */
  rt: number
  /** Pre-round countdown seconds remaining. */
  cd: number
  /** Inter-round break seconds remaining. */
  br: number
  bn: string | null
  /** Host set when fighters were reset for a new round (guest mirrors). */
  rz?: 1
}

export type OnlineSessionCallbacks = {
  onCreated(room: string): void
  onJoined(room: string): void
  onPeerJoined(): void
  onPeerLeft(): void
  onError(message: string): void
  /** Guest only: apply host-authoritative match / round UI state. */
  onMatchSync(payload: MatchSyncPayload): void
  /** Peer wants a rematch — navigate to rematch fighter select (same matchup). */
  onPeerRematchRequested?(): void
  /** `rematch_accept` from either side changed; refresh rematch character-select UI. */
  onRematchAcceptanceChanged?(): void
  /** Peer declined rematch — show failure and leave rematch flow. */
  onRematchPeerDeclined?(): void
  /** Matchmaking: `queue_status` with status `waiting`. */
  onQueueWaiting(): void
  /** Matchmaking: `queue_status` with status `idle` after `queue_leave`. */
  onQueueLeft(): void
  /** Queue pairing: room + role + opponent id; peer is already present. */
  onMatchFound?(msg: MatchFoundPayload): void
  /** Opponent preview while still choosing (before ready). */
  onPeerFighterSelected(charId: string): void
  /** Opponent confirmed with Ready — `charId` is their fighter for this match. */
  onPeerPlayerReady(charId: string): void
  /** Guest: host authorized match start with roster picks. */
  onMatchStartFromHost(picks: { hostCharId: string; guestCharId: string }): void
}

export const ONLINE_SIM_HZ = 60
export const ONLINE_SIM_DT = 1 / ONLINE_SIM_HZ

/**
 * Buffered input frames ahead of the sim cursor so network + sampling jitter
 * stutter less (both sides pre-seed neutral frames on reset).
 */
export const ONLINE_INPUT_DELAY_FRAMES = 2

const FIGHTER_SELECT_THROTTLE_MS = 80

let onlineWsDebugSerial = 0

/**
 * Room client: lockstep inputs with delay, host match sync, rematch handshake relay, char-select messages.
 */
export class OnlineSession {
  /** Optional instance hook; runs with {@link OnlineSessionCallbacks.onMatchFound} on `match_found`. */
  onMatchFound?: (msg: MatchFoundPayload) => void

  private ws: WebSocket | null = null
  private role: OnlineRole | null = null
  private roomCode: string | null = null
  private peerId: string | null = null
  private peerPresent = false

  private lastFighterSelectedSent = ''
  private lastFighterSelectedAt = 0

  private currentFrame = 0
  private readonly localByFrame = new Map<number, FrameSnapshot>()
  private readonly remoteByFrame = new Map<number, FrameSnapshot>()

  /** True while both clients are in the post-match rematch character-select handshake. */
  private rematchCharSelectMode = false
  private rematchAcceptLocal = false
  private rematchAcceptRemote = false
  private rematchPeerDeclined = false

  /** Authoritative: this client pressed Ready with this fighter (not UI-only). */
  private charSelectLocalReadyFighterId: string | null = null
  /** Authoritative: peer's `player_ready` fighter id (set before UI callback). */
  private charSelectPeerReadyFighterId: string | null = null

  constructor(
    private readonly url: string,
    private readonly cb: OnlineSessionCallbacks,
  ) {}

  getRole(): OnlineRole | null {
    return this.role
  }

  getRoom(): string | null {
    return this.roomCode
  }

  getRoomCode(): string | null {
    return this.roomCode
  }

  getPeerId(): string | null {
    return this.peerId
  }

  hasPeer(): boolean {
    return this.peerPresent
  }

  isOpen(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  isHost(): boolean {
    return this.role === 'host'
  }

  /** Debug snapshot for host start gate (uses network/session truth, not DOM). */
  getCharSelectGateDebug(): {
    connected: boolean
    peerPresent: boolean
    role: OnlineRole | null
    selfReadyFighter: string | null
    peerReadyFighter: string | null
    isHost: boolean
  } {
    return {
      connected: this.isOpen(),
      peerPresent: this.peerPresent,
      role: this.role,
      selfReadyFighter: this.charSelectLocalReadyFighterId,
      peerReadyFighter: this.charSelectPeerReadyFighterId,
      isHost: this.role === 'host',
    }
  }

  /**
   * Host only: both sides sent `player_ready` with a fighter id (session-tracked).
   */
  getCharSelectStartPicksIfHost(): { hostCharId: string; guestCharId: string } | null {
    if (this.role !== 'host') return null
    if (!this.isOpen() || !this.peerPresent) return null
    const hostSide = this.charSelectLocalReadyFighterId
    const guestSide = this.charSelectPeerReadyFighterId
    if (!hostSide || !guestSide) return null
    return { hostCharId: hostSide, guestCharId: guestSide }
  }

  createRoom(): void {
    this.teardownConnection()
    this.resetHandshake()
    this.resetLockstep()
    this.openSocket(() => {
      this.send({ type: 'create_room' })
    })
  }

  joinRoom(code: string): void {
    const cleaned = String(code).replace(/\D/g, '').slice(0, 12)
    if (!cleaned) {
      this.cb.onError('Enter the numeric room id the host shared.')
      return
    }
    this.teardownConnection()
    this.resetHandshake()
    this.resetLockstep()
    this.openSocket(() => {
      this.send({ type: 'join_room', roomCode: cleaned })
    })
  }

  /** Open a new WebSocket and send `queue_join` once connected. */
  queueForMatch(): void {
    this.teardownConnection()
    this.resetHandshake()
    this.resetLockstep()
    this.openSocket(() => {
      this.send({ type: 'queue_join' })
    })
  }

  leaveQueue(): void {
    if (this.isOpen()) {
      this.send({ type: 'queue_leave' })
    }
  }

  sendFighterSelected(charId: string): void {
    if (!this.isOpen() || !this.peerPresent) return
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    if (
      charId === this.lastFighterSelectedSent &&
      now - this.lastFighterSelectedAt < FIGHTER_SELECT_THROTTLE_MS
    ) {
      return
    }
    this.lastFighterSelectedSent = charId
    this.lastFighterSelectedAt = now
    this.send({ type: 'fighter_selected', charId })
  }

  /**
   * Ready up: confirms `charId` for this match (single confirm action).
   * `charId` must be the roster card id (same string as `fighter_selected` / spawn).
   * @returns false if nothing was sent — caller must not treat UI as authoritatively ready.
   */
  sendPlayerReady(charId: string): boolean {
    const payload = { type: 'player_ready' as const, charId }
    if (!this.isOpen()) {
      console.warn('[CHARSEL_SEND] FAIL reason=socket_not_open', {
        payload,
        roomCode: this.roomCode,
        role: this.role,
      })
      return false
    }
    if (!this.peerPresent) {
      console.warn('[CHARSEL_SEND] FAIL reason=no_peer', {
        payload,
        roomCode: this.roomCode,
        role: this.role,
      })
      return false
    }
    if (!charId) {
      console.warn('[CHARSEL_SEND] FAIL reason=missing_charId', {
        roomCode: this.roomCode,
        role: this.role,
      })
      return false
    }
    const localReadyFighterId_before = this.charSelectLocalReadyFighterId
    this.charSelectLocalReadyFighterId = charId
    console.info('[VERIFY_LOCAL_READY] authoritative local id set then wire send', {
      payloadCharId: charId,
      localReadyFighterId_before,
      localReadyFighterId_after: this.charSelectLocalReadyFighterId,
      role: this.role,
      roomCode: this.roomCode,
    })
    console.info('[CHARSEL_SEND] local ready preparing', {
      selectedUiId: charId,
      localReadyFighterId_before,
      localReadyFighterId_after: this.charSelectLocalReadyFighterId,
      payloadCharId: charId,
      roomCode: this.roomCode,
      role: this.role,
    })
    console.info('[CHARSEL_SEND] payload', {
      ...payload,
      roomCode: this.roomCode,
      role: this.role,
      socketOpen: true,
    })
    this.send({ type: 'player_ready', charId: String(charId) })
    return true
  }

  /** Host only: both players ready with valid fighters; starts match for guest via relay. */
  sendMatchStart(hostCharId: string, guestCharId: string): boolean {
    const payload = { type: 'match_start' as const, hostCharId, guestCharId }
    if (!this.isOpen()) {
      console.warn('[MATCH_START_SEND] FAIL reason=socket_not_open', {
        payload,
        roomCode: this.roomCode,
      })
      return false
    }
    if (this.role !== 'host') {
      console.warn('[MATCH_START_SEND] FAIL reason=not_host', {
        payload,
        role: this.role,
        roomCode: this.roomCode,
      })
      return false
    }
    if (!this.peerPresent) {
      console.warn('[MATCH_START_SEND] FAIL reason=no_peer', { payload, roomCode: this.roomCode })
      return false
    }
    console.info('[MATCH_START_SEND]', {
      ...payload,
      roomCode: this.roomCode,
      role: this.role,
    })
    this.send(payload)
    console.info('[VERIFY_MATCH_START_SENT]', {
      ...payload,
      roomCode: this.roomCode,
      role: this.role,
    })
    return true
  }

  /** Host: push round / intermission / HUD state to guest. */
  sendMatchSync(payload: MatchSyncPayload): void {
    if (!this.isOpen() || this.role !== 'host') return
    const body: MatchSyncPayload = {
      ph: payload.ph,
      p1: payload.p1,
      p2: payload.p2,
      rt: payload.rt,
      cd: payload.cd,
      br: payload.br,
      bn: payload.bn,
      rz: payload.rz,
    }
    this.send({ type: 'match_sync', payload: body })
  }

  isRematchCharacterSelectFlow(): boolean {
    return this.rematchCharSelectMode
  }

  /** Entering rematch fighter select (after `prepareForNewOnlineMatch`). */
  setRematchCharacterSelectFlow(active: boolean): void {
    this.rematchCharSelectMode = active
  }

  getRematchNegotiationDebug(): {
    selfAccepted: boolean
    peerAccepted: boolean
    peerDeclined: boolean
  } {
    return {
      selfAccepted: this.rematchAcceptLocal,
      peerAccepted: this.rematchAcceptRemote,
      peerDeclined: this.rematchPeerDeclined,
    }
  }

  bothRematchAccepted(): boolean {
    return this.rematchAcceptLocal && this.rematchAcceptRemote
  }

  /** Match results: ask for rematch (peer should open rematch fighter select). */
  sendRematchRequest(): void {
    if (!this.isOpen() || !this.peerPresent) return
    this.send({ type: 'rematch_request' })
    console.info('[rematch] requested')
  }

  /**
   * Rematch fighter select: one-shot accept relay (still requires `player_ready` + host `match_start`).
   * @returns false if duplicate or cannot send.
   */
  sendRematchAccept(): boolean {
    if (!this.isOpen() || !this.peerPresent) return false
    if (this.rematchAcceptLocal) return false
    this.rematchAcceptLocal = true
    this.send({ type: 'rematch_accept' })
    console.info('[rematch] self accepted')
    this.cb.onRematchAcceptanceChanged?.()
    return true
  }

  /** Local decline — caller should disconnect / navigate after this returns. */
  sendRematchDecline(): void {
    if (this.isOpen() && this.peerPresent) {
      this.send({ type: 'rematch_decline' })
    }
    console.info('[rematch] returning to menu')
  }

  /**
   * Clears rematch flags and char-select send throttle so a new char-select / match can run.
   */
  prepareForNewOnlineMatch(): void {
    this.rematchCharSelectMode = false
    this.rematchAcceptLocal = false
    this.rematchAcceptRemote = false
    this.rematchPeerDeclined = false
    this.lastFighterSelectedSent = ''
    this.lastFighterSelectedAt = 0
    this.clearCharacterSelectReadyIds('prepareForNewOnlineMatch')
    console.info('[Toybox Brawlers:OnlineDebug] session.prepareForNewOnlineMatch · reset')
  }

  resetLockstep(): void {
    this.currentFrame = 0
    this.localByFrame.clear()
    this.remoteByFrame.clear()

    const d = ONLINE_INPUT_DELAY_FRAMES
    for (let i = 0; i < d; i++) {
      const n = neutralFrameSnapshot()
      this.localByFrame.set(i, n)
      const w = snapshotToWire(n)
      this.send({ type: 'inp', f: i, h: [...w.h], p: [...w.p], r: [...w.r] })
    }
  }

  /**
   * Schedules local input for `currentFrame + delay` and consumes one tick when
   * both players have samples for `currentFrame`.
   */
  tryConsumeLockstepPair(localSnap: FrameSnapshot): {
    p1: FrameSnapshot
    p2: FrameSnapshot
  } | null {
    if (!this.isOpen() || !this.peerPresent) return null

    const f = this.currentFrame
    const schedule = f + ONLINE_INPUT_DELAY_FRAMES
    this.localByFrame.set(schedule, localSnap)
    const w = snapshotToWire(localSnap)
    this.send({ type: 'inp', f: schedule, h: [...w.h], p: [...w.p], r: [...w.r] })

    const remote = this.remoteByFrame.get(f)
    const local = this.localByFrame.get(f)
    if (remote === undefined || local === undefined) return null

    this.currentFrame = f + 1
    this.remoteByFrame.delete(f)
    this.localByFrame.delete(f)

    if (this.role === 'host') {
      return { p1: local, p2: remote }
    }
    return { p1: remote, p2: local }
  }

  disconnect(): void {
    this.teardownConnection()
    this.role = null
    this.roomCode = null
    this.peerId = null
    this.peerPresent = false
    this.resetHandshake()
    this.resetLockstep()
  }

  private clearCharacterSelectReadyIds(because: string): void {
    const hadLocal = this.charSelectLocalReadyFighterId
    const hadPeer = this.charSelectPeerReadyFighterId
    const shouldLog =
      hadLocal != null ||
      hadPeer != null ||
      because === 'prepareForNewOnlineMatch' ||
      because === 'peer_left'
    this.charSelectLocalReadyFighterId = null
    this.charSelectPeerReadyFighterId = null
    if (shouldLog) {
      console.info('[VERIFY_CLEAR] char_select_ready_ids', { because, hadLocal, hadPeer })
      console.info('[CHARSEL_RESET] clearing ready ids because=' + because, {
        hadLocal,
        hadPeer,
      })
    }
  }

  private resetHandshake(): void {
    this.rematchCharSelectMode = false
    this.rematchAcceptLocal = false
    this.rematchAcceptRemote = false
    this.rematchPeerDeclined = false
    this.lastFighterSelectedSent = ''
    this.lastFighterSelectedAt = 0
    this.clearCharacterSelectReadyIds('resetHandshake')
  }

  private teardownConnection(): void {
    if (this.ws) {
      console.info('[Toybox Brawlers:OnlineDebug] websocket · teardown / close')
      this.ws.close()
      this.ws = null
    }
  }

  private openSocket(onOpen: () => void): void {
    const ws = new WebSocket(this.url)
    const dbgId = ++onlineWsDebugSerial
    this.ws = ws
    ws.addEventListener(
      'open',
      () => {
        console.info('[Toybox Brawlers:OnlineDebug] websocket · open', { dbgId, url: this.url })
        onOpen()
      },
      { once: true },
    )

    ws.addEventListener('message', (ev) => {
      let msg: ServerWireMessage
      try {
        msg = JSON.parse(ev.data as string) as ServerWireMessage
      } catch {
        return
      }
      this.handleMessage(msg)
    })

    ws.addEventListener('close', () => {
      this.ws = null
      this.peerPresent = false
    })

    ws.addEventListener('error', () => {
      this.cb.onError('Connection failed — is the room server running?')
    })
  }

  private handleMessage(msg: ServerWireMessage): void {
    switch (msg.type) {
      case 'created':
        this.role = msg.role
        this.roomCode = msg.room
        this.peerId = null
        this.cb.onCreated(msg.room)
        break
      case 'joined':
        this.role = msg.role
        this.roomCode = msg.room
        this.peerId = null
        this.cb.onJoined(msg.room)
        break
      case 'peer_joined':
        this.peerPresent = true
        this.cb.onPeerJoined()
        break
      case 'peer_left':
        this.peerPresent = false
        this.peerId = null
        this.rematchCharSelectMode = false
        this.rematchAcceptLocal = false
        this.rematchAcceptRemote = false
        this.rematchPeerDeclined = false
        this.clearCharacterSelectReadyIds('peer_left')
        this.resetLockstep()
        this.cb.onPeerLeft()
        break
      case 'error':
        this.cb.onError(
          msg.code === 'ROOM_NOT_FOUND'
            ? 'Room not found.'
            : msg.code === 'ROOM_FULL'
              ? 'Room is full.'
              : msg.code === 'ROOM_FORMAT'
                ? 'Invalid code.'
                : 'Could not join room.',
        )
        this.disconnect()
        break
      case 'fighter_selected': {
        const id = typeof msg.charId === 'string' ? msg.charId : ''
        if (id) {
          console.info('[Toybox Brawlers:OnlineDebug] wire · fighter_selected (peer)', { charId: id })
          this.cb.onPeerFighterSelected(id)
        }
        break
      }
      case 'player_ready': {
        const m = msg as { charId?: unknown; characterId?: unknown }
        const raw = m.charId ?? m.characterId
        const id = raw != null && raw !== '' ? String(raw).trim() : ''
        if (!id) {
          console.warn('[CHARSEL_RECV] FAIL reason=missing_charId_in_payload', { raw: msg })
          break
        }
        const peerReadyFighterId_before = this.charSelectPeerReadyFighterId
        this.charSelectPeerReadyFighterId = id
        console.info('[CHARSEL_RECV] player_ready', {
          payloadCharId: id,
          peerReadyFighterId_before,
          peerReadyFighterId_after: this.charSelectPeerReadyFighterId,
          role: this.role,
          roomCode: this.roomCode,
        })
        if (this.role === 'host') {
          console.info('[VERIFY_B] host_stored_peer_player_ready', {
            payloadCharId: id,
            peerReadyFighterId_before,
            peerReadyFighterId_after: this.charSelectPeerReadyFighterId,
            roomCode: this.roomCode,
          })
        }
        console.info('[CHARSEL_RECV] stored peer ready id → onPeerPlayerReady (UI after authoritative store)')
        this.cb.onPeerPlayerReady(id)
        break
      }
      case 'match_start': {
        const h = typeof msg.hostCharId === 'string' ? msg.hostCharId : ''
        const g = typeof msg.guestCharId === 'string' ? msg.guestCharId : ''
        console.info('[MATCH_START_RECV] raw', {
          role: this.role,
          roomCode: this.roomCode,
          hostCharId: h,
          guestCharId: g,
        })
        if (this.role !== 'guest') {
          console.warn('[MATCH_START_RECV] FAIL reason=not_guest_role', {
            role: this.role,
            hostCharId: h,
            guestCharId: g,
          })
          break
        }
        if (!h || !g) {
          console.warn('[MATCH_START_RECV] FAIL reason=invalid_picks', {
            hostCharId: h,
            guestCharId: g,
          })
          break
        }
        console.info('[MATCH_START_RECV] PASS invoking onMatchStartFromHost', {
          hostCharId: h,
          guestCharId: g,
        })
        this.cb.onMatchStartFromHost({ hostCharId: h, guestCharId: g })
        break
      }
      case 'inp': {
        const f = msg.f
        if (typeof f !== 'number' || f < 0) return
        const wire: WireFrame = { h: msg.h, p: msg.p, r: msg.r }
        this.remoteByFrame.set(f, wireToSnapshot(wire))
        break
      }
      case 'match_sync': {
        if (this.role !== 'guest') break
        const raw = msg.payload
        if (!raw || typeof raw !== 'object') break
        const p = raw as MatchSyncPayload
        this.cb.onMatchSync({
          ph: p.ph,
          p1: p.p1,
          p2: p.p2,
          rt: p.rt,
          cd: p.cd,
          br: p.br,
          bn: p.bn,
          rz: p.rz === 1 ? 1 : undefined,
        })
        break
      }
      case 'rematch_request':
        console.info('[Toybox Brawlers:OnlineDebug] rematch · rematch_request (peer)')
        this.cb.onPeerRematchRequested?.()
        break
      case 'rematch_accept':
        if (this.rematchPeerDeclined) break
        this.rematchAcceptRemote = true
        console.info('[rematch] peer accepted')
        this.cb.onRematchAcceptanceChanged?.()
        break
      case 'rematch_decline':
        this.rematchPeerDeclined = true
        this.rematchAcceptRemote = false
        console.info('[rematch] peer declined')
        this.cb.onRematchPeerDeclined?.()
        break
      case 'queue_status':
        if (msg.status === 'waiting') {
          this.cb.onQueueWaiting()
        } else if (msg.status === 'idle') {
          this.cb.onQueueLeft()
        }
        break
      case 'match_found': {
        const { roomCode, role, peerId } = msg
        this.roomCode = roomCode
        this.role = role
        this.peerId = peerId
        this.peerPresent = true
        const payload: MatchFoundPayload = { roomCode, role, peerId }
        this.onMatchFound?.(payload)
        this.cb.onMatchFound?.(payload)
        if (!this.onMatchFound && !this.cb.onMatchFound) {
          if (role === 'host') {
            this.cb.onCreated(roomCode)
          } else {
            this.cb.onJoined(roomCode)
          }
          this.cb.onPeerJoined()
        }
        break
      }
      case 'ping':
        break
      default:
        break
    }
  }

  private send(obj: ClientWireMessage): void {
    if (obj.type === 'queue_join' || obj.type === 'queue_leave') {
      console.info('[Toybox Brawlers:OnlineDebug] queue ·', obj.type)
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj))
    }
  }
}

export function defaultWsUrl(): string {
  const v = import.meta.env.VITE_WS_URL
  if (typeof v === 'string' && v.length > 0) return v
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.hostname}:8787`
}
