import { gameMusic, isMusicMuted, setMusicMuted } from '../audio/gameMusic'
import { gameSfx } from '../audio/gameSfx'

/** Binds Settings · music mute toggle and label. */
export function wireMusicSettings(menuRoot: HTMLElement): void {
  const panel = menuRoot.querySelector<HTMLElement>('[data-menu-view="settings"]')
  if (!panel) return

  const muteBtn = panel.querySelector<HTMLButtonElement>('[data-music-mute-toggle]')
  if (!muteBtn) return

  function sync(btn: HTMLButtonElement): void {
    const m = isMusicMuted()
    btn.textContent = m ? 'Music off' : 'Music on'
    btn.setAttribute('aria-pressed', m ? 'true' : 'false')
    btn.classList.toggle('main-menu__btn--ghost', m)
  }

  muteBtn.addEventListener('click', () => {
    gameSfx.prime()
    gameMusic.prime()
    setMusicMuted(!isMusicMuted())
    sync(muteBtn)
    gameMusic.refreshPlayback()
    if (!isMusicMuted()) gameSfx.playUiClick()
  })

  sync(muteBtn)
}
