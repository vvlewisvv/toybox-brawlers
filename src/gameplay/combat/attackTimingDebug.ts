import type { AttackKind, AttackPhase } from './attackTimeline'

export type AttackTimingDebugFighter = {
  getAttackTimingDebug(): AttackTimingDebugRow | null
}

export type AttackTimingDebugRow = {
  characterId: string
  attackKind: AttackKind | null
  attackPhase: AttackPhase
  timeInPhase: number
  /** Nominal cycle used for GLB sync (null when not attacking). */
  cycleSeconds: number | null
  startupS: number
  activeS: number
  recoveryMaxS: number
  hitActive: boolean
  activeStartNorm: number | null
  activeEndNorm: number | null
  clipLabel: string | null
  clipDuration: number | null
  clipTime: number | null
  clipNorm: number | null
  playbackSpeed: number | null
}

let enabled = false
let overlayEl: HTMLDivElement | null = null

/** Call once at boot. Enable with `?attackDebug=1` in the URL. */
export function initAttackTimingDebugFromUrl(): void {
  if (typeof window === 'undefined') return
  try {
    const q = new URLSearchParams(window.location.search)
    if (q.get('attackDebug') === '1') {
      enabled = true
      console.info('[Plushdown] attack timing debug overlay on (?attackDebug=1)')
    }
  } catch {
    /* ignore */
  }
}

export function isAttackTimingDebugEnabled(): boolean {
  return enabled
}

function ensureOverlay(): HTMLDivElement {
  if (overlayEl && overlayEl.isConnected) return overlayEl
  const el = document.createElement('div')
  el.id = 'plushdown-attack-debug'
  el.setAttribute('aria-hidden', 'true')
  el.style.cssText = [
    'position:fixed',
    'left:8px',
    'bottom:8px',
    'max-width:min(96vw,520px)',
    'padding:8px 10px',
    'margin:0',
    'z-index:12000',
    'font:11px/1.35 ui-monospace,Menlo,monospace',
    'color:#e8e0dc',
    'background:rgba(12,10,14,0.82)',
    'border:1px solid rgba(255,255,255,0.12)',
    'border-radius:6px',
    'pointer-events:none',
    'white-space:pre-wrap',
    'word-break:break-word',
  ].join(';')
  document.body.appendChild(el)
  overlayEl = el
  return el
}

function hideOverlay(): void {
  if (overlayEl) {
    overlayEl.textContent = ''
    overlayEl.style.display = 'none'
  }
}

function formatRow(label: string, r: AttackTimingDebugRow | null): string {
  if (!r) return `${label}: —`
  const atk = r.attackKind ?? '—'
  const phase = r.attackPhase
  const hit = r.hitActive ? 'Y' : 'n'
  const norm =
    r.activeStartNorm != null && r.activeEndNorm != null
      ? `${r.activeStartNorm.toFixed(3)}–${r.activeEndNorm.toFixed(3)}`
      : '—'
  const clipN = r.clipNorm != null ? r.clipNorm.toFixed(3) : '—'
  const spd = r.playbackSpeed != null ? r.playbackSpeed.toFixed(3) : '—'
  const cyc = r.cycleSeconds != null ? r.cycleSeconds.toFixed(3) : '—'
  const clip = r.clipLabel ?? '—'
  const cd = r.clipDuration != null ? r.clipDuration.toFixed(3) : '—'
  const ct = r.clipTime != null ? r.clipTime.toFixed(3) : '—'
  return [
    `${label} ${r.characterId}`,
    `  atk=${atk} phase=${phase} tPhase=${r.timeInPhase.toFixed(4)} cycle=${cyc}s hit=${hit}`,
    `  activeNorm=${norm}  startup=${r.startupS.toFixed(3)} active=${r.activeS.toFixed(3)} recMax=${r.recoveryMaxS.toFixed(3)}`,
    `  clip=${clip} dur=${cd} t=${ct} norm=${clipN} speed=${spd}`,
  ].join('\n')
}

/** After mixers tick; updates DOM when `?attackDebug=1`. */
export function updateAttackTimingDebugOverlay(
  p1: AttackTimingDebugFighter | null,
  p2: AttackTimingDebugFighter | null,
  show: boolean,
): void {
  if (!enabled) {
    hideOverlay()
    return
  }
  if (!show || !p1 || !p2) {
    const el = ensureOverlay()
    el.style.display = 'block'
    el.textContent = 'attack debug · waiting for match…'
    return
  }
  const el = ensureOverlay()
  el.style.display = 'block'
  const a = p1.getAttackTimingDebug()
  const b = p2.getAttackTimingDebug()
  el.textContent = `${formatRow('P1', a)}\n\n${formatRow('P2', b)}`
}
