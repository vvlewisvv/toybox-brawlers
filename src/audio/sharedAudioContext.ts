/**
 * Single AudioContext for SFX + music (one user gesture to resume, lower overhead).
 */

let audioContext: AudioContext | null = null

export function primeSharedAudioContext(): void {
  if (audioContext) return
  const Ctx =
    globalThis.AudioContext ??
    (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return
  try {
    audioContext = new Ctx()
  } catch {
    audioContext = null
  }
}

export function getSharedAudioContext(): AudioContext | null {
  const c = audioContext
  if (!c) return null
  if (c.state === 'suspended') void c.resume()
  return c
}
