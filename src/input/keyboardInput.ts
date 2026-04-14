import { ACTION_FROM_CODE, type InputAction } from './bindings'

export type FrameSnapshot = {
  /** Keys held right now (movement, block, crouch). */
  held: ReadonlySet<InputAction>
  /** Became pressed since last `readFrame()` (jump, attacks). */
  pressed: ReadonlySet<InputAction>
  /** Released since last `readFrame()`. */
  released: ReadonlySet<InputAction>
}

const emptyHeld = new Set<InputAction>()
const emptyPressed = new Set<InputAction>()
const emptyReleased = new Set<InputAction>()

/** Neutral input for P2 / replay / bots — do not mutate the inner sets. */
export const EMPTY_FRAME_SNAPSHOT: FrameSnapshot = {
  held: emptyHeld,
  pressed: emptyPressed,
  released: emptyReleased,
}

export type KeyboardInputOptions = {
  /**
   * When true, `preventDefault()` on bound keys so Space/arrows/F/etc. do not scroll or trigger browser UI.
   * Keep false on main menu; enable during matches.
   */
  preventBrowserDefaults?: boolean
}

/**
 * Captures keyboard in the capture phase so shortcuts are handled before bubbling targets.
 */
export class KeyboardInput {
  private readonly held = new Set<InputAction>()
  private readonly downEdge = new Set<InputAction>()
  private readonly upEdge = new Set<InputAction>()

  private preventBrowserDefaults: boolean
  private attached = false
  private readonly onKeyDown = (e: KeyboardEvent) => this.handleKeyDown(e)
  private readonly onKeyUp = (e: KeyboardEvent) => this.handleKeyUp(e)
  private readonly onBlur = () => this.clearAll()

  constructor(options: KeyboardInputOptions = {}) {
    this.preventBrowserDefaults = options.preventBrowserDefaults ?? false
  }

  setPreventBrowserDefaults(value: boolean): void {
    this.preventBrowserDefaults = value
  }

  attach(target: Window = window): void {
    if (this.attached) return
    this.attached = true
    target.addEventListener('keydown', this.onKeyDown, { capture: true })
    target.addEventListener('keyup', this.onKeyUp, { capture: true })
    target.addEventListener('blur', this.onBlur)
  }

  detach(target: Window = window): void {
    if (!this.attached) return
    this.attached = false
    target.removeEventListener('keydown', this.onKeyDown, { capture: true })
    target.removeEventListener('keyup', this.onKeyUp, { capture: true })
    target.removeEventListener('blur', this.onBlur)
    this.clearAll()
  }

  /**
   * Call once per simulation / render frame. Clears edge sets after copying.
   */
  readFrame(): FrameSnapshot {
    const pressed = new Set(this.downEdge)
    const released = new Set(this.upEdge)
    this.downEdge.clear()
    this.upEdge.clear()
    return {
      held: new Set(this.held),
      pressed,
      released,
    }
  }

  /**
   * Drop pending key-down / key-up edges (e.g. when leaving pre-round countdown)
   * so attacks/jumps pressed during the lock are not replayed on frame 1 of the round.
   */
  clearFrameEdges(): void {
    this.downEdge.clear()
    this.upEdge.clear()
  }

  private clearAll(): void {
    this.held.clear()
    this.downEdge.clear()
    this.upEdge.clear()
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const action = ACTION_FROM_CODE[e.code]
    if (!action) return

    if (this.preventBrowserDefaults) {
      e.preventDefault()
    }

    if (e.repeat) {
      return
    }

    if (!this.held.has(action)) {
      this.downEdge.add(action)
    }
    this.held.add(action)
  }

  private handleKeyUp(e: KeyboardEvent): void {
    const action = ACTION_FROM_CODE[e.code]
    if (!action) return

    if (this.preventBrowserDefaults) {
      e.preventDefault()
    }

    if (this.held.delete(action)) {
      this.upEdge.add(action)
    }
  }
}

/** Horizontal intent from held left/right (both = neutral). */
export function readMoveAxis(snapshot: FrameSnapshot): -1 | 0 | 1 {
  const L = snapshot.held.has('left')
  const R = snapshot.held.has('right')
  if (L && R) return 0
  if (L) return -1
  if (R) return 1
  return 0
}

export function createKeyboardInput(options?: KeyboardInputOptions): KeyboardInput {
  return new KeyboardInput(options)
}
