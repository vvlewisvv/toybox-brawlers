import type { AttackKind } from '../gameplay/combat/attackTimeline'
import { getSharedAudioContext, primeSharedAudioContext } from './sharedAudioContext'

const MUTE_KEY = 'plushdown-sfx-muted'

/** Master linear gain (post-normalization). */
const MASTER = 0.28

function loadMuted(): boolean {
  try {
    return globalThis.localStorage?.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

let muted = loadMuted()

export function isSfxMuted(): boolean {
  return muted
}

export function setSfxMuted(value: boolean): void {
  muted = value
  try {
    if (value) globalThis.localStorage?.setItem(MUTE_KEY, '1')
    else globalThis.localStorage?.removeItem(MUTE_KEY)
  } catch {
    /* ignore */
  }
}

export function toggleSfxMuted(): boolean {
  setSfxMuted(!muted)
  return muted
}

let sfxNoiseBuffer: AudioBuffer | null = null

function ensureSfxNoiseBuffer(c: AudioContext): void {
  if (sfxNoiseBuffer) return
  const dur = 0.06
  const n = Math.floor(c.sampleRate * dur)
  const buf = c.createBuffer(1, n, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
  sfxNoiseBuffer = buf
}

/**
 * Procedural Web Audio SFX — no asset files, low memory, resumes after user gesture.
 */
export class GameSfx {
  /** Call from first click/tap so AudioContext can run (browser autoplay policy). */
  prime(): void {
    primeSharedAudioContext()
    const c = getSharedAudioContext()
    if (c) ensureSfxNoiseBuffer(c)
  }

  private ensure(): AudioContext | null {
    if (muted) return null
    primeSharedAudioContext()
    const c = getSharedAudioContext()
    if (!c) return null
    ensureSfxNoiseBuffer(c)
    return c
  }

  private gainEnvelope(g: GainNode, t0: number, peak: number, attack: number, decay: number): void {
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(peak, t0 + attack)
    g.gain.exponentialRampToValueAtTime(Math.max(1e-4, peak * 0.02), t0 + attack + decay)
  }

  playUiClick(): void {
    const c = this.ensure()
    if (!c) return
    const t0 = c.currentTime
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(1560, t0)
    o.frequency.exponentialRampToValueAtTime(920, t0 + 0.038)
    this.gainEnvelope(g, t0, MASTER * 0.55, 0.002, 0.045)
    o.connect(g)
    g.connect(c.destination)
    o.start(t0)
    o.stop(t0 + 0.065)
  }

  playFootstep(): void {
    const c = this.ensure()
    if (!c || !sfxNoiseBuffer) return
    const t0 = c.currentTime
    const src = c.createBufferSource()
    src.buffer = sfxNoiseBuffer
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.setValueAtTime(420, t0)
    const g = c.createGain()
    this.gainEnvelope(g, t0, MASTER * 0.14, 0.004, 0.028)
    src.connect(f)
    f.connect(g)
    g.connect(c.destination)
    src.start(t0)
    src.stop(t0 + 0.05)
  }

  playJump(): void {
    const c = this.ensure()
    if (!c) return
    const t0 = c.currentTime
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'triangle'
    o.frequency.setValueAtTime(185, t0)
    o.frequency.exponentialRampToValueAtTime(620, t0 + 0.07)
    this.gainEnvelope(g, t0, MASTER * 0.32, 0.006, 0.09)
    o.connect(g)
    g.connect(c.destination)
    o.start(t0)
    o.stop(t0 + 0.12)
  }

  playLand(): void {
    const c = this.ensure()
    if (!c || !sfxNoiseBuffer) return
    const t0 = c.currentTime
    const src = c.createBufferSource()
    src.buffer = sfxNoiseBuffer
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.setValueAtTime(280, t0)
    f.frequency.exponentialRampToValueAtTime(90, t0 + 0.1)
    const g = c.createGain()
    this.gainEnvelope(g, t0, MASTER * 0.38, 0.002, 0.11)
    src.connect(f)
    f.connect(g)
    g.connect(c.destination)
    src.start(t0)
    src.stop(t0 + 0.14)
  }

  playAttackWind(kind: AttackKind): void {
    const c = this.ensure()
    if (!c || !sfxNoiseBuffer) return
    const t0 = c.currentTime
    const peak =
      kind === 'special' ? MASTER * 0.26 : kind === 'heavy' ? MASTER * 0.22 : MASTER * 0.18
    const decay = kind === 'special' ? 0.055 : kind === 'heavy' ? 0.045 : 0.035
    const src = c.createBufferSource()
    src.buffer = sfxNoiseBuffer
    const f = c.createBiquadFilter()
    f.type = 'bandpass'
    const mid = kind === 'special' ? 2100 : kind === 'heavy' ? 1400 : 1800
    f.frequency.setValueAtTime(mid, t0)
    f.Q.setValueAtTime(kind === 'light' ? 1.2 : 0.85, t0)
    const g = c.createGain()
    this.gainEnvelope(g, t0, peak, 0.003, decay)
    src.connect(f)
    f.connect(g)
    g.connect(c.destination)
    src.start(t0)
    src.stop(t0 + decay + 0.02)
  }

  playHit(blocked: boolean, strikeKind: AttackKind): void {
    const c = this.ensure()
    if (!c || !sfxNoiseBuffer) return
    const t0 = c.currentTime
    const src = c.createBufferSource()
    src.buffer = sfxNoiseBuffer
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    if (blocked) {
      f.frequency.setValueAtTime(2800, t0)
      f.frequency.exponentialRampToValueAtTime(700, t0 + 0.05)
      const g = c.createGain()
      this.gainEnvelope(g, t0, MASTER * 0.2, 0.001, 0.05)
      src.connect(f)
      f.connect(g)
      g.connect(c.destination)
      src.start(t0)
      src.stop(t0 + 0.07)
      return
    }
    const bump =
      strikeKind === 'special' ? 1.25 : strikeKind === 'heavy' ? 1.12 : 1
    f.frequency.setValueAtTime(520 * bump, t0)
    f.frequency.exponentialRampToValueAtTime(110, t0 + 0.09)
    const g = c.createGain()
    this.gainEnvelope(g, t0, MASTER * 0.48 * bump, 0.001, 0.085)
    src.connect(f)
    f.connect(g)
    g.connect(c.destination)
    src.start(t0)
    src.stop(t0 + 0.11)
  }

  playKo(): void {
    const c = this.ensure()
    if (!c) return
    const t0 = c.currentTime
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(220, t0)
    o.frequency.exponentialRampToValueAtTime(55, t0 + 0.35)
    this.gainEnvelope(g, t0, MASTER * 0.42, 0.02, 0.38)
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.setValueAtTime(900, t0)
    f.frequency.exponentialRampToValueAtTime(200, t0 + 0.35)
    o.connect(f)
    f.connect(g)
    g.connect(c.destination)
    o.start(t0)
    o.stop(t0 + 0.42)
  }

  /** Countdown number 3, 2, 1 — slightly lower pitch as it approaches zero. */
  playCountdownTick(n: number): void {
    const c = this.ensure()
    if (!c) return
    const t0 = c.currentTime
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'sine'
    const hz = 520 + n * 95
    o.frequency.setValueAtTime(hz, t0)
    this.gainEnvelope(g, t0, MASTER * 0.4, 0.004, 0.09)
    o.connect(g)
    g.connect(c.destination)
    o.start(t0)
    o.stop(t0 + 0.12)
  }

  playFightGo(): void {
    const c = this.ensure()
    if (!c) return
    const t0 = c.currentTime
    const o1 = c.createOscillator()
    const o2 = c.createOscillator()
    const g = c.createGain()
    o1.type = 'triangle'
    o2.type = 'triangle'
    o1.frequency.setValueAtTime(330, t0)
    o2.frequency.setValueAtTime(495, t0)
    this.gainEnvelope(g, t0, MASTER * 0.36, 0.006, 0.14)
    o1.connect(g)
    o2.connect(g)
    g.connect(c.destination)
    o1.start(t0)
    o2.start(t0)
    o1.stop(t0 + 0.18)
    o2.stop(t0 + 0.18)
  }
}

export const gameSfx = new GameSfx()
