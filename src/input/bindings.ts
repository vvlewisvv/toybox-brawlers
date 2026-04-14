/**
 * Physical keys (`KeyboardEvent.code`) → logical actions. Layout-independent (QWERTY vs AZERTY differs on letters but codes are stable).
 *
 * Default P1 layout:
 * - Arrows: Left/Right move, Up jump, Down crouch
 * - Space: jump
 * - A block, F light, D medium (heavy), S heavy (special)
 */
export type InputAction =
  | 'left'
  | 'right'
  | 'crouch'
  | 'jump'
  | 'block'
  | 'light'
  | 'heavy'
  | 'special'

export const ACTION_FROM_CODE: Partial<Record<string, InputAction>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'jump',
  ArrowDown: 'crouch',
  Space: 'jump',
  KeyA: 'block',
  KeyF: 'light',
  KeyD: 'heavy',
  KeyS: 'special',
}

export const ALL_ACTIONS: readonly InputAction[] = [
  'left',
  'right',
  'crouch',
  'jump',
  'block',
  'light',
  'heavy',
  'special',
] as const
