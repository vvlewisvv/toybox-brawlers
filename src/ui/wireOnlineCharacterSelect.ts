import type { OnlineSession } from '../net/onlineSession'
import { createCharSelectCardFigure } from './charSelectCardFigure'
import type { VsBotCharSelectPresenter } from './vsBotCharacterSelect'

export type OnlineCharacterSelectApi = {
  resetForSession(): void
  /** After reset, re-apply session `getCharSelectGateDebug()` so UI matches early `player_ready` / local ready. */
  hydrateFromSessionGate(session: OnlineSession): void
  /** Post-match rematch: lock fighters from last `hostCharId` / `guestCharId`. */
  setRematchMode(active: boolean, hostCharId: string, guestCharId: string): void
  syncRematchNegotiationUi(state: 'idle' | 'waiting' | 'peer_accepted' | 'peer_declined'): void
  onPeerFighterSelected(charId: string): void
  onPeerPlayerReady(charId: string): void
  /** Host: both players readied with valid fighters. */
  getMatchPicksIfComplete():
    | { hostCharId: string; guestCharId: string }
    | null
  /** Roster card ids only (same strings as `player_ready` / spawn). */
  getSelectionDebug(): {
    localPreviewId: string
    localConfirmedId: string | null
    remotePreviewId: string
    remoteConfirmedId: string | null
    localReady: boolean
    remoteReady: boolean
  }
}

function labelForId(
  presenters: readonly VsBotCharSelectPresenter[],
  id: string,
): string {
  return presenters.find((p) => p.id === id)?.label ?? id
}

/**
 * Online fighter select: pick a card, then one "Ready up" confirms fighter + ready (no separate lock).
 */
