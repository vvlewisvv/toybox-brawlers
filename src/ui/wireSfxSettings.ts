import { gameSfx, isSfxMuted, setSfxMuted } from '../audio/gameSfx'

/** Binds Settings · SFX mute toggle and label. */
export function wireSfxSettings(menuRoot: HTMLElement): void {
  const panel = menuRoot.querySelector<HTMLElement>('[data-menu-view="settings"]')
  if (!panel) return

  const muteBtn = panel.querySelector<HTMLButtonElement>('[data-sfx-mute-toggle]')
  if (!muteBtn) return

  function sync(btn: HTMLButtonElement): void {
    const m = isSfxMuted()
    btn.textContent = m ? 'SFX muted' : 'SFX on'
    btn.setAttribute('aria-pressed', m ? 'true' : 'false')
    btn.classList.toggle('main-menu__btn--ghost', m)
  }

  muteBtn.addEventListener('click', () => {
    gameSfx.prime()
    setSfxMuted(!isSfxMuted())
    sync(muteBtn)
    if (!isSfxMuted()) gameSfx.playUiClick()
  })

  sync(muteBtn)
}
