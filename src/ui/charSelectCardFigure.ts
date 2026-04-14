/**
 * Character select card header: optional roster portrait with CSS silhouette fallback.
 */
export function createCharSelectCardFigure(
  portraitSrc: string | undefined,
  portraitAltLabel?: string,
): HTMLElement {
  const fig = document.createElement('span')
  fig.className = 'char-select-card__figure'
  if (portraitSrc) {
    const img = document.createElement('img')
    img.className = 'char-select-card__portrait'
    img.src = portraitSrc
    img.alt = portraitAltLabel ? `${portraitAltLabel} — select portrait` : ''
    img.decoding = 'async'
    img.loading = 'lazy'
    fig.appendChild(img)
  }
  const sil = document.createElement('span')
  sil.className = 'char-select-card__silhouette'
  fig.appendChild(sil)
  return fig
}
