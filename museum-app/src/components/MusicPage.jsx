import React, { useMemo, useState } from 'react'
import DiscCascadeCarousel from './DiscCascadeCarousel'
import { MusicPanel, useMusicPlayer } from './MusicPlayer'
import { MUSIC_ALBUMS, MUSIC_GENRES, albumCover } from '../data/musicAlbums'

// Each disc is an album; the side panel lists its tracks and holds the player.
export default function MusicPage() {
  const player = useMusicPlayer(MUSIC_ALBUMS)
  const [genre, setGenre] = useState('all')
  // Indices into MUSIC_ALBUMS for the chosen genre: the player keeps global indices.
  const shown = useMemo(
    () => MUSIC_ALBUMS.map((_, i) => i).filter((i) => genre === 'all' || MUSIC_ALBUMS[i].genre === genre),
    [genre]
  )
  const items = useMemo(
    () =>
      shown.map((i) => {
        const a = MUSIC_ALBUMS[i]
        return { title: a.title, src: albumCover(a), alt: `${a.title} — обложка альбома`, label: '', fine: '' }
      }),
    [shown]
  )
  const count = (id) => MUSIC_ALBUMS.filter((a) => a.genre === id).length
  const playingGlobal = player.playing && player.now ? player.now.a : null
  const playingShown = playingGlobal === null ? -1 : shown.indexOf(playingGlobal)

  return (
    <div className="works-music">
      <h2 className="sr-only">Музыка по жанрам: рок, лаунж, чиллаут, кинематографичная музыка</h2>
      <nav className="genres" aria-label="Жанры музыки">
        {[{ id: 'all', label: 'Все', seo: 'Вся музыка' }, ...MUSIC_GENRES].map((g) => {
          const n = g.id === 'all' ? MUSIC_ALBUMS.length : count(g.id)
          return (
            <button
              key={g.id}
              type="button"
              className={`genres__tile${genre === g.id ? ' is-active' : ''}`}
              aria-pressed={genre === g.id}
              aria-label={g.seo}
              title={g.seo}
              disabled={n === 0}
              onClick={() => setGenre(g.id)}
            >
              <span className="genres__name">{g.label}</span>
              <span className="genres__count">{n === 0 ? null : n}</span>
            </button>
          )
        })}
      </nav>
      <div className="works-music__stage">
      <DiscCascadeCarousel
        key={genre}
        items={items}
        height="100%"
        layout="column"
        sleeve
        playingIndex={playingShown >= 0 ? playingShown : null}
        panel
        panelSide="left"
        renderPanel={(item, i) => (
          <MusicPanel albums={MUSIC_ALBUMS} albumIndex={shown[i]} player={player} />
        )}
        stageX="14%"
        discSize="clamp(170px, min(34vh, 20vw), 360px)"
        spacing={0.04}
        rise={-1.12}
        depth={0.1}
        yaw={0}
        fan={0}
        tilt={0}
        pitch={0}
        roll={0}
        ahead={2.2}
        background="transparent"
        color="#dfe9ff"
        serif="var(--font-serif)"
        sans="var(--font-sans)"
        display="var(--font-sans)"
        indexLabel=""
        defaultIndex={0}
        loop={items.length > 2}
        reviews={false}
        frame={false}
        hint=""
        ariaLabel="Музыка — альбомы"
      />
      </div>
    </div>
  )
}
