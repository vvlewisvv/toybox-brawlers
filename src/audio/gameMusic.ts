import { getSharedAudioContext, primeSharedAudioContext } from './sharedAudioContext'

const MUTE_KEY = 'plushdown-music-muted'

/** Post-mix gain; keep under SFX so hits read clearly. */
const MUSIC_MASTER = 0.11

function loadMuted(): boolean {
  try {
    return globalThis.localStorage?.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

let musicMuted = loadMuted()

export function isMusicMuted(): boolean {
  return musicMuted
}

export function setMusicMuted(value: boolean): void {
  musicMuted = value
  try {
    if (value) globalThis.localStorage?.setItem(MUTE_KEY, '1')
    else globalThis.localStorage.removeItem(MUTE_KEY)
  } catch {
    /* ignore */
  }
}

export type MusicScene = 'menu' | 'match'

/** Deterministic “noise” for hats (seamless loop). */
function hatGrain(i: number, step: number): number {
  const x = Math.sin(i * 0.211 + step * 9.17) * Math.cos(i * 0.097 + step * 3.41)
  return x * x * Math.sign(x)
}

/**
 * Lightweight synthetic loops — no assets. To swap later:
 * - Replace `synthesizeMenuLoop` / `synthesizeMatchLoop` with decoded `AudioBuffer`s from files, or
 * - Add `fetch` + `decodeAudioData` in `GameMusic.prime()` and assign to `bufferMenu` / `bufferMatch`.
 */
function synthesizeMenuLoop(c: BaseAudioContext): AudioBuffer {
  return mixEnergeticLoop(c, {
    bpm: 118,
    bassRoot: 65.41, // C2
    pulseEverySteps: 2,
    hatGain: 0.055,
    kickGain: 0.42,
    bassGain: 0.14,
    brightness: 1,
  })
}

function synthesizeMatchLoop(c: BaseAudioContext): AudioBuffer {
  return mixEnergeticLoop(c, {
    bpm: 138,
    bassRoot: 55.0, // A1
    pulseEverySteps: 2,
    hatGain: 0.072,
    kickGain: 0.5,
    bassGain: 0.17,
    brightness: 1.12,
  })
}

function mixEnergeticLoop(
  c: BaseAudioContext,
  o: {
    bpm: number
    bassRoot: number
    pulseEverySteps: number
    hatGain: number
    kickGain: number
    bassGain: number
    brightness: number
  },
): AudioBuffer {
  const sampleRate = c.sampleRate
  const stepsPerBeat = 2
  const beats = 8
  const totalSec = beats * (60 / o.bpm)
  const N = Math.floor(totalSec * sampleRate)
  const stepSamples = (60 / o.bpm / stepsPerBeat) * sampleRate

  const buf = c.createBuffer(2, N, sampleRate)
  const L = buf.getChannelData(0)
  const R = buf.getChannelData(1)

  for (let i = 0; i < N; i++) {
    const t = i / sampleRate
    const step = Math.floor(i / stepSamples)
    const stepFrac = i / stepSamples - step
    const beat = i / stepSamples / stepsPerBeat
    const beatFrac = beat - Math.floor(beat)

    let s = 0

    // Kick on quarter notes
    if (step % (stepsPerBeat * o.pulseEverySteps) === 0) {
      const k = Math.exp(-beatFrac * 22)
      if (beatFrac < 0.11) {
        const pitch = 58 + 140 * (1 - beatFrac / 0.11)
        s += o.kickGain * k * Math.sin(2 * Math.PI * pitch * t)
      }
    }

    // Offbeat / 8th hats
    const hatStep = step % 2
    if (hatStep === 1 || (step % 4 === 2 && o.brightness > 1)) {
      const h = Math.exp(-stepFrac * 55)
      s += o.hatGain * h * hatGrain(i, step) * o.brightness
    }

    // Bass pulse — root + fifth on bar half
    const barStep = step % 16
    const note =
      barStep >= 8 ? o.bassRoot * 1.5 * o.brightness : o.bassRoot * o.brightness
    const gate = beatFrac < 0.88 ? 1 : 0
    const att = beatFrac < 0.04 ? beatFrac / 0.04 : 1
    s += o.bassGain * att * gate * Math.sin(2 * Math.PI * note * t)

    // Simple “lead” ping — menu brighter, match slightly sharper
    const pingEvery = Math.floor(beat / 2)
    if (pingEvery % 2 === 0 && beatFrac > 0.12 && beatFrac < 0.2) {
      const f = 440 * o.brightness * (pingEvery % 4 === 0 ? 1 : 1.25)
      const e = Math.sin(((beatFrac - 0.12) / 0.08) * Math.PI)
      s += 0.045 * e * Math.sin(2 * Math.PI * f * t)
    }

    L[i] = s * 0.9
    R[i] = s * 0.88
  }

  return buf
}

export class GameMusic {
  private bufferMenu: AudioBuffer | null = null
  private bufferMatch: AudioBuffer | null = null
  private scene: MusicScene = 'menu'
  private outGain: GainNode | null = null
  private source: AudioBufferSourceNode | null = null
  private playingBuffer: AudioBuffer | null = null

  /** Same gesture as SFX — call from first pointerdown. */
  prime(): void {
    primeSharedAudioContext()
    void getSharedAudioContext()
    this.refreshPlayback()
  }

  setScene(scene: MusicScene): void {
    if (this.scene === scene) return
    this.scene = scene
    this.refreshPlayback()
  }

  getScene(): MusicScene {
    return this.scene
  }

  /** Call after mute toggle so playback matches state. */
  refreshPlayback(): void {
    if (musicMuted) {
      this.stopLoop()
      return
    }
    const c = getSharedAudioContext()
    if (!c) return
    if (!this.bufferMenu) this.bufferMenu = synthesizeMenuLoop(c)
    if (!this.bufferMatch) this.bufferMatch = synthesizeMatchLoop(c)
    const buf = this.scene === 'menu' ? this.bufferMenu : this.bufferMatch
    if (!buf) return
    if (this.source && this.playingBuffer === buf) return

    this.stopLoop()

    if (!this.outGain) {
      this.outGain = c.createGain()
      this.outGain.gain.value = MUSIC_MASTER
      this.outGain.connect(c.destination)
    }

    const src = c.createBufferSource()
    src.buffer = buf
    src.loop = true
    src.connect(this.outGain)
    const now = c.currentTime
    src.start(now)
    this.source = src
    this.playingBuffer = buf
  }

  private stopLoop(): void {
    try {
      this.source?.stop()
    } catch {
      /* already stopped */
    }
    this.source?.disconnect()
    this.source = null
    this.playingBuffer = null
  }
}

export const gameMusic = new GameMusic()
