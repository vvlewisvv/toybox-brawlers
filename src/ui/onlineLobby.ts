import {
  OnlineSession,
  defaultWsUrl,
  type MatchFoundPayload,
  type MatchSyncPayload,
} from '../net/onlineSession'

export type MountOnlineLobbyOptions = {
  /** Defaults to {@link defaultWsUrl} / `VITE_WS_URL`. */
  wsUrl?: string
  /** Both players in room / quick match paired — go to fighter select. */
  onEnterCharacterSelect(): void
  /** When peer drops during play. */
  onPeerLeftInMatch(): void
  /** Fighter select screen: opponent disconnected. */
  onPeerLeftDuringCharacterSelect(): void
  onBack(): void
  /** Distinguish lobby disconnect copy vs in-match disconnect. */
  isInOnlineMatch(): boolean
  isInOnlineCharacterSelect(): boolean
  onMatchSync(payload: MatchSyncPayload): void
  onPeerRematchRequested?(): void
  onRematchAcceptanceChanged?(): void
  onRematchPeerDeclined?(): void
  onPeerFighterSelected(charId: string): void
  onPeerPlayerReady(charId: string): void
  onMatchStartFromHost(picks: { hostCharId: string; guestCharId: string }): void
}

export type OnlineLobbyMount = {
  session: OnlineSession
  hideSearchingOverlay(): void
  resetLobbyVisuals(): void
  dispose(): void
}

const SEARCHING_DOT_MS = 450

/**
 * Wires `data-menu-view="online-lobby"`: quick match, create/join room (no fighter pick here).
 */
