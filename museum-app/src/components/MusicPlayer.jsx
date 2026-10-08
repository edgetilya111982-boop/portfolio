import React, { useState, useEffect, useRef, useCallback } from 'react'
import { trackSrc } from '../data/musicAlbums'
import './MusicPlayer.css'

const pad = (n) => String(n).padStart(2, '0')

function fmt(s) {
  if (!Number.isFinite(s)) return '0:00'
  return Math.floor(s / 60) + ':' + pad(Math.floor(s % 60))
}

function tracksWord(n) {
  const a = n % 10
  const b = n % 100
  if (a === 1 && b !== 11) return 'трек'
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return 'трека'
  return 'треков'
}

// One audio element for the whole page. `now` is the track that is loaded, whichever album is on screen.
export function useMusicPlayer(albums) {
  const audioRef = useRef(null)
  const nowRef = useRef(null)
  const [now, setNowState] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const setNow = (v) => {
    nowRef.current = v
    setNowState(v)
  }

  const load = useCallback(
    (a, t) => {
      const track = albums[a]?.tracks[t]
      const el = audioRef.current
      if (!track || !el) return
      el.src = trackSrc(albums[a], t)
      setNow({ a, t })
      setTime(0)
      setDuration(track.duration || 0)
      el.play().catch(() => setPlaying(false))
    },
    [albums]
  )

  useEffect(() => {
    const el = new Audio()
    el.preload = 'metadata'
    audioRef.current = el

    const onTime = () => setTime(el.currentTime)
    const onMeta = () => setDuration(el.duration || 0)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => {
      const n = nowRef.current
      const album = n && albums[n.a]
      if (album && n.t + 1 < album.tracks.length) load(n.a, n.t + 1)
      else {
        setPlaying(false)
        setTime(0)
      }
    }

    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('ended', onEnded)
    return () => {
      el.pause()
      el.removeAttribute('src')
      el.load()
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onMeta)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('ended', onEnded)
    }
  }, [albums, load])

  const play = (a, t) => {
    const n = nowRef.current
    const el = audioRef.current
    if (n && n.a === a && n.t === t) {
      if (el.paused) el.play().catch(() => {})
      else el.pause()
      return
    }
    load(a, t)
  }

  const toggle = () => {
    const el = audioRef.current
    if (!el || !nowRef.current) return
    if (el.paused) el.play().catch(() => {})
    else el.pause()
  }

  const step = (dir) => {
    const n = nowRef.current
    if (!n) return
    const t = n.t + dir
    if (t >= 0 && t < albums[n.a].tracks.length) load(n.a, t)
  }

  const seek = (sec) => {
    if (audioRef.current) audioRef.current.currentTime = sec
    setTime(sec)
  }

  return { now, playing, time, duration, play, toggle, step, seek }
}

const Icon = {
  prev: <path d="M6 5v14M18 6l-9 6 9 6z" />,
  next: <path d="M18 5v14M6 6l9 6-9 6z" />,
  play: <path d="M8 5l11 7-11 7z" />,
  pause: <path d="M8 5v14M16 5v14" />,
}

function Glyph({ name, fill }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {Icon[name]}
    </svg>
  )
}

export function MusicPanel({ albums, albumIndex, player }) {
  const album = albums[albumIndex]
  const { now, playing, time, duration } = player
  if (!album) return null

  const total = album.tracks.reduce((s, t) => s + (t.duration || 0), 0)
  const nowAlbum = now ? albums[now.a] : null
  const nowTrack = nowAlbum ? nowAlbum.tracks[now.t] : null
  const atFirst = now && now.t === 0
  const atLast = now && nowAlbum && now.t === nowAlbum.tracks.length - 1

  return (
    <div className="mp">
      <header className="mp__head">
        <h2 className="mp__title">{album.title}</h2>
        {album.subtitle ? <p className="mp__sub">{album.subtitle}</p> : null}
        <p className="mp__meta">
          {[album.year, album.genre, `${album.tracks.length} ${tracksWord(album.tracks.length)} · ${fmt(total)}`].filter(Boolean).join(' · ')}
        </p>
      </header>

      <ol className="mp__tracks">
        {album.tracks.map((t, i) => {
          const current = now && now.a === albumIndex && now.t === i
          return (
            <li key={i}>
              <button
                type="button"
                className={'mp__track' + (current ? ' is-current' : '')}
                aria-current={current ? 'true' : undefined}
                aria-label={(current && playing ? 'Пауза: ' : 'Играть: ') + t.title}
                onClick={() => player.play(albumIndex, i)}
              >
                <span className="mp__num">
                  {current && playing ? (
                    <span className="mp__eq" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : (
                    pad(i + 1)
                  )}
                </span>
                <span className="mp__name">{t.title}</span>
                <span className="mp__dur">{fmt(t.duration)}</span>
              </button>
            </li>
          )
        })}
      </ol>

      {nowTrack ? (
        <div className="mp__bar">
          <div className="mp__now">
            {nowAlbum.title} · {nowTrack.title}
          </div>
          <div className="mp__seek">
            <span>{fmt(time)}</span>
            <input
              className="mp__range"
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={Math.min(time, duration || 0)}
              style={{ '--p': duration ? (time / duration) * 100 + '%' : '0%' }}
              aria-label="Перемотка"
              onChange={(e) => player.seek(Number(e.target.value))}
            />
            <span>{fmt(duration)}</span>
          </div>
          <div className="mp__ctl">
            <button type="button" className="mp__btn" aria-label="Предыдущий трек" disabled={atFirst} onClick={() => player.step(-1)}>
              <Glyph name="prev" />
            </button>
            <button type="button" className="mp__btn mp__btn--main" aria-label={playing ? 'Пауза' : 'Играть'} onClick={player.toggle}>
              <Glyph name={playing ? 'pause' : 'play'} fill={!playing} />
            </button>
            <button type="button" className="mp__btn" aria-label="Следующий трек" disabled={atLast} onClick={() => player.step(1)}>
              <Glyph name="next" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
