import React, { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import SphereImageGrid from './SphereImageGrid'
import HaloReel from './HaloReel'
import FilmShelf, { FILM_TITLES } from './FilmShelf'
import FilmScene from './FilmScene'
import MusicPage from './MusicPage'
import NeonSign from './NeonSign'
import ArtStand, { ART_CATEGORIES } from './ArtStand'
import './WorksPage.css'

const BASE = import.meta.env.BASE_URL

const WORKS_DATA = {
  animation: [
    {
      id: 'w01',
      film: 'animation',
      title: 'Анимация',
      tools: 'Higgsfield AI',
      poster: `${BASE}posters/work_01.webp`,
      video: `${BASE}work_01.mp4`,
    },
    {
      id: 'w10',
      film: 'animation',
      title: 'Экшн-сцена',
      tools: '',
      poster: `${BASE}posters/work_10.webp`,
      video: `${BASE}work_10.mp4`,
    },
    {
      id: 'w02',
      film: 'animation',
      title: 'Рекламный ролик',
      tools: 'Higgsfield AI',
      poster: `${BASE}posters/work_02.webp`,
      video: `${BASE}work_02.mp4`,
    },
    {
      id: 'w04',
      film: 'ads',
      title: 'Жилет Zima',
      tools: '',
      poster: `${BASE}posters/work_04.webp`,
      video: `${BASE}work_04.mp4`,
    },
    {
      id: 'w05',
      film: 'ads',
      title: 'Зарядка Hoco',
      tools: '',
      poster: `${BASE}posters/work_05.webp`,
      video: `${BASE}work_05.mp4`,
    },
    {
      id: 'w06',
      film: 'ads',
      title: 'Makita',
      tools: '',
      poster: `${BASE}posters/work_06.webp`,
      video: `${BASE}work_06.mp4`,
    },
    {
      id: 'w07',
      film: 'ads',
      title: 'Термос',
      tools: '',
      poster: `${BASE}posters/work_07.webp`,
      video: `${BASE}work_07.mp4`,
    },
    {
      id: 'w08',
      film: 'ads',
      title: 'Фитнес',
      tools: '',
      poster: `${BASE}posters/work_08.webp`,
      video: `${BASE}work_08.mp4`,
    },
    {
      id: 'w09',
      film: 'ads',
      title: 'Greenworks',
      tools: '',
      poster: `${BASE}posters/work_09.webp`,
      video: `${BASE}work_09.mp4`,
    },
    {
      id: 'w12',
      film: 'ads',
      title: 'Рюкзак',
      tools: '',
      poster: `${BASE}posters/work_12.webp`,
      video: `${BASE}work_12.mp4`,
    },
    {
      id: 'w03',
      film: 'cinema',
      title: 'Ролик 3',
      tools: '',
      poster: `${BASE}posters/work_03.webp`,
      video: `${BASE}work_03.mp4`,
    },
    {
      id: 'w11',
      film: 'cinema',
      title: 'Кино',
      tools: '',
      poster: `${BASE}posters/work_11.webp`,
      video: `${BASE}work_11.mp4`,
    },
  ],
  art: [],
  music: [],
}

// the artworks for the art sphere: files in public/art/work_01..18.webp
const artImage = (n) => {
  const file = `work_${String(n).padStart(2, '0')}`
  return {
    id: file,
    src: `${BASE}art/${file}.webp`,
    alt: `\u0420\u0430\u0431\u043e\u0442\u0430 ${n}`,
    title: n === 6 ? 'Tree of Life' : `\u0420\u0430\u0431\u043e\u0442\u0430 ${n}`,
  }
}
const ART_IMAGES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(artImage)
const AD_IMAGES = [13, 14, 15, 16, 17, 18].map(artImage)

const ART_BY_CATEGORY = {
  paintings: ART_IMAGES.filter((img) => img.id !== 'work_02'),
  ads: AD_IMAGES,
  photo: ART_IMAGES.filter((img) => img.id === 'work_02'),
}

function useSphereSize() {
  const calc = () =>
    Math.round(Math.max(300, Math.min(window.innerHeight - 150, window.innerWidth * 0.92, 680)))
  const [size, setSize] = useState(calc)
  useEffect(() => {
    const onResize = () => setSize(calc())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return size
}

const BG_SHADE = 'linear-gradient(90deg, rgba(4,8,22,0.55) 0%, rgba(4,8,22,0.1) 60%)'

function pageBackground(category) {
  if (category === 'art') return `url(${BASE}works_bg_art.webp)`
  if (category === 'music') return `url(${BASE}works_bg_music.webp)`
  return `${BG_SHADE}, url(${BASE}works_bg.webp)`
}

function useViewport() {
  const read = () => ({ w: window.innerWidth, h: window.innerHeight })
  const [vp, setVp] = useState(read)
  useEffect(() => {
    const onResize = () => setVp(read())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return vp
}

// Hang the sign on the wall right above the monitor in works_bg_music.webp (2000x1105,
// background-size: cover, centred). Coordinates below are in that image's pixels.
const MUSIC_BG = { w: 2000, h: 1105 }
const NEON = { centerX: 1225, monitorTop: 255, width: 380, ratio: 0.385, letterBottom: 0.93, gap: 10 }

function neonPlacement(vp) {
  const s = Math.max(vp.w / MUSIC_BG.w, vp.h / MUSIC_BG.h)
  const ox = (vp.w - MUSIC_BG.w * s) / 2
  const oy = (vp.h - MUSIC_BG.h * s) / 2
  const width = NEON.width * s
  const height = width * NEON.ratio
  return {
    width,
    left: ox + NEON.centerX * s - width / 2,
    top: oy + (NEON.monitorTop - NEON.gap) * s - height * NEON.letterBottom,
  }
}

const CAT_META = {
  animation: { label: 'Анимация видео', accent: '#cf9d5c' },
  art:       { label: 'Арт визуал',     accent: '#cf9d5c' },
  music:     { label: 'Музыка',         accent: '#cf9d5c' },
}

function VideoModal({ src, onClose }) {
  const ref = useRef(null)
  const close = () => {
    if (ref.current) { ref.current.pause(); ref.current.muted = true }
    onClose()
  }

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return createPortal(
    <div className="wp-modal" onClick={close}>
      <video
        ref={ref}
        className="wp-modal__video"
        src={src}
        autoPlay
        playsInline
        controls
        onClick={e => e.stopPropagation()}
      />
      <button className="wp-modal__close" onClick={close}>✕&nbsp;&nbsp;Закрыть</button>
    </div>,
    document.body
  )
}

export default function WorksPage({ category, onClose }) {
  const meta = CAT_META[category] || CAT_META.animation
  const works = WORKS_DATA[category] || []
  const sphereSize = useSphereSize()
  const viewport = useViewport()
  const [openVideo, setOpenVideo] = useState(null)
  // animation is two levels: the shelf (null) and a page of videos for the chosen shelf
  const [filmCat, setFilmCat] = useState(null)
  const filmWorks = useMemo(() => works.filter((w) => w.film === filmCat), [works, filmCat])
  const filmCounts = works.reduce((m, w) => ({ ...m, [w.film]: (m[w.film] || 0) + 1 }), {})
  const [artCat, setArtCat] = useState(null)

  const openFilm = (id) => setFilmCat(id)
  const openArt = (id) => setArtCat(id)
  const artImages = ART_BY_CATEGORY[artCat] || []

  const wideHub = category === 'animation' && !filmCat && viewport.w >= 760
  let content
  if (category === 'art' && !artCat) {
    content = <ArtStand onChange={openArt} />
  } else if (category === 'art' && artImages.length === 0) {
    content = (
      <div className="works-page__empty">
        <span className="works-page__empty-icon">◈</span>
        <p className="works-page__empty-text">Работы скоро появятся</p>
      </div>
    )
  } else if (category === 'art') {
    content = (
      <div className="works-sphere">
        <SphereImageGrid
          key={artCat}
          images={artImages}
          containerSize={sphereSize}
          sphereRadius={sphereSize * 0.4}
          baseImageScale={0.4}
          accent={meta.accent}
        />
        <p className="works-sphere__hint">Потяните, чтобы вращать · клик — открыть</p>
      </div>
    )
  } else if (category === 'music') {
    content = <MusicPage />
  } else if (works.length === 0) {
    content = (
      <div className="works-page__empty">
        <span className="works-page__empty-icon">◈</span>
        <p className="works-page__empty-text">Работы скоро появятся</p>
      </div>
    )
  } else if (category === 'animation' && !filmCat && wideHub) {
    content = null // the scene is drawn over the whole page, below
  } else if (category === 'animation' && !filmCat) {
    content = (
      <div className="works-film">
        <FilmShelf counts={filmCounts} onChange={openFilm} />
      </div>
    )
  } else if (category === 'animation' && filmWorks.length === 0) {
    content = (
      <div className="works-page__empty">
        <span className="works-page__empty-icon">◈</span>
        <p className="works-page__empty-text">Ролики этой категории скоро появятся</p>
      </div>
    )
  } else {
    content = (
      <div className="works-reel">
        <HaloReel
          items={category === 'animation' ? filmWorks : works}
          accent={meta.accent}
          onOpen={(w) => setOpenVideo(w.video)}
        />
        <p className="works-reel__hint">Колесо мыши или перетаскивание — вращать · клик по центральной карточке — смотреть</p>
      </div>
    )
  }

  return (
    <div
      className={`works-page${category === 'music' ? ' works-page--music' : ''}`}
      style={{
        backgroundImage: wideHub ? 'none' : pageBackground(category),
      }}
      onWheel={e => e.stopPropagation()}
    >
      <div className="works-page__header">
        <button className="works-page__back" onClick={onClose}>← Назад</button>
        <h1 className="works-page__title" style={{ color: meta.accent }}>
          {category === 'animation' && filmCat
            ? FILM_TITLES[filmCat]
            : category === 'art' && artCat
              ? ART_CATEGORIES.find((c) => c.id === artCat)?.label
              : meta.label}
        </h1>
      </div>

      <div className="works-page__body">{content}</div>

      {wideHub && <FilmScene viewport={viewport} counts={filmCounts} onChange={openFilm} />}
      {category === 'music' && viewport.w >= 760 && <NeonSign src={`${BASE}neon_music_v2.webp`} style={neonPlacement(viewport)} />}

      {openVideo && <VideoModal src={openVideo} onClose={() => setOpenVideo(null)} />}
    </div>
  )
}
