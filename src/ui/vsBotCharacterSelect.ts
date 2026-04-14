import { createCharSelectCardFigure } from './charSelectCardFigure'

export type VsBotCharSelectPresenter = {
  id: string
  label: string
  tagline: string
  role: string
  accentHex: string
  portraitSrc?: string
}

export type VsBotCharacterSelectApi = {
  syncSelection(p1Id: string, p2Id: string): void
  setRematchMode(active: boolean): void
}

/**
 * Builds P1 / P2 character rows and wires pick + fight + back. Temporary until full character select.
 */
export function wireVsBotCharacterSelect(
  panel: HTMLElement,
  presenters: readonly VsBotCharSelectPresenter[],
  options: {
    initialP1Id: string
    initialP2Id: string
    onFight: (p1Id: string, p2Id: string) => void
    onBack: () => void
    /** Vs rematch screen — decline (defaults to `onBack` if omitted). */
    onRematchDecline?: () => void
  },
): VsBotCharacterSelectApi {
  const rowP1 = panel.querySelector<HTMLElement>('[data-char-row="p1"]')
  const rowP2 = panel.querySelector<HTMLElement>('[data-char-row="p2"]')
  const fightBtn = panel.querySelector<HTMLButtonElement>('[data-vs-bot-char-fight]')
  const backBtn = panel.querySelector<HTMLButtonElement>('[data-vs-bot-char-back]')
  const titleEl = panel.querySelector<HTMLElement>('[data-vs-bot-char-title]')
  const ledeDefault = panel.querySelector<HTMLElement>('[data-vs-bot-char-lede-default]')
  const ledeRematch = panel.querySelector<HTMLElement>('[data-vs-bot-char-lede-rematch]')
  const cpuStatusEl = panel.querySelector<HTMLElement>('[data-vs-bot-rematch-status]')
  if (!rowP1 || !rowP2 || !fightBtn || !backBtn) {
    throw new Error('vs bot character select markup missing rows or actions')
  }

  const p1Row = rowP1
  const p2Row = rowP2
  const fight = fightBtn
  const back = backBtn

  let p1Id = options.initialP1Id
  let p2Id = options.initialP2Id
  let rematchMode = false

  function applyRematchChrome(): void {
    if (titleEl) {
      titleEl.textContent = rematchMode ? 'Rematch' : 'Choose your fighters'
    }
    ledeDefault?.toggleAttribute('hidden', rematchMode)
    ledeRematch?.toggleAttribute('hidden', !rematchMode)
    cpuStatusEl?.toggleAttribute('hidden', !rematchMode)
    fight.textContent = rematchMode ? 'Accept rematch' : 'Fight'
    back.textContent = rematchMode ? 'Decline (back to menu)' : 'Back'
  }

  function paintRow(row: HTMLElement, slot: 'p1' | 'p2'): void {
    row.replaceChildren()
    for (const p of presenters) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = `char-select-card char-select-card--${p.id}`
      btn.dataset.charPick = ''
      btn.dataset.charId = p.id
      btn.dataset.slot = slot
      btn.style.setProperty('--char-accent', p.accentHex)
      btn.setAttribute('aria-pressed', 'false')
      btn.disabled = rematchMode
      btn.setAttribute(
        'aria-label',
        `${slot === 'p1' ? 'You' : 'CPU'}: ${p.label}, ${p.role}. ${p.tagline}`,
      )

      if (p.portraitSrc) btn.classList.add('char-select-card--has-portrait')
      const fig = createCharSelectCardFigure(p.portraitSrc, p.label)

      const name = document.createElement('span')
      name.className = 'char-select-card__name'
      name.textContent = p.label

      const roleSpan = document.createElement('span')
      roleSpan.className = 'char-select-card__role'
      roleSpan.textContent = p.role

      const tag = document.createElement('span')
      tag.className = 'char-select-card__tagline'
      tag.textContent = p.tagline

      btn.append(fig, name, roleSpan, tag)
      row.appendChild(btn)
    }
  }

  function applyHighlights(): void {
    for (const row of [p1Row, p2Row]) {
      for (const btn of row.querySelectorAll<HTMLButtonElement>('[data-char-pick]')) {
        const id = btn.dataset.charId
        const slot = btn.dataset.slot
        const on =
          (slot === 'p1' && id === p1Id) || (slot === 'p2' && id === p2Id)
        btn.classList.toggle('char-select-card--selected', on)
        btn.setAttribute('aria-pressed', on ? 'true' : 'false')
      }
    }
    fight.disabled = !p1Id || !p2Id
  }

  function repaintAll(): void {
    paintRow(p1Row, 'p1')
    paintRow(p2Row, 'p2')
    applyHighlights()
  }

  repaintAll()
  applyRematchChrome()

  panel.addEventListener('click', (e) => {
    if (rematchMode) return
    const pick = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-char-pick]')
    if (!pick || !panel.contains(pick)) return
    const id = pick.dataset.charId
    const slot = pick.dataset.slot
    if (!id || (slot !== 'p1' && slot !== 'p2')) return
    if (slot === 'p1') p1Id = id
    else p2Id = id
    applyHighlights()
  })

  fight.addEventListener('click', () => {
    if (fight.disabled) return
    options.onFight(p1Id, p2Id)
  })

  back.addEventListener('click', () => {
    if (rematchMode) {
      ;(options.onRematchDecline ?? options.onBack)()
      return
    }
    options.onBack()
  })

  return {
    syncSelection(nextP1: string, nextP2: string) {
      p1Id = nextP1
      p2Id = nextP2
      applyHighlights()
    },
    setRematchMode(active: boolean) {
      rematchMode = active
      applyRematchChrome()
      repaintAll()
    },
  }
}
