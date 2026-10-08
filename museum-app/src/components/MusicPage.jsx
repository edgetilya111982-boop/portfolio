import React, { useMemo } from 'react'
import DiscCascadeCarousel from './DiscCascadeCarousel'
import { MusicPanel, useMusicPlayer } from './MusicPlayer'
import { MUSIC_ALBUMS, albumCover } from '../data/musicAlbums'

// Each disc is an album; the side panel lists its tracks and holds the player.
export default function MusicPage() {
  const player = useMusicPlayer(MUSIC_ALBUMS)
  const items = useMemo(
    () =>
      MUSIC_ALBUMS.map((a) => ({
        title: a.title,
        src: albumCover(a),
        alt: `${a.title} — обложка альбома`,
        label: '',
        fine: '',
      })),
    []
  )

  return (
    <div className="works-music">
      <DiscCascadeCarousel
        items={items}
        height="100%"
        layout="column"
        panel
        panelSide="left"
        renderPanel={(item, i) => (
          <MusicPanel albums={MUSIC_ALBUMS} albumIndex={i} player={player} />
        )}
        stageX="20%"
        discSize="clamp(150px, min(34vh, 24vw), 330px)"
        spacing={0.1}
        rise={-1.08}
        depth={0.16}
        ahead={2.2}
        background="transparent"
        color="#dfe9ff"
        serif="var(--font-serif)"
        sans="var(--font-sans)"
        display="var(--font-sans)"
        indexLabel=""
        defaultIndex={0}
        loop={MUSIC_ALBUMS.length > 1}
        reviews={false}
        frame={false}
        hint=""
        ariaLabel="Музыка — альбомы"
      />
    </div>
  )
}
