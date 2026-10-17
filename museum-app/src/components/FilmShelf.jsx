import React from 'react'
import './FilmShelf.css'

const BASE = import.meta.env.BASE_URL

// Three shelves of the film-reel rack. Positions are % of the picture (1200x1031).
export const FILM_SHELVES = [
  { id: 'animation', label: 'Анимация', top: 9, h: 27, seo: 'Анимация видео' },
  { id: 'ads', label: 'Реклама', top: 41, h: 27, seo: 'Рекламные ролики' },
  { id: 'cinema', label: 'Кино', top: 73, h: 25, seo: 'Кинематографические ролики' },
]

export const FILM_TITLES = { animation: 'Анимация', ads: 'Реклама', cinema: 'Кино' }

export default function FilmShelf({ counts, onChange }) {
  return (
    <nav className="film-shelf" aria-label="Категории видео">
      <div className="film-shelf__pic">
        <img src={`${BASE}film_shelf.webp`} alt="" draggable="false" />
        {FILM_SHELVES.map((s) => {
          const n = counts[s.id] || 0
          return (
            <button
              key={s.id}
              type="button"
              className={`film-shelf__row${n === 0 ? ' is-empty' : ''}`}
              style={{ top: `${s.top}%`, height: `${s.h}%` }}
              aria-label={s.seo}
              title={s.seo}
              onClick={() => onChange(s.id)}
            >
              <span className="film-shelf__name">{s.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
