import type { FrameSnapshot } from './keyboardInput'
import type { InputAction } from './bindings'

const STICK_DEADZONE = 0.22
const STICK_JUMP_DEADZONE = 0.5
const STICK_MAX_RADIUS_PX = 54

function supportsTouchControls(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: coarse)').matches
}

export class MobileTouchInput {
  private readonly held = new Set<InputAction>()
  private readonly downEdge = new Set<InputAction>()
  private readonly upEdge = new Set<InputAction>()

  private rootEl: HTMLElement | null = null
  private stickAreaEl: HTMLElement | null = null
  private stickBaseEl: HTMLElement | null = null
  private stickKnobEl: HTMLElement | null = null
  private actionBtnByAction = new Map<InputAction, HTMLButtonElement>()

  private attached = false
  private touchCapable = false
  private controlsActive = false

  private joystickPointerId: number | null = null
  private joystickCx = 0
  private joystickCy = 0
  private stickX = 0
  private stickY = 0
  private jumpHeldByStick = false

  private buttonPointerByAction = new Map<InputAction, number>()
  private buttonActionByPointer = new Map<number, InputAction>()

  private readonly onWindowPointerUp = (e: PointerEvent) => this.handlePointerRelease(e)
  private readonly onWindowPointerCancel = (e: PointerEvent) => this.handlePointerRelease(e)

  attach(host: HTMLElement): void {
    if (this.attached) return
    this.attached = true
    this.touchCapable = supportsTouchControls()
    if (!this.touchCapable) return

    const root = document.createElement('div')
    root.className = 'mobile-controls'
    root.classList.add('mobile-controls--hidden')
    root.dataset.mobileControls = ''

    const left = document.createElement('div')
    left.className = 'mobile-controls__left'
    const stickArea = document.createElement('div')
    stickArea.className = 'mobile-stick__area'
    const stickBase = document.createElement('div')
    stickBase.className = 'mobile-stick__base'
    const stickKnob = document.createElement('div')
    stickKnob.className = 'mobile-stick__knob'
    stickBase.appendChild(stickKnob)
    stickArea.appendChild(stickBase)
    left.appendChild(stickArea)

    const right = document.createElement('div')
    right.className = 'mobile-controls__right'
    const mkBtn = (label: string, action: InputAction): HTMLButtonElement => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'mobile-action-btn'
      b.dataset.action = action
      b.textContent = label
      right.appendChild(b)
      this.actionBtnByAction.set(action, b)
      return b
    }
    mkBtn('Light', 'light')
    mkBtn('Medium', 'heavy')
    mkBtn('Heavy', 'special')

    root.append(left, right)
    host.appendChild(root)

    this.rootEl = root
    this.stickAreaEl = stickArea
    this.stickBaseEl = stickBase
    this.stickKnobEl = stickKnob

    stickArea.addEventListener('pointerdown', this.onStickPointerDown)
    stickArea.addEventListener('pointermove', this.onStickPointerMove)
    stickArea.addEventListener('pointerleave', this.onStickPointerLeave)

    for (const btn of this.actionBtnByAction.values()) {
      btn.addEventListener('pointerdown', this.onActionPointerDown)
      btn.addEventListener('pointerup', this.onActionPointerUp)
      btn.addEventListener('pointercancel', this.onActionPointerCancel)
      btn.addEventListener('pointerleave', this.onActionPointerLeave)
    }

