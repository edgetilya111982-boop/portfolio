import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import './TextOverlay.css'

const WORKS = [
  {
    num: '01',
    title: 'Анимация',
    tools: 'Higgsfield AI',
    desc: 'AI-анимация, где каждый кадр рождается из идеи — без рук, только воображение.',
    video: `${import.meta.env.BASE_URL}work_01.mp4`,
  },
  {
    num: '02',
    title: 'Рекламный ролик',
    tools: 'Higgsfield AI',
    desc: 'Кинематографичный ролик, созданный целиком инструментами генеративного ИИ.',
    video: `${import.meta.env.BASE_URL}work_02.mp4`,
  },
]

// Section 0 — Hero
function HeroText({ opacity }) {
  return (
    <div className="overlay-section overlay-hero" style={{ opacity }}>
      <div className="overlay-hero__headline">
        <h1 className="headline-large">
          Я создаю образы,<br />
          которые ИИ<br />
          <span className="hero-accent">ещё не видел.</span>
        </h1>
      </div>
      <div className="overlay-hero__body">
        <p className="body-small">
          Zak — AI-дизайнер, саунд-дизайнер<br />
          и автор визуального контента.<br />
          Строю будущее инструментами ИИ.
        </p>
        <div className="overlay-hero__meta">
          <span className="label-tiny">Открыт к проектам</span>
          <span className="label-tiny">·</span>
          <span className="label-tiny">2024</span>
        </div>
      </div>
    </div>
  )
}

// Section 1 — Works carousel
function WorksText({ opacity }) {
  const [current, setCurrent] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [modal, setModal] = useState(false)
  const videoRef = useRef(null)
  const modalVideoRef = useRef(null)

  // Start loading video only when section becomes visible
  useEffect(() => {
    if (opacity > 0.1 && !loaded) setLoaded(true)
  }, [opacity, loaded])

  // Play/pause preview video (always muted, pause when modal open)
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = true
    if (!modal && opacity > 0.3) { v.play().catch(() => {}) }
    else v.pause()
  }, [opacity, modal])

  // Play modal video with sound when modal opens
  useEffect(() => {
    if (!modal) return
    const mv = modalVideoRef.current
    if (!mv) return
    mv.muted = false
    mv.volume = 1
    mv.currentTime = 0
    mv.play().catch(() => {})
  }, [modal])

  const prev = () => setCurrent(i => (i - 1 + WORKS.length) % WORKS.length)
  const next = () => setCurrent(i => (i + 1) % WORKS.length)
  const w = WORKS[current]

  const closeModal = () => {
    if (modalVideoRef.current) {
      modalVideoRef.current.pause()
      modalVideoRef.current.muted = true
    }
    setModal(false)
  }

  const handleVideoClick = () => setModal(true)

  return (
    <>
      {modal && createPortal(
        <div className="video-modal" onClick={closeModal}>
          <video
            ref={modalVideoRef}
            className="video-modal__video"
            src={w.video}
            playsInline
            onClick={e => e.stopPropagation()}
          />
          <button
            className="video-modal__close"
            onClick={closeModal}
            aria-label="Закрыть"
          >
            ✕&nbsp;&nbsp;Закрыть
          </button>
        </div>,
        document.body
      )}

      <div
        className="overlay-section overlay-works"
        style={{ opacity, pointerEvents: opacity > 0.3 ? 'auto' : 'none' }}
      >
        <div className="works-header">
          <span className="label-tiny">Избранные работы</span>
          <span className="label-tiny works-counter">{current + 1} / {WORKS.length}</span>
        </div>

        <div className="works-card">
          <div className="works-card__video-wrap" onClick={handleVideoClick}>
            <video
              ref={videoRef}
              className="works-card__video"
              src={loaded ? w.video : undefined}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              key={w.video}
            />
            <div className="works-card__fullscreen-hint">⛶</div>
          </div>
          <div className="works-card__info">
            <span className="works-card__num label-tiny">{w.num}</span>
            <h2 className="works-card__title headline-medium">{w.title}</h2>
            <span className="works-card__tools label-tiny">{w.tools}</span>
            <p className="works-card__desc body-small">{w.desc}</p>
          </div>
        </div>

        <div className="works-nav">
          <button className="works-nav__btn" onClick={prev} aria-label="Назад">←</button>
          <div className="works-nav__dots">
            {WORKS.map((_, i) => (
              <button
                key={i}
                className={`works-nav__dot ${i === current ? 'works-nav__dot--active' : ''}`}
                onClick={() => setCurrent(i)}
                aria-label={`Работа ${i + 1}`}
              />
            ))}
          </div>
          <button className="works-nav__btn" onClick={next} aria-label="Вперёд">→</button>
        </div>
      </div>
    </>
  )
}

// Section 2 — Contacts
function ContactText({ opacity }) {
  return (
    <div className="overlay-section overlay-contact" style={{ opacity, pointerEvents: opacity > 0.3 ? 'auto' : 'none' }}>
      <div className="contact-inner">
        <span className="label-tiny">Связаться</span>
        <h2 className="headline-large contact-headline">
          Создадим<br />
          <span className="hero-accent">что‑то невероятное.</span>
        </h2>
        <p className="body-small contact-sub">
          Есть идея? Я знаю, как сделать её реальной.<br />
          Дизайн, анимация, саунд — всё в одном месте.
        </p>
        <div className="contact-links">
          <a href="https://t.me/zakinskiy" className="contact-link" target="_blank" rel="noreferrer">
            <span className="contact-link__label label-tiny">Telegram</span>
            <span className="contact-link__value">@zakinskiy</span>
          </a>
          <a href="mailto:qeepil@bk.ru" className="contact-link">
            <span className="contact-link__label label-tiny">Email</span>
            <span className="contact-link__value">qeepil@bk.ru</span>
          </a>
        </div>
      </div>
    </div>
  )
}

export default function TextOverlay({ scrollData }) {
  const { raw } = scrollData
  const heroOp    = Math.max(0, 1 - Math.abs(raw - 0) * 2.5)
  const worksOp   = Math.max(0, 1 - Math.abs(raw - 1) * 2.5)
  const contactOp = Math.max(0, 1 - Math.abs(raw - 2) * 2.5)

  return (
    <div className="text-overlay">
      <HeroText opacity={heroOp} />
      <WorksText opacity={worksOp} />
      <ContactText opacity={contactOp} />
    </div>
  )
}