export function wireOnlineCharacterSelect(
  panel: HTMLElement,
  presenters: readonly VsBotCharSelectPresenter[],
  session: OnlineSession,
  options: {
    onBack(): void
    /** Rematch screen: decline + leave (main sends `rematch_decline` + disconnect). */
    onDeclineRematch(): void
    /** Called only after local Ready succeeded on the wire (session authoritative). */
    onLocalReadyCommitted(): void
    /** Flow snapshot for debug logs (menu phase + combat phase). */
    getDebugState(): { flowMode: string; vsBotPhase: string }
  },
): OnlineCharacterSelectApi {
  const rowP1 = panel.querySelector<HTMLElement>('[data-char-row="p1"]')
  const rowP2 = panel.querySelector<HTMLElement>('[data-char-row="p2"]')
  const btnReady = panel.querySelector<HTMLButtonElement>('[data-online-char-ready]')
  const backBtn = panel.querySelector<HTMLButtonElement>('[data-online-char-back]')
  const statusEl = panel.querySelector<HTMLElement>('[data-online-char-status]')
  const hP1 = panel.querySelector<HTMLElement>('[data-online-char-p1-title]')
  const hP2 = panel.querySelector<HTMLElement>('[data-online-char-p2-title]')
  const titleEl = panel.querySelector<HTMLElement>('[data-online-char-title]')
  const ledeDefault = panel.querySelector<HTMLElement>('[data-online-char-lede-default]')
  const ledeRematch = panel.querySelector<HTMLElement>('[data-online-char-lede-rematch]')
  const rematchNegotiationEl = panel.querySelector<HTMLElement>('[data-online-rematch-negotiation]')

  if (!rowP1 || !rowP2 || !btnReady || !backBtn) {
    throw new Error('online character select markup missing rows or actions')
  }

  const p1Row = rowP1
  const p2Row = rowP2
  const readyBtn = btnReady
  const back = backBtn

  const role = (): 'host' | 'guest' | null => session.getRole()
  const mySlot = (): 'p1' | 'p2' | null => {
    const r = role()
    if (r === 'host') return 'p1'
    if (r === 'guest') return 'p2'
    return null
  }

  const opponentSlot = (): 'p1' | 'p2' | null => {
    const s = mySlot()
    if (s === 'p1') return 'p2'
    if (s === 'p2') return 'p1'
    return null
  }

  /** Highlight while choosing (before Ready). */
  let localPreviewId = presenters[0]?.id ?? ''
  /** Set when Ready pressed — final fighter for this match. */
  let localConfirmedId: string | null = null
  let localReady = false

  let remotePreviewId = ''
  let remoteConfirmedId: string | null = null
  let remoteReady = false

  let readyButtonClickCount = 0

  let rematchMode = false

  const rosterIds = new Set(presenters.map((p) => p.id))

  function isValidRosterId(id: string): boolean {
    return Boolean(id && rosterIds.has(id))
  }

  function ensureOpponentPill(section: HTMLElement): HTMLElement {
    let el = section.querySelector<HTMLElement>('[data-online-opponent-pill]')
    if (!el) {
      el = document.createElement('p')
      el.className = 'char-select__opponent-pill'
      el.dataset.onlineOpponentPill = ''
      const h = section.querySelector('.char-select__slot-title')
      h?.insertAdjacentElement('afterend', el)
    }
    return el
  }

  function syncOpponentSectionChrome(): void {
    const opp = opponentSlot()
    if (!opp) return
    const section = panel.querySelector<HTMLElement>(`[data-online-char-slot="${opp}"]`)
    if (!section) return
    const pill = ensureOpponentPill(section)
    pill.hidden = false
    section.classList.toggle(
      'char-select__block--opponent-preview',
      Boolean(remotePreviewId || remoteConfirmedId),
    )
    section.classList.toggle('char-select__block--opponent-locked', Boolean(remoteReady && remoteConfirmedId))

    const row = section.querySelector<HTMLElement>('.char-select__row')
    row?.classList.toggle(
      'char-select__row--opponent-locked',
      Boolean(remoteReady && remoteConfirmedId),
    )

    if (remoteReady && remoteConfirmedId) {
      pill.textContent = `Ready · ${labelForId(presenters, remoteConfirmedId)}`
      pill.classList.add('char-select__opponent-pill--ready')
    } else if (remotePreviewId) {
      pill.textContent = `Selected · ${labelForId(presenters, remotePreviewId)}`
      pill.classList.remove('char-select__opponent-pill--ready')
    } else {
      pill.textContent = 'Opponent selecting…'
      pill.classList.remove('char-select__opponent-pill--ready')
    }

    const localSection = mySlot()
      ? panel.querySelector<HTMLElement>(`[data-online-char-slot="${mySlot()!}"]`)
      : null
    if (localSection) {
      const localPill = localSection.querySelector<HTMLElement>('[data-online-opponent-pill]')
      if (localPill) localPill.remove()
    }
  }

  function applyHeadings(): void {
    const slot = mySlot()
    if (hP1) {
      hP1.textContent = slot === 'p1' ? 'You · Player 1' : 'Opponent · Player 1'
    }
    if (hP2) {
      hP2.textContent = slot === 'p2' ? 'You · Player 2' : 'Opponent · Player 2'
    }
  }

  function paintRow(row: HTMLElement, slot: 'p1' | 'p2'): void {
    row.replaceChildren()
    for (const p of presenters) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = `char-select-card char-select-card--${p.id}`
      btn.dataset.charPick = ''
      btn.dataset.charId = p.id
      btn.dataset.slot = slot
      btn.style.setProperty('--char-accent', p.accentHex)
      btn.setAttribute('aria-pressed', 'false')
      const mine = mySlot() === slot
      btn.disabled = !mine || localReady || (rematchMode && mine)
      btn.setAttribute(
        'aria-label',
        `${mine ? 'You' : 'Opponent'}: ${p.label}, ${p.role}. ${p.tagline}`,
      )

      if (p.portraitSrc) btn.classList.add('char-select-card--has-portrait')
      const fig = createCharSelectCardFigure(p.portraitSrc, p.label)

      const name = document.createElement('span')
      name.className = 'char-select-card__name'
      name.textContent = p.label

      const roleSpan = document.createElement('span')
      roleSpan.className = 'char-select-card__role'
      roleSpan.textContent = p.role

      const tag = document.createElement('span')
      tag.className = 'char-select-card__tagline'
      tag.textContent = p.tagline

      btn.append(fig, name, roleSpan, tag)
      row.appendChild(btn)
    }
  }

  function applyHighlights(): void {
    const localEffective = localConfirmedId ?? localPreviewId
    const remoteEffective = remoteConfirmedId ?? remotePreviewId

    for (const row of [p1Row, p2Row]) {
      for (const btn of row.querySelectorAll<HTMLButtonElement>('[data-char-pick]')) {
        const id = btn.dataset.charId
        const slot = btn.dataset.slot
        const mine = mySlot() === slot
        const effective = mine ? localEffective : remoteEffective
        const on = Boolean(id && effective && id === effective)
        btn.classList.toggle('char-select-card--selected', on)
        btn.setAttribute('aria-pressed', on ? 'true' : 'false')
        const oppReady =
          !mine && Boolean(remoteReady && remoteConfirmedId && id === remoteConfirmedId)
        btn.classList.toggle('char-select-card--opponent-locked', oppReady)
      }
    }

    const pickOk = isValidRosterId(localPreviewId)
    readyBtn.disabled = !pickOk || localReady || !session.hasPeer()
    if (rematchMode) {
      readyBtn.textContent = localReady ? 'Accepted' : 'Accept rematch'
    } else {
      readyBtn.textContent = localReady ? 'Ready' : 'Ready up'
    }

    if (statusEl) {
      if (rematchMode) {
        if (!remoteReady) {
          statusEl.textContent = 'Opponent has not accepted rematch yet.'
        } else {
          statusEl.textContent = `Opponent accepted: ${labelForId(presenters, remoteConfirmedId ?? remotePreviewId)}`
        }
      } else if (!remotePreviewId && !remoteReady) {
        statusEl.textContent = 'Opponent selecting…'
      } else if (remoteReady && remoteConfirmedId) {
        statusEl.textContent = `Opponent ready: ${labelForId(presenters, remoteConfirmedId)}`
      } else if (remotePreviewId) {
        statusEl.textContent = 'Opponent selected'
      } else {
        statusEl.textContent = 'Opponent ready'
      }
    }

    syncOpponentSectionChrome()
  }

  function repaintAll(): void {
    applyHeadings()
    paintRow(p1Row, 'p1')
    paintRow(p2Row, 'p2')
    applyHighlights()
  }

  function onPanelClick(e: MouseEvent): void {
    const pick = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-char-pick]')
    if (!pick || !panel.contains(pick) || pick.disabled) return
    const id = pick.dataset.charId
    const slot = pick.dataset.slot
    if (!id || (slot !== 'p1' && slot !== 'p2')) return
    if (mySlot() !== slot) return
    if (localReady) return
    localPreviewId = id
    session.sendFighterSelected(id)
    const dbg = options.getDebugState()
    console.info('[CHARSEL_UI] fighter_click', {
      charId: id,
      role: session.getRole(),
      roomCode: session.getRoomCode(),
      flowMode: dbg.flowMode,
      vsBotPhase: dbg.vsBotPhase,
    })
    applyHighlights()
  }

  panel.addEventListener('click', onPanelClick)

  readyBtn.addEventListener('click', () => {
    if (readyBtn.disabled || localReady) return
    const pick = localPreviewId
    if (!isValidRosterId(pick)) {
      console.warn('[CHARSEL_UI] ready_blocked reason=no_selected_fighter_id', {
        localPreviewId: pick,
        validRosterIds: [...rosterIds],
      })
      return
    }
    if (rematchMode) {
      if (!session.sendRematchAccept()) {
        console.warn('[CHARSEL_UI] rematch_accept blocked (duplicate or offline)')
        return
      }
    }
    readyButtonClickCount += 1
    const dbg = options.getDebugState()
    console.info('[CHARSEL_UI] ready_click', {
      charId: pick,
      role: session.getRole(),
      roomCode: session.getRoomCode(),
      socketOpen: session.isOpen(),
      peerPresent: session.hasPeer(),
      flowMode: dbg.flowMode,
      vsBotPhase: dbg.vsBotPhase,
      readyClickCount: readyButtonClickCount,
    })
    console.info('[CHARSEL_SEND] outbound player_ready wire shape', {
      type: 'player_ready',
      charId: pick,
    })
    const sent = session.sendPlayerReady(pick)
    if (!sent) {
      console.warn('[CHARSEL_UI] FAIL reason=sendPlayerReady_rejected · UI left not-ready', {
        charId: pick,
        readyClickCount: readyButtonClickCount,
      })
      return
    }
    localReady = true
    localConfirmedId = pick
    console.info('[CHARSEL_UI] local_ready_committed (UI matches session)', {
      charId: localConfirmedId,
      readyClickCount: readyButtonClickCount,
    })
    repaintAll()
    options.onLocalReadyCommitted()
  })

  back.addEventListener('click', () => {
    if (rematchMode) options.onDeclineRematch()
    else options.onBack()
  })

  function applyRematchChrome(): void {
    if (titleEl) {
      titleEl.textContent = rematchMode ? 'Online — rematch' : 'Online — choose fighters'
    }
    ledeDefault?.toggleAttribute('hidden', rematchMode)
    ledeRematch?.toggleAttribute('hidden', !rematchMode)
    back.textContent = rematchMode ? 'Decline (back to menu)' : 'Back'
  }

  const api: OnlineCharacterSelectApi = {
    setRematchMode(active: boolean, hostCharId: string, guestCharId: string): void {
      rematchMode = active
      if (active) {
        const r = session.getRole()
        if (r === 'host') {
          localPreviewId = hostCharId
          remotePreviewId = guestCharId
        } else if (r === 'guest') {
          localPreviewId = guestCharId
          remotePreviewId = hostCharId
        }
        localConfirmedId = null
        localReady = false
        remoteConfirmedId = null
        remoteReady = false
        session.sendFighterSelected(localPreviewId)
      }
      applyRematchChrome()
      api.syncRematchNegotiationUi(active ? 'waiting' : 'idle')
      repaintAll()
    },

    syncRematchNegotiationUi(state: 'idle' | 'waiting' | 'peer_accepted' | 'peer_declined'): void {
      if (!rematchNegotiationEl) return
      if (state === 'idle' || !rematchMode) {
        rematchNegotiationEl.hidden = true
        rematchNegotiationEl.textContent = ''
        rematchNegotiationEl.classList.remove(
          'char-select__rematch-status--ok',
          'char-select__rematch-status--bad',
        )
        return
      }
      rematchNegotiationEl.hidden = false
      rematchNegotiationEl.classList.remove(
        'char-select__rematch-status--ok',
        'char-select__rematch-status--bad',
      )
      if (state === 'waiting') {
        rematchNegotiationEl.textContent = 'Waiting for other player...'
      } else if (state === 'peer_accepted') {
        rematchNegotiationEl.textContent = 'Other player has accepted'
        rematchNegotiationEl.classList.add('char-select__rematch-status--ok')
      } else {
        rematchNegotiationEl.textContent = 'Other player has declined'
        rematchNegotiationEl.classList.add('char-select__rematch-status--bad')
      }
    },

    resetForSession(): void {
      rematchMode = false
      const first = presenters[0]?.id ?? ''
      localPreviewId = first
      localConfirmedId = null
      localReady = false
      remotePreviewId = ''
      remoteConfirmedId = null
      remoteReady = false
      panel.querySelectorAll<HTMLElement>('[data-online-opponent-pill]').forEach((el) => el.remove())
      applyRematchChrome()
      api.syncRematchNegotiationUi('idle')
      repaintAll()
    },

    hydrateFromSessionGate(session: OnlineSession): void {
      const gate = session.getCharSelectGateDebug()
      console.info('[VERIFY_HYDRATE] wire UI from session gate', {
        selfReadyFighter: gate.selfReadyFighter,
        peerReadyFighter: gate.peerReadyFighter,
        role: gate.role,
      })
      if (gate.selfReadyFighter && isValidRosterId(gate.selfReadyFighter)) {
        localPreviewId = gate.selfReadyFighter
        localConfirmedId = gate.selfReadyFighter
        localReady = true
      }
      if (gate.peerReadyFighter && isValidRosterId(gate.peerReadyFighter)) {
        remotePreviewId = gate.peerReadyFighter
        remoteConfirmedId = gate.peerReadyFighter
        remoteReady = true
      }
      repaintAll()
    },

    onPeerFighterSelected(charId: string): void {
      if (remoteReady) return
      remotePreviewId = charId
      console.info('[Toybox Brawlers:OnlineDebug] char_select · remote fighter_selected (preview)', {
        charId,
      })
      applyHighlights()
    },

    onPeerPlayerReady(charId: string): void {
      remoteConfirmedId = charId
      remotePreviewId = charId
      remoteReady = true
      console.info('[Toybox Brawlers:OnlineDebug] char_select · remote player_ready (UI)', { charId })
      applyHighlights()
    },

    getMatchPicksIfComplete(): { hostCharId: string; guestCharId: string } | null {
      if (!localReady || !remoteReady || !localConfirmedId || !remoteConfirmedId) return null
      const r = role()
      if (r === 'host') {
        return { hostCharId: localConfirmedId, guestCharId: remoteConfirmedId }
      }
      if (r === 'guest') {
        return { hostCharId: remoteConfirmedId, guestCharId: localConfirmedId }
      }
      return null
    },

    getSelectionDebug() {
      return {
        localPreviewId,
        localConfirmedId,
        remotePreviewId,
        remoteConfirmedId,
        localReady,
        remoteReady,
      }
    },
  }

  api.resetForSession()
  return api
}
