export type AppFlowMode =
  | 'main'
  | 'online-lobby'
  | 'online-select'
  | 'vs-bot-select'
  | 'vs-bot-match'
  | 'online-match'
  | 'settings'
  | 'quit'

/** @deprecated Use AppFlowMode */
export type MenuViewId = AppFlowMode

const views: AppFlowMode[] = [
  'main',
  'online-lobby',
  'online-select',
  'vs-bot-select',
  'vs-bot-match',
  'online-match',
  'settings',
  'quit',
]

export type MainMenuMountOptions = {
  /** Fired whenever the visible flow screen changes (including initial `main`). */
  onFlowChange?: (mode: AppFlowMode) => void
}

export type MainMenuController = {
  navigateTo(mode: AppFlowMode): void
}

function setActiveView(
  overlay: HTMLElement,
  root: HTMLElement,
  id: AppFlowMode,
  onFlowChange?: (mode: AppFlowMode) => void,
): void {
  for (const v of views) {
    const el = root.querySelector<HTMLElement>(`[data-menu-view="${v}"]`)
    if (!el) continue
    const active = v === id
    el.classList.toggle('is-active', active)
    el.hidden = !active
    el.setAttribute('aria-hidden', active ? 'false' : 'true')
  }

  root.classList.toggle(
    'main-menu--vs-match',
    id === 'vs-bot-match' || id === 'online-match',
  )
  root.classList.toggle(
    'main-menu--char-select',
    id === 'vs-bot-select' || id === 'online-select',
  )
  overlay.classList.toggle(
    'ui-overlay--vs-match',
    id === 'vs-bot-match' || id === 'online-match',
  )
  overlay.classList.toggle(
    'ui-overlay--char-select',
    id === 'vs-bot-select' || id === 'online-select',
  )

  const focusTarget = root.querySelector<HTMLElement>(
    `[data-menu-view="${id}"] [data-autofocus]`,
  )
  focusTarget?.focus()

  onFlowChange?.(id)
}

/**
 * Main menu + lightweight flow screens (lobby, settings, vs-bot test match HUD).
 */
