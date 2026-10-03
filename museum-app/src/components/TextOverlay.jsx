import React, { useState } from 'react'
import './TextOverlay.css'

const WORKS = [
  {
    num: '01',
    title: 'Animation',
    tools: 'Higgsfield AI',
    desc: 'AI-driven animation — motion and atmosphere generated frame by frame.',
    video: '/work_01.mp4',
  },
  {
    num: '02',
    title: 'Ad Creative',
    tools: 'Higgsfield AI',
    desc: 'Cinematic ad reel created entirely with generative AI tools.',
    video: '/work_02.mp4',
  },
]

// Section 0 — Hero / Intro
function HeroText({ opacity }) {
  return (
    <div className="overlay-section overlay-hero" style={{ opacity }}>
      <div className="overlay-hero__headline">
        <h1 className="headline-large">
          I build things<br />
          <em>AI has never<br />built before.</em>
        </h1>
      </div>
      <div className="overlay-hero__body">
        <p className="body-small">
          Zak — AI creator pushing the edge<br />
          of generative media, 3D and<br />
          interactive experience.
        </p>
        <div className="overlay-hero__meta">
          <span className="label-tiny">Available for projects</span>
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

  const prev = () => setCurrent(i => (i - 1 + WORKS.length) % WORKS.length)
  const next = () => setCurrent(i => (i + 1) % WORKS.length)
  const w = WORKS[current]

  return (
    <div
      className="overlay-section overlay-works"
      style={{ opacity, pointerEvents: opacity > 0.3 ? 'auto' : 'none' }}
    >
      <div className="works-header">
        <span className="label-tiny">Selected work</span>
        <span className="label-tiny works-counter">{current + 1} / {WORKS.length}</span>
      </div>

      <div className="works-card">
        <video
          className="works-card__video"
          src={w.video}
          autoPlay
          muted
          loop
          playsInline
          key={w.video}
        />
        <div className="works-card__info">
          <span className="works-card__num label-tiny">{w.num}</span>
          <h2 className="works-card__title headline-medium">{w.title}</h2>
          <span className="works-card__tools label-tiny">{w.tools}</span>
          <p className="works-card__desc body-small">{w.desc}</p>
        </div>
      </div>

      <div className="works-nav">
        <button className="works-nav__btn" onClick={prev} aria-label="Previous">←</button>
        <div className="works-nav__dots">
          {WORKS.map((_, i) => (
            <button
              key={i}
              className={`works-nav__dot ${i === current ? 'works-nav__dot--active' : ''}`}
              onClick={() => setCurrent(i)}
              aria-label={`Work ${i + 1}`}
            />
          ))}
        </div>
        <button className="works-nav__btn" onClick={next} aria-label="Next">→</button>
      </div>
    </div>
  )
}

// Section 2 — Contacts
function ContactText({ opacity }) {
  return (
    <div className="overlay-section overlay-contact" style={{ opacity, pointerEvents: opacity > 0.3 ? 'auto' : 'none' }}>
      <div className="contact-inner">
        <span className="label-tiny">Get in touch</span>
        <h2 className="headline-large contact-headline">
          Let's create<br /><em>something new.</em>
        </h2>
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
  // opacity peaks at 1 when raw == section index, fades within ±0.5
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
