export type MatchHudStats = {
  p1: { current: number; max: number }
  p2: { current: number; max: number }
  roundSecondsLeft: number
  p1Wins: number
  p2Wins: number
  /** e.g. "Round 2" */
  roundLabel: string
  /** Short line (K.O., time, draw, match winner); null hides banner. */
  banner: string | null
  /** Pre-round 3-2-1; null hides fullscreen countdown overlay. */
  countdown: string | null
  /** Left column tag (screen-left fighter); default unchanged if omitted. */
  leftLabel?: string
  /** Right column tag (screen-right fighter). */
  rightLabel?: string
  leftHealthAriaLabel?: string
  rightHealthAriaLabel?: string
}

/** Markup for the combat HUD root (mounted only during match-facing states). */
const COMBAT_HUD_INNER_HTML = `
        <div class="match-hud__meta" aria-hidden="false">
          <span class="match-hud__score" id="match-hud-score">0 — 0</span>
          <span class="match-hud__round" id="match-hud-round">Round 1</span>
        </div>
        <div class="match-hud__banner" id="match-hud-banner" role="status" aria-live="polite" hidden></div>
        <div
          class="match-hud__countdown"
          id="match-hud-countdown"
          role="status"
          aria-live="assertive"
          aria-atomic="true"
          aria-hidden="true"
          hidden
        ></div>
        <div class="match-hud__row">
          <div class="match-hud__side match-hud__side--left">
            <span class="match-hud__tag" id="match-hud-tag-left">You</span>
            <div class="match-hud__track">
              <div class="match-hud__fill match-hud__fill--p1" id="match-hud-p1-fill"></div>
            </div>
            <span class="match-hud__hp" id="match-hud-p1-text" aria-label="Your health"></span>
          </div>
          <div class="match-hud__timer-wrap">
            <span class="match-hud__timer-label">Time</span>
            <span class="match-hud__timer" id="match-hud-timer" role="timer" aria-live="polite">0:00</span>
          </div>
          <div class="match-hud__side match-hud__side--right">
            <span class="match-hud__tag" id="match-hud-tag-right">Bot</span>
            <div class="match-hud__track match-hud__track--mirror">
              <div class="match-hud__fill match-hud__fill--p2" id="match-hud-p2-fill"></div>
            </div>
            <span class="match-hud__hp" id="match-hud-p2-text" aria-label="Bot health"></span>
          </div>
        </div>
`

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

function pct(current: number, max: number): number {
  if (max <= 0) return 0
  return Math.max(0, Math.min(100, (current / max) * 100))
}

export function createMatchHudController(root: HTMLElement) {
  const p1Fill = root.querySelector<HTMLElement>('#match-hud-p1-fill')
  const p2Fill = root.querySelector<HTMLElement>('#match-hud-p2-fill')
  const p1Text = root.querySelector<HTMLElement>('#match-hud-p1-text')
  const p2Text = root.querySelector<HTMLElement>('#match-hud-p2-text')
  const tagLeft = root.querySelector<HTMLElement>('#match-hud-tag-left')
  const tagRight = root.querySelector<HTMLElement>('#match-hud-tag-right')
  const timerEl = root.querySelector<HTMLElement>('#match-hud-timer')
  const scoreEl = root.querySelector<HTMLElement>('#match-hud-score')
  const roundEl = root.querySelector<HTMLElement>('#match-hud-round')
  const bannerEl = root.querySelector<HTMLElement>('#match-hud-banner')
  const countdownEl = root.querySelector<HTMLElement>('#match-hud-countdown')

  if (!p1Fill || !p2Fill || !p1Text || !p2Text || !timerEl) {
    throw new Error('match HUD nodes missing')
  }
  if (!scoreEl || !roundEl || !bannerEl || !countdownEl) {
    throw new Error('match HUD score/round/banner/countdown nodes missing')
  }

  return {
    update(stats: MatchHudStats): void {
      if (stats.leftLabel != null && tagLeft) {
        tagLeft.textContent = stats.leftLabel
      }
      if (stats.rightLabel != null && tagRight) {
        tagRight.textContent = stats.rightLabel
      }
      if (stats.leftHealthAriaLabel != null) {
        p1Text.setAttribute('aria-label', stats.leftHealthAriaLabel)
      }
      if (stats.rightHealthAriaLabel != null) {
        p2Text.setAttribute('aria-label', stats.rightHealthAriaLabel)
      }
      const p1 = pct(stats.p1.current, stats.p1.max)
      const p2 = pct(stats.p2.current, stats.p2.max)
      p1Fill.style.width = `${p1}%`
      p2Fill.style.width = `${p2}%`
      p1Text.textContent = `${Math.ceil(stats.p1.current)} / ${stats.p1.max}`
      p2Text.textContent = `${Math.ceil(stats.p2.current)} / ${stats.p2.max}`
      timerEl.textContent = formatTime(stats.roundSecondsLeft)
      scoreEl.textContent = `${stats.p1Wins} — ${stats.p2Wins}`
      roundEl.textContent = stats.roundLabel
      if (stats.banner) {
        bannerEl.hidden = false
        bannerEl.textContent = stats.banner
      } else {
        bannerEl.hidden = true
        bannerEl.textContent = ''
      }
      if (stats.countdown) {
        countdownEl.hidden = false
        countdownEl.textContent = stats.countdown
        countdownEl.setAttribute('aria-hidden', 'false')
      } else {
        countdownEl.hidden = true
        countdownEl.textContent = ''
        countdownEl.setAttribute('aria-hidden', 'true')
      }
    },
  }
}

export type MatchHudController = ReturnType<typeof createMatchHudController>

/**
 * Creates the combat HUD DOM, appends it under `mountHost`, and returns a controller.
 * Call `unmount()` when leaving match-facing states so the node is removed from the document.
 */
export function mountCombatMatchHud(mountHost: HTMLElement): {
  controller: MatchHudController
  unmount: () => void
} {
  const root = document.createElement('div')
  root.id = 'match-hud'
  root.className = 'match-hud match-hud--overlay'
  root.setAttribute('aria-hidden', 'false')
  root.innerHTML = COMBAT_HUD_INNER_HTML
  mountHost.appendChild(root)

  const controller = createMatchHudController(root)

  return {
    controller,
    unmount: () => {
      root.remove()
    },
  }
}
