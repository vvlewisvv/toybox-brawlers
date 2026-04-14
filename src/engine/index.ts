/**
 * Engine: frame timing, resize, lifecycle. Wired up when the game loop exists.
 */
export type TickFn = (dtSeconds: number) => void
