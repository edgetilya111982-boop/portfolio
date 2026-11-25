import React from 'react'
import './ArtStand.css'

const BASE = import.meta.env.BASE_URL

// Panel boxes are % of art_stand.webp (591x921).
export const ART_CATEGORIES = [
  { id: 'paintings', label: 'Картины', box: { left: 13.71, top: 3.91, width: 67.17, height: 28.12 }, cycle: '7.7s', delay: '-1.9s' },
  { id: 'ads', label: 'Реклама', box: { left: 13.71, top: 33.01, width: 67.17, height: 25.84 }, cycle: '9.1s', delay: '-5.3s' },
  { id: 'photo', label: 'Фото', box: { left: 13.71, top: 60.48, width: 67.17, height: 25.52 }, cycle: '6.4s', delay: '-3.6s' },
]

const pct = (b) => ({ left: `${b.left}%`, top: `${b.top}%`, width: `${b.width}%`, height: `${b.height}%` })
const clip = (b) => `inset(${b.top}% ${100 - b.left - b.width}% ${100 - b.top - b.height}% ${b.left}%)`
const holes = ART_CATEGORIES.map((c) => { const b = c.box; return `M${b.left} ${b.top}h${b.width}v${b.height}h${-b.width}z` }).join(' ')
const baseMask = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path fill="#000" fill-rule="evenodd" d="M0 0h100v100H0z ${holes}"/></svg>`)}")`

export default function ArtStand({ onChange }) {
  return (
    <div className="art-hub">
      <nav className="art-stand" aria-label="Категории арт визуала">
        <img className="art-stand__pic" src={`${BASE}art_stand.webp`} alt="" draggable="false" style={{ WebkitMaskImage: baseMask, maskImage: baseMask }} />
        {ART_CATEGORIES.map((c) => (
          <img
            key={`lit-${c.id}`}
            className="art-stand__lit"
            data-cat={c.id}
            src={`${BASE}art_stand.webp`}
            alt=""
            aria-hidden="true"
            draggable="false"
            style={{ clipPath: clip(c.box), '--neon-cycle': c.cycle, '--neon-delay': c.delay }}
          />
        ))}
        {ART_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className="art-stand__panel"
            style={pct(c.box)}
            aria-label={c.label}
            title={c.label}
            onClick={() => onChange(c.id)}
          />
        ))}
      </nav>
    </div>
  )
}
