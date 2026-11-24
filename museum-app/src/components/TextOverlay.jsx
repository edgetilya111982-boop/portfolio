import React from 'react'
import './TextOverlay.css'

const CATEGORIES = [
  {
    id: 'animation',
    label: 'Анимация видео',
    sub: 'Видео и motion',
    accent: '#cf9d5c',
    preview: 'video',
    previewSrc: `${import.meta.env.BASE_URL}work_01.mp4`,
  },
  {
    id: 'art',
    label: 'Арт визуал',
    sub: 'Генеративный арт',
    accent: '#cf9d5c',
    preview: 'art',
  },
  {
    id: 'music',
    label: 'Музыка',
    sub: 'Саунд-дизайн',
    accent: '#cf9d5c',
    preview: 'music',
  },
]

function CatPreview({ cat }) {
  if (cat.preview === 'video') {
    return (
      <div className="cat-preview cat-preview--video">
        <video src={cat.previewSrc} muted autoPlay loop playsInline preload="metadata" />
      </div>
    )
  }
  if (cat.preview === 'art') {
    return <div className="cat-preview cat-preview--art" />
  }
  if (cat.preview === 'music') {
    return (
      <div className="cat-preview cat-preview--music">
        {[1, 2, 3, 4, 5].map(i => <span key={i} className="eq-bar" />)}
      </div>
    )
  }
  return null
}

// Section 0 — Hero
function HeroText({ opacity }) {
  return (
    <div className="overlay-section overlay-hero" style={{ opacity }}>
      <div className="overlay-hero__headline">
        <h1 className="headline-large">
          Ваши желания<br />
          Наши идеи<br />
          <span className="hero-accent">Моё исполнение</span>
        </h1>
      </div>
      <div className="overlay-hero__body">
        <p className="body-small">
          Zak — AI-креатор, саунд-дизайнер<br />
          и автор визуального контента.<br />
        </p>
      </div>
    </div>
  )
}

// Section 1 — Category cards
function CategoryCards({ opacity, onOpenCategory }) {
  return (
    <div
      className="overlay-section overlay-categories"
      style={{ opacity, pointerEvents: opacity > 0.3 ? 'auto' : 'none' }}
    >
      <div className="categories-grid">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            className="cat-card"
            style={{ '--cat-accent': cat.accent }}
            onClick={() => onOpenCategory(cat.id)}
          >
            <div className="cat-card__glow" />
            <div className="cat-card__body">
              <h2 className="cat-card__name">{cat.label}</h2>
              <span className="cat-card__sub label-tiny">{cat.sub}</span>
            </div>
            <CatPreview cat={cat} />
          </button>
        ))}
      </div>
    </div>
  )
}

// Section 2 — Contacts
function ContactText({ opacity }) {
  return (
    <div className="overlay-section overlay-contact" style={{ opacity, pointerEvents: opacity > 0.3 ? 'auto' : 'none' }}>
      <div className="contact-inner">
        <h2 className="headline-large contact-headline">
          Создадим <span className="hero-accent">что‑то невероятное</span>
        </h2>

        <div className="contact-links-row">
          <a href="https://t.me/zakinskiy" className="contact-link-inline" target="_blank" rel="noreferrer">
            <span className="label-tiny">TG</span>
            <span className="contact-link__value">@zakinskiy</span>
          </a>
          <span className="contact-sep">·</span>
          <a href="mailto:qeepil@bk.ru" className="contact-link-inline">
            <span className="label-tiny">Email</span>
            <span className="contact-link__value">qeepil@bk.ru</span>
          </a>
        </div>
      </div>
    </div>
  )
}

export default function TextOverlay({ scrollData, onOpenCategory }) {
  const { raw } = scrollData
  const heroOp    = Math.max(0, 1 - Math.abs(raw - 0) * 2.5)
  const worksOp   = Math.max(0, 1 - Math.abs(raw - 1) * 2.5)
  const contactOp = Math.max(0, 1 - Math.abs(raw - 2) * 2.5)

  return (
    <div className="text-overlay">
      <HeroText opacity={heroOp} />
      <CategoryCards opacity={worksOp} onOpenCategory={onOpenCategory} />
      <ContactText opacity={contactOp} />
    </div>
  )
}
