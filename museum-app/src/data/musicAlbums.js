const BASE = import.meta.env.BASE_URL

/*
 * One entry per album. Files live in public/music/<id>/:
 *   cover.webp         square cover (used as the disc label)
 *   01.mp3, 02.mp3 …   tracks in order
 * `duration` is in seconds. Add `year`, `genre` or `description` to an album to show them.
 */
export const MUSIC_ALBUMS = [
  {
    id: 'gothic-cello',
    title: 'Gothic Cello',
    subtitle: 'Autumn Requiem',
    tracks: [
      { title: 'Трек 1', duration: 167.1 },
      { title: 'Трек 2', duration: 174.3 },
      { title: 'Трек 3', duration: 170.9 },
      { title: 'Трек 4', duration: 179.1 },
    ],
  },
]

const pad = (n) => String(n).padStart(2, '0')

export const albumCover = (album) => `${BASE}music/${album.id}/cover.webp`
export const trackSrc = (album, index) => `${BASE}music/${album.id}/${pad(index + 1)}.mp3`
