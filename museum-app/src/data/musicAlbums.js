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
  {
    id: 'album-2',
    title: 'Альбом 2',
    tracks: [
      { title: 'Трек 1', duration: 175.4 },
      { title: 'Трек 2', duration: 171.7 },
      { title: 'Трек 3', duration: 167.2 },
      { title: 'Трек 4', duration: 153.8 },
    ],
  },
]

/*
 * Genres shown as tiles above the discs. Labels are short for the UI;
 * `seo` is the full phrase for aria-labels and the page heading.
 * Assign an album to a genre with `genre: 'rock'` (an id from this list).
 */
export const MUSIC_GENRES = [
  { id: 'rock', label: 'Рок', seo: 'Рок-музыка' },
  { id: 'lounge', label: 'Лаунж', seo: 'Лаунж-музыка' },
  { id: 'chillout', label: 'Чиллаут', seo: 'Чиллаут и расслабляющая музыка' },
  { id: 'cinematic', label: 'Кинематографичная', seo: 'Кинематографичная музыка для фильмов и видео' },
]

const pad = (n) => String(n).padStart(2, '0')

export const albumCover = (album) => `${BASE}music/${album.id}/cover.webp`
export const trackSrc = (album, index) => `${BASE}music/${album.id}/${pad(index + 1)}.mp3`
