import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import SphereImageGrid from './SphereImageGrid'
import HaloReel from './HaloReel'
import DiscCascadeCarousel from './DiscCascadeCarousel'
import NeonSign from './NeonSign'
import './WorksPage.css'

const BASE = import.meta.env.BASE_URL

const WORKS_DATA = {
  animation: [
    {
      id: 'w01',
      title: 'Анимация',
      tools: 'Higgsfield AI',
      poster: `${BASE}posters/work_01.webp`,
      video: `${BASE}work_01.mp4`,
    },
    {
      id: 'w02',
      title: 'Рекламный ролик',
      tools: 'Higgsfield AI',
      poster: `${BASE}posters/work_02.webp`,
      video: `${BASE}work_02.mp4`,
    },
  ],
  art: [],
  music: [],
}

const ART_FRAMES = ['01', '02'].flatMap(n => [1, 2, 3, 4, 5, 6].map(i => `art_${n}_${i}`))

// placeholder frames cycled to fill the sphere until real artworks are added
const ART_IMAGES = Array.from({ length: 30 }, (_, i) => {
  const frame = ART_FRAMES[i % ART_FRAMES.length]
  return {
    id: `art-${i}`,
    src: `${BASE}art/${frame}.webp`,
    alt: `Арт визуал ${i + 1}`,
    title: `Арт визуал ${i + 1}`,
  }
})

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

// placeholder discs until real tracks are added; palette = [background, figure, accent]
const MUSIC_TRACKS = [
  ['Neon Drift',   'Ambient',    '2026', '3:42', ['#071433', '#4da6ff', '#c7e4ff']],
  ['Glass Rain',   'Electronic', '2026', '4:05', ['#12082e', '#c084fc', '#38d9ff']],
  ['Afterglow',    'Downtempo',  '2026', '3:18', ['#06222b', '#38d9ff', '#e6fbff']],
  ['Signal Bloom', 'Cinematic',  '2026', '5:11', ['#1a1040', '#4da6ff', '#c084fc']],
  ['Night Circuit','Synthwave',  '2026', '3:56', ['#0b1d3d', '#8fc5ff', '#2a6bd1']],
  ['Velvet Static','Lo-fi',      '2026', '2:47', ['#17082a', '#e8b4ff', '#4da6ff']],
  ['Deep Current', 'Ambient',    '2026', '4:33', ['#03141f', '#2ad4c0', '#9be9ff']],
].map(([title, genre, year, length, palette], i) => ({
  title,
  palette,
  labelStyle: i % 2 ? 'block' : 'arc',
  credits: [
    { label: 'Жанр', value: genre },
    { label: 'Год', value: year },
    { label: 'Длительность', value: length },
  ],
}))

const BG_SHADE = 'linear-gradient(90deg, rgba(4,8,22,0.55) 0%, rgba(4,8,22,0.1) 60%)'

function pageBackground(category) {
  if (category === 'art') return `url(${BASE}works_bg_art.webp)`
  if (category === 'music') return `url(${BASE}works_bg_music.webp)`
  return `${BG_SHADE}, url(${BASE}works_bg.webp)`
}

const CAT_META = {
  animation: { label: 'Анимация видео', accent: '#38d9ff' },
  art:       { label: 'Арт визуал',     accent: '#c084fc' },
  music:     { label: 'Музыка',         accent: '#4da6ff' },
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
  const [openVideo, setOpenVideo] = useState(null)

  let content
  if (category === 'art') {
    content = (
      <div className="works-sphere">
        <SphereImageGrid
          images={ART_IMAGES}
          containerSize={sphereSize}
          sphereRadius={sphereSize * 0.4}
          baseImageScale={0.24}
          accent={meta.accent}
        />
        <p className="works-sphere__hint">Потяните, чтобы вращать · клик — открыть</p>
      </div>
    )
  } else if (category === 'music') {
    content = (
      <div className="works-music">
        <DiscCascadeCarousel
          items={MUSIC_TRACKS}
          height="100%"
          layout="column"
          panel
          panelSide="left"
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
          defaultIndex={1}
          loop
          reviews={false}
          frame={false}
          hint=""
          ariaLabel="Музыка"
        />
        <NeonSign className="works-music__neon" src={`${BASE}neon_music.webp`} />
      </div>
    )
  } else if (works.length === 0) {
    content = (
      <div className="works-page__empty">
        <span className="works-page__empty-icon">◈</span>
        <p className="works-page__empty-text">Работы скоро появятся</p>
      </div>
    )
  } else {
    content = (
      <div className="works-reel">
        <HaloReel
          items={works}
          accent={meta.accent}
          onOpen={(w) => setOpenVideo(w.video)}
        />
        <p className="works-reel__hint">Колесо мыши или перетаскивание — вращать · клик по центральной карточке — смотреть</p>
      </div>
    )
  }

  return (
    <div
      className="works-page"
      style={{
        backgroundImage: pageBackground(category),
      }}
      onWheel={e => e.stopPropagation()}
    >
      <div className="works-page__header">
        <button className="works-page__back" onClick={onClose}>← Назад</button>
        <h1 className="works-page__title" style={{ color: meta.accent }}>{meta.label}</h1>
      </div>

      <div className="works-page__body">{content}</div>

      {openVideo && <VideoModal src={openVideo} onClose={() => setOpenVideo(null)} />}
    </div>
  )
}
