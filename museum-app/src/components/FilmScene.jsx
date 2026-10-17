import React from 'react'
import { FILM_SHELVES } from './FilmShelf'
import './FilmScene.css'

const BASE = import.meta.env.BASE_URL

// works_bg_film.webp is 2000x1105, shown with background-size: cover, pinned to the left edge so the
// rack stays in view on narrow windows. Everything below is in that picture's pixels.
const BG = { w: 2000, h: 1105 }

// unlit versions of the three signs: patches cut from the picture, the lit tubes are in the picture itself
const SIGNS = {
  animation: { x: 150, y: 98, w: 482, h: 118, cycle: '7.3s', delay: '-2.6s' },
  ads: { x: 190, y: 333, w: 400, h: 100, cycle: '8.9s', delay: '-6.1s' },
  cinema: { x: 255, y: 553, w: 257, h: 95, cycle: '6.2s', delay: '-4.4s' },
}

// clickable bands over each shelf
const ROWS = {
  animation: { y: 92, h: 258 },
  ads: { y: 350, h: 222 },
  cinema: { y: 572, h: 232 },
}
const ROW_X = { x: 0, w: 780 }

export default function FilmScene({ viewport, counts, onChange }) {
  const s = Math.max(viewport.w / BG.w, viewport.h / BG.h)
  const oy = (viewport.h - BG.h * s) / 2
  const px = (v) => v * s
  return (
    <nav className="film-scene" aria-label="Категории видео">
      {FILM_SHELVES.map((sh) => {
        const g = SIGNS[sh.id]
        return (
          <img
            key={sh.id}
            className="film-scene__off"
            src={`${BASE}film_off_${sh.id}.webp`}
            alt=""
            draggable="false"
            aria-hidden="true"
            style={{
              left: px(g.x),
              top: oy + px(g.y),
              width: px(g.w),
              height: px(g.h),
              '--neon-cycle': g.cycle,
              '--neon-delay': g.delay,
            }}
          />
        )
      })}
      {FILM_SHELVES.map((sh) => {
        const r = ROWS[sh.id]
        const n = counts[sh.id] || 0
        return (
          <button
            key={sh.id}
            type="button"
            className={`film-shelf__row film-scene__row${n === 0 ? ' is-empty' : ''}`}
            style={{ left: px(ROW_X.x), top: oy + px(r.y), width: px(ROW_X.w), height: px(r.h) }}
            aria-label={sh.seo}
            title={sh.seo}
            onClick={() => onChange(sh.id)}
          >
            <span className="film-shelf__name">{sh.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
