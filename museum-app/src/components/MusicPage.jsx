import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import NeonSign from './NeonSign'
import { MusicPanel, useMusicPlayer } from './MusicPlayer'
import { MUSIC_ALBUMS, MUSIC_GENRES, albumCover } from '../data/musicAlbums'
import './MusicPage.css'

const BASE = import.meta.env.BASE_URL

// Geometry of the four shelves in music/shelf_v3.webp, as % of the image:
// the clickable row band and the spot where the record sits.
const SHELVES = {
  rock:      { top: 0.3,  h: 25.9, x: 66.4, y: 18.3, color: '#ff2fa0', neon: { left: 20.2, top: 5.9, width: 13.4 } },
  lounge:    { top: 26.6, h: 22.0, x: 66.4, y: 41.0, color: '#ff9a3c', neon: { left: 19.6, top: 28.7, width: 17.4 } },
  chillout:  { top: 48.8, h: 22.7, x: 66.8, y: 63.6, color: '#22e0d0', neon: { left: 16.8, top: 51.5, width: 20.4 } },
  cinematic: { top: 71.5, h: 28.3, x: 65.5, y: 86.8, color: '#3d7bff', neon: { left: 7.2, top: 73.3, width: 45.1 } },
}

const FLIGHT_MS = 1100

// A shelf of genres: pick one and the record slides out with its track list.
export default function MusicPage() {
  const player = useMusicPlayer(MUSIC_ALBUMS)
  const [open, setOpen] = useState(null) // genre id
  const [pos, setPos] = useState(0) // album position inside the genre
  const [soon, setSoon] = useState(null)
  const [closing, setClosing] = useState(false)
  const shelfRef = useRef(null)
  const slotRef = useRef(null)
  const animRef = useRef(null)
  const soonTimer = useRef(0)

  const byGenre = useMemo(() => {
    const m = {}
    MUSIC_GENRES.forEach((g) => (m[g.id] = []))
    MUSIC_ALBUMS.forEach((a, i) => m[a.genre]?.push(i))
    return m
  }, [])

  const list = open ? byGenre[open] : []
  const albumIndex = list[Math.min(pos, list.length - 1)]
  const album = albumIndex != null ? MUSIC_ALBUMS[albumIndex] : null
  const isPlaying = !!album && player.playing && player.now?.a === albumIndex

  // Record flight: from the shelf spot to its place beside the shelf.
  useLayoutEffect(() => {
    if (!open || !slotRef.current || !shelfRef.current) return
    const slot = slotRef.current
    const s = SHELVES[open]
    const sr = shelfRef.current.getBoundingClientRect()
    const tr = slot.getBoundingClientRect()
    const dx = sr.left + (sr.width * s.x) / 100 - (tr.left + tr.width / 2)
    const dy = sr.top + (sr.height * s.y) / 100 - (tr.top + tr.height / 2)
    animRef.current?.cancel()
    animRef.current = slot.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(0.22) rotate(-10deg)`, opacity: 0 },
        { opacity: 1, offset: 0.16 },
        { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 },
      ],
      { duration: FLIGHT_MS, easing: 'cubic-bezier(.2,.75,.2,1)', fill: 'both' }
    )
  }, [open])

  const clearSoon = () => {
    window.clearTimeout(soonTimer.current)
    setSoon(null)
  }

  const choose = (id) => {
    if (byGenre[id].length === 0) {
      setSoon(id)
      window.clearTimeout(soonTimer.current)
      soonTimer.current = window.setTimeout(() => setSoon(null), 2200)
      return
    }
    clearSoon()
    if (id === open) return
    const state = { works: 'music', shelf: id }
    if (open) window.history.replaceState(state, '')
    else window.history.pushState(state, '')
    setPos(0)
    setClosing(false)
    setOpen(id)
  }

  const close = (fromHistory = false) => {
    if (!open) return
    if (!fromHistory && window.history.state?.shelf) {
      window.history.back() // popstate below runs the same closing animation
      return
    }
    setClosing(true) // the shelf starts to come back into focus right away
    const a = animRef.current
    if (!a) {
      setClosing(false)
      return setOpen(null)
    }
    a.onfinish = () => {
      animRef.current = null
      setOpen(null)
      setClosing(false)
    }
    a.playbackRate = -1.4
    a.play()
  }

  // One stable listener: App re-renders during the same popstate event, so
  // re-subscribing on every render would make this listener miss it.
  const latest = useRef(null)
  latest.current = { open, close }
  useEffect(() => {
    const onPop = (e) => {
      const { open: cur, close: closeNow } = latest.current
      const id = e.state?.shelf ?? null
      if (id === cur) return
      if (id) {
        setPos(0)
        setClosing(false)
        setOpen(id)
      } else closeNow(true)
    }
    const onKey = (e) => e.key === 'Escape' && latest.current.open && latest.current.close()
    window.addEventListener('popstate', onPop)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  useEffect(() => () => window.clearTimeout(soonTimer.current), [])

  const step = (d) => setPos((p) => (p + d + list.length) % list.length)

  return (
    <div className="works-music">
      <h2 className="sr-only">Музыка по жанрам: рок, лаунж, чиллаут, кинематографичная музыка</h2>
      <div className="mshelf" data-open={open && !closing ? '' : undefined}>
        <div className="mshelf__shelf" ref={shelfRef}>
          <img className="mshelf__img" src={`${BASE}music/shelf_v3.webp`} alt="Стеллаж с жанрами музыки" draggable="false" />
          {MUSIC_GENRES.map((g) => (
            <NeonSign
              key={g.id}
              className={`neon--${g.id}`}
              src={`${BASE}music/neon_${g.id}.webp`}
              style={{
                left: `${SHELVES[g.id].neon.left}%`,
                top: `${SHELVES[g.id].neon.top}%`,
                width: `${SHELVES[g.id].neon.width}%`,
              }}
            />
          ))}
          {MUSIC_GENRES.map((g) => {
            const s = SHELVES[g.id]
            const empty = byGenre[g.id].length === 0
            return (
              <button
                key={g.id}
                type="button"
                className={`mshelf__row${open === g.id ? ' is-open' : ''}${empty ? ' is-empty' : ''}`}
                style={{ top: `${s.top}%`, height: `${s.h}%`, '--c': s.color }}
                aria-label={empty ? `${g.seo} — скоро` : g.seo}
                aria-pressed={open === g.id}
                title={g.seo}
                onClick={() => choose(g.id)}
              >
                {soon === g.id ? <span className="mshelf__soon">Скоро здесь появится музыка</span> : null}
              </button>
            )
          })}
        </div>

        {album ? (
          <>
            <div className="mshelf__slot" ref={slotRef}>
              <div className="mshelf__vinyl" data-playing={isPlaying ? '' : undefined}>
                <div className="mshelf__spin">
                  <div className="mshelf__grooves" />
                  <div className="mshelf__label">
                    <img src={albumCover(album)} alt="" />
                  </div>
                </div>
              </div>
              <div className="mshelf__sleeve">
                <img src={albumCover(album)} alt={`${album.title} — обложка альбома`} />
              </div>
              {list.length > 1 ? (
                <div className="mshelf__nav">
                  <button type="button" onClick={() => step(-1)} aria-label="Предыдущий альбом">‹</button>
                  <span>{Math.min(pos, list.length - 1) + 1} / {list.length}</span>
                  <button type="button" onClick={() => step(1)} aria-label="Следующий альбом">›</button>
                </div>
              ) : null}
            </div>
            <aside className="mshelf__panel" aria-label="Композиции">
              <button type="button" className="mshelf__close" onClick={() => close()} aria-label="Вернуть пластинку на полку">✕</button>
              <MusicPanel albums={MUSIC_ALBUMS} albumIndex={albumIndex} player={player} />
            </aside>
          </>
        ) : null}
      </div>
    </div>
  )
}