    window.addEventListener('pointerup', this.onWindowPointerUp, { capture: true })
    window.addEventListener('pointercancel', this.onWindowPointerCancel, { capture: true })
  }

  detach(): void {
    if (!this.attached) return
    this.attached = false
    this.clearAll()

    this.stickAreaEl?.removeEventListener('pointerdown', this.onStickPointerDown)
    this.stickAreaEl?.removeEventListener('pointermove', this.onStickPointerMove)
    this.stickAreaEl?.removeEventListener('pointerleave', this.onStickPointerLeave)
    for (const btn of this.actionBtnByAction.values()) {
      btn.removeEventListener('pointerdown', this.onActionPointerDown)
      btn.removeEventListener('pointerup', this.onActionPointerUp)
      btn.removeEventListener('pointercancel', this.onActionPointerCancel)
      btn.removeEventListener('pointerleave', this.onActionPointerLeave)
    }
    window.removeEventListener('pointerup', this.onWindowPointerUp, { capture: true })
    window.removeEventListener('pointercancel', this.onWindowPointerCancel, { capture: true })

    this.rootEl?.remove()
    this.rootEl = null
    this.stickAreaEl = null
    this.stickBaseEl = null
    this.stickKnobEl = null
    this.actionBtnByAction.clear()
  }

  readFrame(): FrameSnapshot {
    if (!this.controlsActive) {
      this.downEdge.clear()
      this.upEdge.clear()
      return {
        held: new Set(),
        pressed: new Set(),
        released: new Set(),
      }
    }
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

  setCombatActive(active: boolean): void {
    if (!this.touchCapable) return
    if (this.controlsActive === active) return
    this.controlsActive = active
    if (!active) {
      this.clearAll()
      this.updateStickVisual()
      for (const btn of this.actionBtnByAction.values()) {
        btn.classList.remove('mobile-action-btn--active')
      }
    }
    this.rootEl?.classList.toggle('mobile-controls--hidden', !active)
  }

  private readonly onStickPointerDown = (e: PointerEvent): void => {
    if (!this.controlsActive || this.stickAreaEl == null || this.stickBaseEl == null) return
    e.preventDefault()
    if (this.joystickPointerId !== null) return
    this.joystickPointerId = e.pointerId
    this.stickAreaEl.setPointerCapture(e.pointerId)
    const rect = this.stickAreaEl.getBoundingClientRect()
    this.joystickCx = rect.left + rect.width * 0.5
    this.joystickCy = rect.top + rect.height * 0.5
    this.updateStickFromClient(e.clientX, e.clientY)
  }

  private readonly onStickPointerMove = (e: PointerEvent): void => {
    if (!this.controlsActive) return
    if (e.pointerId !== this.joystickPointerId) return
    e.preventDefault()
    this.updateStickFromClient(e.clientX, e.clientY)
  }

  private readonly onStickPointerLeave = (e: PointerEvent): void => {
    if (!this.controlsActive) return
    if (e.pointerId !== this.joystickPointerId) return
    this.releaseJoystickPointer(e.pointerId)
  }

  private readonly onActionPointerDown = (e: PointerEvent): void => {
    if (!this.controlsActive) return
    const btn = e.currentTarget as HTMLButtonElement
    const action = btn.dataset.action as InputAction | undefined
    if (!action) return
    if (this.buttonPointerByAction.has(action)) return
    e.preventDefault()
    btn.setPointerCapture(e.pointerId)
    this.buttonPointerByAction.set(action, e.pointerId)
    this.buttonActionByPointer.set(e.pointerId, action)
    if (!this.held.has(action)) this.downEdge.add(action)
    this.held.add(action)
    btn.classList.add('mobile-action-btn--active')
  }

  private readonly onActionPointerUp = (e: PointerEvent): void => {
    if (!this.controlsActive) return
    this.releaseButtonPointer(e.pointerId)
  }

  private readonly onActionPointerCancel = (e: PointerEvent): void => {
    if (!this.controlsActive) return
    this.releaseButtonPointer(e.pointerId)
  }

  private readonly onActionPointerLeave = (e: PointerEvent): void => {
    if (!this.controlsActive) return
    this.releaseButtonPointer(e.pointerId)
  }

  private handlePointerRelease(e: PointerEvent): void {
    if (!this.controlsActive) return
    if (e.pointerId === this.joystickPointerId) {
      this.releaseJoystickPointer(e.pointerId)
    }
    if (this.buttonActionByPointer.has(e.pointerId)) {
      this.releaseButtonPointer(e.pointerId)
    }
  }

  private releaseJoystickPointer(pointerId: number): void {
    if (this.joystickPointerId !== pointerId) return
    this.joystickPointerId = null
    this.stickX = 0
    this.stickY = 0
    this.applyStickActions()
    this.updateStickVisual()
  }

  private releaseButtonPointer(pointerId: number): void {
    const action = this.buttonActionByPointer.get(pointerId)
    if (!action) return
    this.buttonActionByPointer.delete(pointerId)
    this.buttonPointerByAction.delete(action)
    if (this.held.delete(action)) {
      this.upEdge.add(action)
    }
    this.actionBtnByAction.get(action)?.classList.remove('mobile-action-btn--active')
  }

  private updateStickFromClient(clientX: number, clientY: number): void {
    const dx = clientX - this.joystickCx
    const dy = clientY - this.joystickCy
    const dist = Math.hypot(dx, dy)
    const clamped = Math.min(STICK_MAX_RADIUS_PX, dist)
    const nx = dist > 1e-6 ? dx / dist : 0
    const ny = dist > 1e-6 ? dy / dist : 0
    this.stickX = (nx * clamped) / STICK_MAX_RADIUS_PX
    this.stickY = (ny * clamped) / STICK_MAX_RADIUS_PX
    this.applyStickActions()
    this.updateStickVisual()
  }

  private applyStickActions(): void {
    const moveLeft = this.stickX < -STICK_DEADZONE
    const moveRight = this.stickX > STICK_DEADZONE
    const jumpOn = this.stickY < -STICK_JUMP_DEADZONE

    this.setHeldState('left', moveLeft)
    this.setHeldState('right', moveRight)

    if (jumpOn) {
      if (!this.jumpHeldByStick) {
        this.downEdge.add('jump')
      }
      this.jumpHeldByStick = true
      this.held.add('jump')
    } else if (this.jumpHeldByStick) {
      this.jumpHeldByStick = false
      if (this.held.delete('jump')) {
        this.upEdge.add('jump')
      }
    }
  }

  private setHeldState(action: InputAction, on: boolean): void {
    if (on) {
      this.held.add(action)
    } else if (this.held.delete(action)) {
      this.upEdge.add(action)
    }
  }

  private updateStickVisual(): void {
    if (!this.stickKnobEl) return
    const tx = this.stickX * STICK_MAX_RADIUS_PX
    const ty = this.stickY * STICK_MAX_RADIUS_PX
    this.stickKnobEl.style.transform = `translate(${tx}px, ${ty}px)`
  }

  private clearAll(): void {
    this.joystickPointerId = null
    this.stickX = 0
    this.stickY = 0
    this.jumpHeldByStick = false
    this.buttonActionByPointer.clear()
    this.buttonPointerByAction.clear()
    this.held.clear()
    this.downEdge.clear()
    this.upEdge.clear()
  }
}

export function createMobileTouchInput(): MobileTouchInput {
  return new MobileTouchInput()
}

