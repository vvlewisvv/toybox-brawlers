export type AppShellMount = {
  canvas: HTMLCanvasElement
  overlay: HTMLElement
  mobileRotateOverlay: HTMLElement
  /** Empty host; combat HUD is mounted here only during match-facing game states. */
  matchHudMount: HTMLElement
  /** Full-viewport vignette for hit / block feedback (no pointer capture). */
  screenPunch: HTMLElement
  /** Center-screen K.O. callout (presentation only). */
  koMoment: HTMLElement
  pauseMenuRoot: HTMLElement
  matchEndRoot: HTMLElement
}

/**
 * Canvas fills the viewport; overlay hosts instant HTML/CSS UI (no asset loading).
 */
export function mountAppShell(root: HTMLElement): AppShellMount {
  root.innerHTML = `
    <div class="app-root" data-plushdown>
      <canvas
        id="stage-canvas"
        class="stage-canvas"
        aria-label="Stage preview"
      ></canvas>
      <div class="ui-overlay" id="ui-overlay"></div>
      <div class="mobile-rotate-overlay" id="mobile-rotate-overlay" hidden aria-hidden="true">
        <div class="mobile-rotate-overlay__card">
          <h2 class="mobile-rotate-overlay__title">Please rotate your phone</h2>
          <p class="mobile-rotate-overlay__sub">Landscape mode is required for mobile gameplay.</p>
        </div>
      </div>
      <div class="in-game-layer" id="pause-menu-root" hidden aria-hidden="true">
        <div class="in-game-modal" role="dialog" aria-modal="true" aria-labelledby="pause-menu-title">
          <h2 class="in-game-modal__title" id="pause-menu-title">Paused</h2>
          <div class="in-game-modal__actions">
            <button type="button" class="main-menu__btn main-menu__btn--primary" data-pause-resume>
              Resume
            </button>
            <button type="button" class="main-menu__btn" data-pause-restart>Restart match</button>
            <button type="button" class="main-menu__btn main-menu__btn--ghost" data-pause-exit-main>
              Exit to main menu
            </button>
          </div>
        </div>
      </div>
      <div class="in-game-layer" id="match-end-root" hidden aria-hidden="true">
        <div class="in-game-modal" role="dialog" aria-modal="true" aria-labelledby="match-end-title">
          <h2 class="in-game-modal__title" id="match-end-title">Match over</h2>
          <p class="in-game-modal__sub" id="match-end-sub"></p>
          <p
            class="in-game-modal__sub in-game-modal__sub--hint"
            id="match-end-rematch-hint"
            data-match-end-rematch-hint
            hidden
          ></p>
          <div class="in-game-modal__actions in-game-modal__actions--stack">
            <button type="button" class="main-menu__btn main-menu__btn--primary" data-match-play-again>
              Play again
            </button>
            <button
              type="button"
              class="main-menu__btn main-menu__btn--ghost"
              data-online-rematch-cancel-vote
              hidden
            >
              Cancel rematch
            </button>
            <button type="button" class="main-menu__btn" data-match-online-leave hidden>
              Leave match
            </button>
            <button type="button" class="main-menu__btn main-menu__btn--ghost" data-match-exit-main>
              Exit to main menu
            </button>
          </div>
        </div>
      </div>
      <div class="screen-punch" id="screen-punch" aria-hidden="true"></div>
      <div class="ko-moment" id="ko-moment" hidden aria-hidden="true">
        <span class="ko-moment__text">K.O.</span>
      </div>
      <div id="match-hud-mount" class="match-hud-mount" aria-hidden="true"></div>
    </div>
  `
  const canvas = root.querySelector<HTMLCanvasElement>('#stage-canvas')
  const overlay = root.querySelector<HTMLElement>('#ui-overlay')
  const mobileRotateOverlay = root.querySelector<HTMLElement>('#mobile-rotate-overlay')
  const matchHudMount = root.querySelector<HTMLElement>('#match-hud-mount')
  const screenPunch = root.querySelector<HTMLElement>('#screen-punch')
  const koMoment = root.querySelector<HTMLElement>('#ko-moment')
  const pauseMenuRoot = root.querySelector<HTMLElement>('#pause-menu-root')
  const matchEndRoot = root.querySelector<HTMLElement>('#match-end-root')
  if (
    !canvas ||
    !overlay ||
    !mobileRotateOverlay ||
    !matchHudMount ||
    !screenPunch ||
    !koMoment ||
    !pauseMenuRoot ||
    !matchEndRoot
  ) {
    throw new Error('stage shell missing required nodes')
  }
  return {
    canvas,
    overlay,
    mobileRotateOverlay,
    matchHudMount,
    screenPunch,
    koMoment,
    pauseMenuRoot,
    matchEndRoot,
  }
}