export function mountOnlineLobby(
  panel: HTMLElement,
  options: MountOnlineLobbyOptions,
): OnlineLobbyMount {
  const {
    onEnterCharacterSelect,
    onPeerLeftInMatch,
    onPeerLeftDuringCharacterSelect,
    onBack,
    isInOnlineMatch,
    isInOnlineCharacterSelect,
    onMatchSync,
    onPeerRematchRequested,
    onRematchAcceptanceChanged,
    onRematchPeerDeclined,
    onPeerFighterSelected,
    onPeerPlayerReady,
    onMatchStartFromHost,
  } = options
  const wsUrl = options.wsUrl ?? defaultWsUrl()

  const btnQueue = panel.querySelector<HTMLButtonElement>('[data-online-queue]')
  const btnCreate = panel.querySelector<HTMLButtonElement>('[data-online-create]')
  const btnJoin = panel.querySelector<HTMLButtonElement>('[data-online-join]')
  const btnBack = panel.querySelector<HTMLButtonElement>('[data-online-back]')
  const btnCopy = panel.querySelector<HTMLButtonElement>('[data-online-copy]')
  const inpJoin = panel.querySelector<HTMLInputElement>('[data-online-join-input]')
  const elCode = panel.querySelector<HTMLElement>('[data-online-code]')
  const elStatus = panel.querySelector<HTMLElement>('[data-online-status]')
  const wrapCode = panel.querySelector<HTMLElement>('[data-online-code-wrap]')
  const searchingOverlay = panel.querySelector<HTMLElement>('[data-online-searching-overlay]')
  const elSearchingDots = panel.querySelector<HTMLElement>('[data-online-searching-dots]')
  const btnSearchingCancel = panel.querySelector<HTMLButtonElement>(
    '[data-online-searching-cancel]',
  )

  if (!btnQueue || !btnCreate || !btnJoin || !btnBack || !inpJoin || !elStatus) {
    throw new Error('online lobby markup missing required elements')
  }

  const statusEl = elStatus
  let searchingAnimTimer: ReturnType<typeof setInterval> | null = null
  let searchingDotsPhase = 0

  function stopSearchingAnimation(): void {
    if (searchingAnimTimer !== null) {
      clearInterval(searchingAnimTimer)
      searchingAnimTimer = null
      console.info('[Plushdown:OnlineDebug] lobby · searching animation stopped')
    }
    searchingDotsPhase = 0
  }

  function tickSearchingDots(): void {
    if (!elSearchingDots) return
    const dots = searchingDotsPhase % 4 === 0 ? '' : '.'.repeat(searchingDotsPhase % 4)
    elSearchingDots.textContent = `Searching${dots}`
    searchingDotsPhase += 1
  }

  function startSearchingAnimation(): void {
    stopSearchingAnimation()
    tickSearchingDots()
    searchingAnimTimer = setInterval(tickSearchingDots, SEARCHING_DOT_MS)
    console.info('[Plushdown:OnlineDebug] lobby · searching animation started')
  }

  const onlineSession = new OnlineSession(wsUrl, {
    onCreated(room) {
      elCode && (elCode.textContent = room)
      wrapCode && (wrapCode.hidden = false)
      setStatus('Share this code. Waiting for opponent…')
    },
    onJoined(_room) {
      wrapCode && (wrapCode.hidden = true)
      setStatus('Joined. Waiting for host…')
    },
    onPeerJoined() {
      setStatus('Opponent connected. Choose fighters.')
      console.info('[Plushdown:OnlineDebug] lobby · room connected (peer_joined)')
      onEnterCharacterSelect()
    },
    onPeerLeft() {
      if (isInOnlineMatch()) {
        onPeerLeftInMatch()
      } else if (isInOnlineCharacterSelect()) {
        console.info('[Plushdown:OnlineDebug] lobby · peer left during character select')
        onPeerLeftDuringCharacterSelect()
      } else {
        setStatus('Opponent left.')
      }
    },
    onError(msg) {
      hideSearchingOverlay()
      setStatus(msg)
    },
    onMatchSync,
    onPeerRematchRequested,
    onRematchAcceptanceChanged,
    onRematchPeerDeclined,
    onPeerFighterSelected,
    onPeerPlayerReady,
    onMatchStartFromHost,
    onQueueWaiting() {
      setStatus('Looking for an opponent… (another player must choose Quick match too.)')
      console.info('[Plushdown:OnlineDebug] lobby · matchmaking started')
    },
    onQueueLeft() {
      hideSearchingOverlay()
      setStatus('')
    },
    onMatchFound(msg: MatchFoundPayload) {
      hideSearchingOverlay()
      if (msg.role === 'host') {
        elCode && (elCode.textContent = msg.roomCode)
        wrapCode && (wrapCode.hidden = false)
      } else {
        wrapCode && (wrapCode.hidden = true)
      }
      setStatus('Match found. Choose fighters.')
      console.info('[Plushdown:OnlineDebug] lobby · match found', {
        roomCode: msg.roomCode,
        role: msg.role,
      })
      onEnterCharacterSelect()
    },
  })

  function setStatus(t: string): void {
    statusEl.textContent = t
  }

  function setLobbySearchingUi(active: boolean): void {
    panel.classList.toggle('online-lobby--searching', active)
  }

  function showSearchingOverlay(): void {
    if (!searchingOverlay) return
    searchingOverlay.hidden = false
    searchingOverlay.setAttribute('aria-hidden', 'false')
    setLobbySearchingUi(true)
    startSearchingAnimation()
    if (btnSearchingCancel) {
      btnSearchingCancel.disabled = false
    }
  }

  function hideSearchingOverlay(): void {
    if (!searchingOverlay) return
    stopSearchingAnimation()
    searchingOverlay.hidden = true
    searchingOverlay.setAttribute('aria-hidden', 'true')
    setLobbySearchingUi(false)
    if (btnSearchingCancel) {
      btnSearchingCancel.disabled = false
    }
  }

  function resetLobbyUi(): void {
    hideSearchingOverlay()
    wrapCode && (wrapCode.hidden = true)
    elCode && (elCode.textContent = '—')
    setStatus('')
  }

  const onCreate = () => {
    resetLobbyUi()
    console.info('[Plushdown:OnlineDebug] lobby · create room')
    onlineSession.createRoom()
  }

  const onQueueClick = () => {
    resetLobbyUi()
    onlineSession.queueForMatch()
    showSearchingOverlay()
  }

  const onSearchingCancel = () => {
    if (btnSearchingCancel?.disabled) return
    if (btnSearchingCancel) btnSearchingCancel.disabled = true
    console.info('[Plushdown:OnlineDebug] lobby · cancel queue (queue_leave)')
    onlineSession.leaveQueue()
    resetLobbyUi()
  }

  const onJoin = () => {
    resetLobbyUi()
    console.info('[Plushdown:OnlineDebug] lobby · join room')
    onlineSession.joinRoom(inpJoin.value)
  }

  const onCopy = async () => {
    const t = elCode?.textContent?.trim()
    if (!t || t === '—') return
    try {
      await navigator.clipboard.writeText(t)
      setStatus('Code copied.')
    } catch {
      setStatus('Could not copy — select the code manually.')
    }
  }

  const onBackClick = () => {
    onlineSession.disconnect()
    resetLobbyUi()
    onBack()
  }

  btnQueue.addEventListener('click', onQueueClick)
  btnSearchingCancel?.addEventListener('click', onSearchingCancel)
  btnCreate.addEventListener('click', onCreate)
  btnJoin.addEventListener('click', onJoin)
  btnBack.addEventListener('click', onBackClick)
  btnCopy?.addEventListener('click', onCopy)

  return {
    session: onlineSession,
    hideSearchingOverlay,
    resetLobbyVisuals: resetLobbyUi,
    dispose() {
      console.info('[Plushdown:OnlineDebug] scene · online lobby dispose (remove listeners + disconnect)')
      stopSearchingAnimation()
      setLobbySearchingUi(false)
      btnQueue.removeEventListener('click', onQueueClick)
      btnSearchingCancel?.removeEventListener('click', onSearchingCancel)
      btnCreate.removeEventListener('click', onCreate)
      btnJoin.removeEventListener('click', onJoin)
      btnBack.removeEventListener('click', onBackClick)
      btnCopy?.removeEventListener('click', onCopy)
      onlineSession.disconnect()
      resetLobbyUi()
    },
  }
}
