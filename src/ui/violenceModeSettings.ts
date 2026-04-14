import {
  getViolenceMode,
  setViolenceMode,
  subscribeViolenceMode,
  type ViolenceMode,
} from '../presentation/violenceMode'

/** Binds Settings · Violence mode radio buttons to the global store. */
export function wireViolenceModeSettings(menuRoot: HTMLElement): void {
  const panel = menuRoot.querySelector<HTMLElement>('[data-menu-view="settings"]')
  if (!panel) return

  const buttons = panel.querySelectorAll<HTMLButtonElement>('[data-violence-mode]')

  function sync(): void {
    const m = getViolenceMode()
    for (const btn of buttons) {
      const v = btn.dataset.violenceMode as ViolenceMode | undefined
      const active = v === m
      btn.classList.toggle('settings-mode-btn--active', active)
      btn.setAttribute('aria-checked', active ? 'true' : 'false')
    }
  }

  panel.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-violence-mode]')
    if (!t || !panel.contains(t)) return
    const mode = t.dataset.violenceMode as ViolenceMode | undefined
    if (mode !== 'soft' && mode !== 'chaos') return
    setViolenceMode(mode)
    sync()
  })

  subscribeViolenceMode(() => sync())
  sync()
}