export function mountMainMenu(
  overlay: HTMLElement,
  options: MainMenuMountOptions = {},
): MainMenuController {
  const { onFlowChange } = options

  overlay.innerHTML = `
    <div class="main-menu" role="application" aria-label="Plushdown">
      <div class="main-menu__panel" data-menu-view="main">
        <h1 class="main-menu__title">Plushdown</h1>
        <p class="main-menu__tagline">1v1 plush fighter</p>
        <nav class="main-menu__nav" aria-label="Primary">
          <button type="button" class="main-menu__btn main-menu__btn--primary" data-go="online-lobby" data-autofocus>
            Play Online
          </button>
          <button type="button" class="main-menu__btn" data-go="vs-bot-select">Vs Bot</button>
          <button type="button" class="main-menu__btn" data-go="settings">Settings</button>
          <button type="button" class="main-menu__btn main-menu__btn--ghost" data-go="quit">Quit</button>
        </nav>
      </div>

      <div class="main-menu__panel" data-menu-view="online-lobby" hidden aria-hidden="true">
        <h2 class="main-menu__heading">Play online</h2>
        <p class="main-menu__body online-lobby__lede">
          Run <code class="inline-code">npm run server</code> in the project folder, then create or join a room.
          Same Wi‑Fi: use this machine’s LAN IP in <code class="inline-code">VITE_WS_URL</code> for the guest browser.
        </p>
        <div class="online-lobby__actions">
          <button type="button" class="main-menu__btn" data-online-queue>
            Quick match
          </button>
          <button type="button" class="main-menu__btn main-menu__btn--primary" data-online-create>
            Create room
          </button>
          <div class="online-lobby__code-row" data-online-code-wrap hidden>
            <span class="online-lobby__code-label">Code</span>
            <code class="online-lobby__code" data-online-code>—</code>
            <button type="button" class="main-menu__btn main-menu__btn--small" data-online-copy>Copy</button>
          </div>
        </div>
        <div class="online-lobby__join">
          <input
            type="text"
            class="online-lobby__input"
            data-online-join-input
            maxlength="12"
            inputmode="numeric"
            pattern="[0-9]*"
            autocomplete="off"
            placeholder="Room id"
            aria-label="Room id"
          />
          <button type="button" class="main-menu__btn" data-online-join>Join</button>
        </div>
        <p class="online-lobby__status" data-online-status role="status"></p>
        <button type="button" class="main-menu__btn" data-online-back data-autofocus>Back</button>
        <div
          class="online-lobby__searching-overlay"
          data-online-searching-overlay
          hidden
          aria-hidden="true"
        >
          <div class="online-lobby__searching-card">
            <p class="online-lobby__searching-title" data-online-searching-dots>Searching</p>
            <p class="online-lobby__searching-hint">Looking for another player</p>
            <p class="online-lobby__searching-subhint">
              Another player must choose Quick match on the same server.
            </p>
            <button type="button" class="main-menu__btn main-menu__btn--ghost" data-online-searching-cancel>
              Cancel queue
            </button>
          </div>
        </div>
      </div>

      <div
        class="main-menu__panel main-menu__panel--char-select"
        data-menu-view="online-select"
        hidden
        aria-hidden="true"
      >
        <h2 class="char-select__title" data-online-char-title>Online — choose fighters</h2>
        <p class="char-select__lede" data-online-char-lede-default>
          Pick a fighter, then press <strong>Ready up</strong> to confirm. When both players are ready, the host starts the countdown.
        </p>
        <p class="char-select__lede" data-online-char-lede-rematch hidden>
          <strong>Rematch</strong> — same fighters as last match. Press <strong>Accept rematch</strong> when ready; both players must accept to start.
        </p>
        <p
          class="char-select__rematch-status"
          data-online-rematch-negotiation
          role="status"
          hidden
        ></p>
        <p class="char-select__lede char-select__lede--subtle" data-online-char-status role="status"></p>
        <section
          class="char-select__block"
          aria-labelledby="online-char-p1-heading"
          data-online-char-slot="p1"
        >
          <h3 id="online-char-p1-heading" class="char-select__slot-title" data-online-char-p1-title>
            Player 1
          </h3>
          <div
            class="char-select__row"
            data-char-row="p1"
            role="group"
            aria-labelledby="online-char-p1-heading"
          ></div>
        </section>
        <section
          class="char-select__block"
          aria-labelledby="online-char-p2-heading"
          data-online-char-slot="p2"
        >
          <h3 id="online-char-p2-heading" class="char-select__slot-title" data-online-char-p2-title>
            Player 2
          </h3>
          <div
            class="char-select__row"
            data-char-row="p2"
            role="group"
            aria-labelledby="online-char-p2-heading"
          ></div>
        </section>
        <div class="char-select__actions char-select__actions--online">
          <button type="button" class="main-menu__btn" data-online-char-back>Back</button>
          <button type="button" class="main-menu__btn main-menu__btn--primary" data-online-char-ready data-autofocus>
            Ready up
          </button>
        </div>
      </div>

      <div
        class="main-menu__panel main-menu__panel--char-select"
        data-menu-view="vs-bot-select"
        hidden
        aria-hidden="true"
      >
        <h2 class="char-select__title" data-vs-bot-char-title>Choose your fighters</h2>
        <p class="char-select__lede" data-vs-bot-char-lede-default>
          Two picks — <strong>you</strong> and the <strong>CPU</strong>. Each loads their own mesh, tuning, and attacks from the shared character framework.
        </p>
        <p class="char-select__lede" data-vs-bot-char-lede-rematch hidden>
          <strong>Rematch</strong> — same fighters. The CPU accepts automatically; press <strong>Accept rematch</strong> to fight again.
        </p>
        <p
          class="char-select__rematch-status char-select__rematch-status--ok"
          data-vs-bot-rematch-status
          role="status"
          hidden
        >
          CPU has accepted rematch.
        </p>
        <section class="char-select__block" aria-labelledby="char-select-p1-heading">
          <h3 id="char-select-p1-heading" class="char-select__slot-title">You · Player 1</h3>
          <div
            class="char-select__row"
            data-char-row="p1"
            role="group"
            aria-labelledby="char-select-p1-heading"
          ></div>
        </section>
        <section class="char-select__block" aria-labelledby="char-select-p2-heading">
          <h3 id="char-select-p2-heading" class="char-select__slot-title">CPU · Player 2</h3>
          <div
            class="char-select__row"
            data-char-row="p2"
            role="group"
            aria-labelledby="char-select-p2-heading"
          ></div>
        </section>
        <div class="char-select__actions">
          <button type="button" class="main-menu__btn" data-vs-bot-char-back>Back</button>
          <button
            type="button"
            class="main-menu__btn main-menu__btn--primary"
            data-vs-bot-char-fight
            data-autofocus
          >
            Fight
          </button>
        </div>
      </div>

      <div
        class="main-menu__panel main-menu__panel--match-hud"
        id="menu-panel-vs-bot"
        data-menu-view="vs-bot-match"
        hidden
        aria-hidden="true"
      >
        <div class="match-hud" role="status">
        <div class="match-hud__title">Vs Bot</div>
        <p class="match-hud__hint">
            Best of 3 · Esc pause · A block · F/D/S attacks · F2 toggles CPU opponent
          </p>
          <p class="match-hud__hint match-hud__hint--subtle">
            Use the top HUD during play. Pause and match results use the in-game overlays.
          </p>
        </div>
      </div>

      <div
        class="main-menu__panel main-menu__panel--match-hud"
        data-menu-view="online-match"
        hidden
        aria-hidden="true"
      >
        <div class="match-hud" role="status">
          <div class="match-hud__title">Online 1v1</div>
          <p class="match-hud__hint">
            Host is P1 (left), guest is P2 (right) · Esc pause · A block · F/D/S attacks · lockstep sync (run the room server)
          </p>
          <p class="match-hud__hint match-hud__hint--subtle">
            Rematch opens fighter select with the same picks; both players accept to continue. Pause → Restart is disabled online.
          </p>
        </div>
      </div>

      <div class="main-menu__panel" data-menu-view="settings" hidden aria-hidden="true">
        <h2 class="main-menu__heading">Settings</h2>
        <div class="settings-violence" role="radiogroup" aria-label="Violence mode">
          <div class="settings-violence__head">
            <span class="settings-violence__title">Violence mode</span>
            <span class="settings-violence__badge">Visual only</span>
          </div>
          <p class="settings-violence__hint">
            Soft: plush-safe bursts and gentle flashes. Chaos: stronger reds, slashes, and punchier particles — still stylized, not realistic gore. Does not change damage, frame timing, or hit detection.
          </p>
          <div class="settings-violence__choices">
            <button
              type="button"
              class="settings-mode-btn"
              data-violence-mode="soft"
              role="radio"
              aria-checked="true"
            >
              <span class="settings-mode-btn__name">Soft</span>
              <span class="settings-mode-btn__sub">Stuffing-safe feedback</span>
            </button>
            <button
              type="button"
              class="settings-mode-btn"
              data-violence-mode="chaos"
              role="radio"
              aria-checked="false"
            >
              <span class="settings-mode-btn__name">Chaos</span>
              <span class="settings-mode-btn__sub">Intense stylized impact</span>
            </button>
          </div>
        </div>
        <ul class="settings-list settings-list--after">
          <li class="settings-list__row settings-list__row--sfx">
            <span class="settings-list__k">Sound effects</span>
            <button
              type="button"
              class="main-menu__btn main-menu__btn--small"
              data-sfx-mute-toggle
              aria-pressed="false"
            >
              SFX on
            </button>
          </li>
          <li class="settings-list__row settings-list__row--music">
            <span class="settings-list__k">Music</span>
            <button
              type="button"
              class="main-menu__btn main-menu__btn--small"
              data-music-mute-toggle
              aria-pressed="false"
            >
              Music on
            </button>
          </li>
        </ul>
        <button type="button" class="main-menu__btn" data-go="main" data-autofocus>Back to menu</button>
      </div>

      <div class="main-menu__panel" data-menu-view="quit" hidden aria-hidden="true">
        <h2 class="main-menu__heading">Leave</h2>
        <p class="main-menu__body">Close this browser tab when you are done. Your progress is not saved to an account.</p>
        <button type="button" class="main-menu__btn" data-go="main" data-autofocus>Back to menu</button>
      </div>
    </div>
  `

  const root = overlay.querySelector<HTMLElement>('.main-menu')
  if (!root) {
    throw new Error('main menu root missing')
  }

  overlay.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-go]')
    if (!t) return
    const go = t.dataset.go
    if (!go || !views.includes(go as AppFlowMode)) return
    setActiveView(overlay, root, go as AppFlowMode, onFlowChange)
  })

  setActiveView(overlay, root, 'main', onFlowChange)

  return {
    navigateTo(mode: AppFlowMode) {
      setActiveView(overlay, root, mode, onFlowChange)
    },
  }
}
